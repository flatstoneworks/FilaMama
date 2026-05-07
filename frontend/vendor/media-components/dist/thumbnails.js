/**
 * Server-side `ThumbnailService` for generating and caching thumbnails.
 *
 * Supports: images (JPEG/PNG/WebP/BMP/TIFF/AVIF/HEIC/HEIF), SVGs, GIFs
 * (first frame), Pixelmator PXD previews, videos (via `ffmpeg`), and EPUBs
 * (cover extraction).
 *
 * ## Dependencies
 *   - `sharp` (peer, required) — image processing.
 *   - `jszip` (peer, required) — EPUB cover extraction.
 *   - `ffmpeg` (system binary, required for video thumbnails).
 *
 * ## Concurrency
 * The service uses non-blocking I/O (`fs/promises`) but performs **no file
 * locking**. If multiple processes share the same `cacheDir`, concurrent
 * writes of the same cache key are safe (last writer wins, identical output),
 * but concurrent eviction may race — prefer a single writer process.
 *
 * ## Eviction
 * When `maxCacheSizeMb > 0`, a best-effort LRU eviction runs after every
 * {@link ThumbnailService.EVICTION_CHECK_INTERVAL} writes. Because eviction is
 * lazy, the on-disk cache size may temporarily exceed the limit by up to one
 * interval's worth of writes. For a strict upper bound, call
 * {@link ThumbnailService.evict} manually.
 *
 * ## Error handling
 * All `get*` methods return `null` on failure rather than throwing, so
 * unsupported formats, missing files, and subprocess failures are
 * indistinguishable at the API level. Pass a `logger` to observe failures.
 */
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { THUMBNAIL_EBOOK_EXTENSIONS, THUMBNAIL_IMAGE_EXTENSIONS, THUMBNAIL_VIDEO_EXTENSIONS } from './capabilities.js';
export { THUMBNAIL_EBOOK_EXTENSIONS, THUMBNAIL_EXTENSIONS, THUMBNAIL_IMAGE_EXTENSIONS, THUMBNAIL_VIDEO_EXTENSIONS, isThumbnailableFile, } from './capabilities.js';
const NOOP_LOGGER = {
    warn: () => { },
    info: () => { },
};
// Dot-prefixed extension sets derived once from the canonical capability registry.
const IMAGE_EXTS = new Set(THUMBNAIL_IMAGE_EXTENSIONS.filter((e) => !['gif', 'svg', 'pxd'].includes(e)).map((e) => `.${e}`));
const VIDEO_EXTS = new Set(THUMBNAIL_VIDEO_EXTENSIONS.map((e) => `.${e}`));
const EBOOK_EXTS = new Set(THUMBNAIL_EBOOK_EXTENSIONS.map((e) => `.${e}`));
const PIXELMATOR_EXTS = new Set(['.pxd']);
const PIXELMATOR_QUICKLOOK_DIRS = ['QuickLook', 'Quicklook', 'quicklook'];
const PIXELMATOR_QUICKLOOK_FILES = [
    'Thumbnail.webp',
    'Thumbnail.png',
    'Thumbnail.jpg',
    'Thumbnail.jpeg',
    'Preview.webp',
    'Preview.png',
    'Preview.jpg',
    'Preview.jpeg',
    'Icon.webp',
    'Icon.png',
    'Icon.jpg',
    'Icon.jpeg',
];
const PIXELMATOR_QUICKLOOK_CANDIDATES = PIXELMATOR_QUICKLOOK_DIRS.flatMap((dir) => PIXELMATOR_QUICKLOOK_FILES.map((file) => `${dir}/${file}`));
export class ThumbnailService {
    /** Number of writes between lazy eviction checks. */
    static EVICTION_CHECK_INTERVAL = 50;
    cacheDir;
    sizes;
    quality;
    maxCacheSizeBytes;
    logger;
    ffmpegPath;
    writeCount = 0;
    cacheDirReady = null;
    _sharp = null;
    _jszip = null;
    constructor(options) {
        this.cacheDir = options.cacheDir;
        this.sizes = options.sizes;
        this.quality = options.quality ?? 85;
        this.maxCacheSizeBytes = (options.maxCacheSizeMb ?? 0) * 1024 * 1024;
        this.logger = options.logger ?? NOOP_LOGGER;
        this.ffmpegPath = options.ffmpegPath ?? 'ffmpeg';
    }
    // -- Lazy resources --------------------------------------------------------
    async ensureCacheDir() {
        if (!this.cacheDirReady) {
            // Reset the cached promise on rejection so a transient EACCES or race
            // with another process doesn't wedge the service permanently.
            this.cacheDirReady = mkdir(this.cacheDir, { recursive: true })
                .then(() => undefined)
                .catch((err) => {
                this.cacheDirReady = null;
                throw err;
            });
        }
        return this.cacheDirReady;
    }
    async getSharp() {
        if (!this._sharp) {
            this._sharp = (await import('sharp')).default;
        }
        return this._sharp;
    }
    async getJSZip() {
        if (!this._jszip) {
            this._jszip = (await import('jszip')).default;
        }
        return this._jszip;
    }
    // -- Cache key / path ------------------------------------------------------
    async computeCacheKey(filePath, size) {
        const st = await stat(filePath);
        const keyData = `${filePath}:${st.mtimeMs}:${st.size}:${size}`;
        return createHash('sha256').update(keyData).digest('hex').slice(0, 32);
    }
    getCachePath(cacheKey) {
        return join(this.cacheDir, `${cacheKey}.jpg`);
    }
    // -- Sharp pipeline --------------------------------------------------------
    /** Shared sharp pipeline: resize, flatten transparency, output JPEG. */
    async toJpegThumbnail(input, targetSize, sharpOptions) {
        const sharp = await this.getSharp();
        return sharp(input, sharpOptions)
            .resize(targetSize, targetSize, { fit: 'inside', withoutEnlargement: true })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: this.quality })
            .toBuffer();
    }
    /** Wrap a generator call and convert throws into a `null` result + warning. */
    async tryGenerate(label, filePath, fn) {
        try {
            return await fn();
        }
        catch (err) {
            this.logger.warn(`[thumbnails] ${label} failed for ${filePath}`, err);
            return null;
        }
    }
    // -- Public API ------------------------------------------------------------
    /**
     * Return the width/height of an image file. Returns `{0, 0}` if the file
     * is missing, unreadable, or not a supported image format.
     */
    async getImageDimensions(filePath) {
        try {
            const sharp = await this.getSharp();
            const input = PIXELMATOR_EXTS.has(extname(filePath).toLowerCase())
                ? await this.readPixelmatorPreview(filePath)
                : filePath;
            if (!input)
                return { width: 0, height: 0 };
            const meta = await sharp(input).metadata();
            return { width: meta.width ?? 0, height: meta.height ?? 0 };
        }
        catch (err) {
            this.logger.warn(`[thumbnails] getImageDimensions failed for ${filePath}`, err);
            return { width: 0, height: 0 };
        }
    }
    /**
     * Generate or retrieve a cached thumbnail for `filePath` at the named
     * `size` preset. Returns the JPEG bytes, or `null` if the file type is
     * unsupported, the file is missing, or generation fails.
     */
    async getThumbnail(filePath, size = 'thumb') {
        let cacheKey;
        try {
            cacheKey = await this.computeCacheKey(filePath, size);
        }
        catch {
            // File doesn't exist or isn't accessible.
            return null;
        }
        const targetSize = this.sizes[size] ?? 256;
        const cachePath = this.getCachePath(cacheKey);
        try {
            return await readFile(cachePath);
        }
        catch {
            // Cache miss — generate below.
        }
        const ext = extname(filePath).toLowerCase();
        const thumbBytes = await this.generate(filePath, ext, targetSize);
        if (!thumbBytes)
            return null;
        await this.ensureCacheDir();
        try {
            await writeFile(cachePath, thumbBytes);
        }
        catch (err) {
            this.logger.warn(`[thumbnails] failed to write cache file ${cachePath}`, err);
            return thumbBytes;
        }
        this.writeCount++;
        if (this.maxCacheSizeBytes && this.writeCount % ThumbnailService.EVICTION_CHECK_INTERVAL === 0) {
            // Fire-and-forget: eviction is documented as best-effort and lazy, so
            // the caller shouldn't wait on a full directory scan once every 50
            // writes. Swallow the resulting rejection via the logger.
            void this.evict().catch((err) => this.logger.warn('[thumbnails] background eviction failed', err));
        }
        return thumbBytes;
    }
    /**
     * Clear cached thumbnails. When `filePath` is provided, clears only that
     * file's thumbnails across all size presets. Otherwise clears the entire
     * cache directory (only `.jpg` files). Returns the number of files removed.
     *
     * @remarks
     * Per-file clearing re-hashes the file's current `mtimeMs` and `size`, so
     * if the underlying file has been modified since the cache entry was
     * written, the stale entry is **not** removed — those stale entries are
     * only reclaimed by LRU eviction or a full `clearCache()`. If you need
     * deterministic per-file cleanup across modifications, call
     * `clearCache()` with no argument.
     */
    async clearCache(filePath) {
        let count = 0;
        if (filePath) {
            let st;
            try {
                st = await stat(filePath);
            }
            catch {
                return 0;
            }
            // Compute all per-size cache keys from a single stat.
            for (const size of Object.keys(this.sizes)) {
                const keyData = `${filePath}:${st.mtimeMs}:${st.size}:${size}`;
                const cacheKey = createHash('sha256').update(keyData).digest('hex').slice(0, 32);
                try {
                    await unlink(this.getCachePath(cacheKey));
                    count++;
                }
                catch {
                    // Cache file doesn't exist for this size.
                }
            }
            return count;
        }
        let files;
        try {
            files = await readdir(this.cacheDir);
        }
        catch {
            return 0;
        }
        for (const file of files) {
            if (!file.endsWith('.jpg'))
                continue;
            try {
                await unlink(join(this.cacheDir, file));
                count++;
            }
            catch {
                // Ignore — best-effort cleanup.
            }
        }
        return count;
    }
    /**
     * Run LRU eviction immediately. Deletes the oldest-accessed `.jpg` files
     * until the total cache size fits under `maxCacheSizeMb`. No-op when
     * eviction is disabled. Returns the number of files removed.
     */
    async evict() {
        if (!this.maxCacheSizeBytes)
            return 0;
        let entries;
        try {
            const names = await readdir(this.cacheDir);
            const jpgs = names.filter((n) => n.endsWith('.jpg'));
            entries = await Promise.all(jpgs.map(async (n) => {
                const fullPath = join(this.cacheDir, n);
                const st = await stat(fullPath);
                return { path: fullPath, size: st.size, atimeMs: st.atimeMs };
            }));
        }
        catch (err) {
            this.logger.warn('[thumbnails] eviction scan failed', err);
            return 0;
        }
        let totalSize = entries.reduce((sum, f) => sum + f.size, 0);
        if (totalSize <= this.maxCacheSizeBytes)
            return 0;
        entries.sort((a, b) => a.atimeMs - b.atimeMs);
        let evicted = 0;
        for (const entry of entries) {
            if (totalSize <= this.maxCacheSizeBytes)
                break;
            try {
                await unlink(entry.path);
                totalSize -= entry.size;
                evicted++;
            }
            catch {
                // Another process may have removed it — keep going.
            }
        }
        if (evicted) {
            this.logger.info(`[thumbnails] evicted ${evicted} files, cache now ${(totalSize / (1024 * 1024)).toFixed(1)} MB`);
        }
        return evicted;
    }
    // -- Per-format generators -------------------------------------------------
    async generate(filePath, ext, targetSize) {
        if (IMAGE_EXTS.has(ext)) {
            return this.tryGenerate('image', filePath, () => this.toJpegThumbnail(filePath, targetSize));
        }
        if (PIXELMATOR_EXTS.has(ext)) {
            return this.generatePixelmatorThumbnail(filePath, targetSize);
        }
        if (ext === '.svg') {
            return this.tryGenerate('svg', filePath, async () => {
                const svgBuffer = await readFile(filePath);
                return this.toJpegThumbnail(svgBuffer, targetSize, { density: 150 });
            });
        }
        if (ext === '.gif') {
            return this.tryGenerate('gif', filePath, () => this.toJpegThumbnail(filePath, targetSize, { pages: 1 }));
        }
        if (VIDEO_EXTS.has(ext)) {
            return this.generateVideoThumbnail(filePath, targetSize);
        }
        if (EBOOK_EXTS.has(ext)) {
            return this.generateEpubThumbnail(filePath, targetSize);
        }
        return null;
    }
    async generateVideoThumbnail(filePath, targetSize) {
        return this.tryGenerate('video', filePath, () => {
            return new Promise((resolve, reject) => {
                // Seek 500 ms in. For clips shorter than 500 ms ffmpeg falls back to
                // the last available frame, which is fine for a thumbnail. Using a
                // fixed offset avoids a second ffmpeg invocation for duration probing.
                const args = [
                    '-nostdin',
                    '-hide_banner',
                    '-loglevel',
                    'error',
                    '-ss',
                    '00:00:00.5',
                    '-i',
                    filePath,
                    '-frames:v',
                    '1',
                    '-vf',
                    `scale=${targetSize}:${targetSize}:force_original_aspect_ratio=decrease`,
                    '-f',
                    'image2pipe',
                    '-vcodec',
                    'mjpeg',
                    '-q:v',
                    '5',
                    '-',
                ];
                execFile(this.ffmpegPath, args, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 30_000 }, (error, stdout) => {
                    if (error)
                        return reject(error);
                    if (!stdout || stdout.length === 0)
                        return reject(new Error('ffmpeg produced no output'));
                    resolve(stdout);
                });
            });
        });
    }
    async generatePixelmatorThumbnail(filePath, targetSize) {
        return this.tryGenerate('pixelmator pxd', filePath, async () => {
            const preview = await this.readPixelmatorPreview(filePath);
            if (!preview)
                throw new Error('no Pixelmator Quick Look preview found');
            return this.toJpegThumbnail(preview, targetSize);
        });
    }
    async readPixelmatorPreview(filePath) {
        const st = await stat(filePath);
        if (st.isDirectory()) {
            return this.readPixelmatorPackagePreview(filePath);
        }
        return this.readPixelmatorZipPreview(filePath);
    }
    async readPixelmatorPackagePreview(filePath) {
        for (const candidate of PIXELMATOR_QUICKLOOK_CANDIDATES) {
            try {
                return await readFile(join(filePath, ...candidate.split('/')));
            }
            catch {
                // Try the next candidate.
            }
        }
        return null;
    }
    async readPixelmatorZipPreview(filePath) {
        const JSZipCtor = await this.getJSZip();
        const data = await readFile(filePath);
        const zip = await JSZipCtor.loadAsync(data);
        for (const candidate of PIXELMATOR_QUICKLOOK_CANDIDATES) {
            const entry = findZipEntry(zip, candidate);
            if (!entry)
                continue;
            try {
                return await entry.async('nodebuffer');
            }
            catch {
                // Try the next candidate.
            }
        }
        return null;
    }
    async generateEpubThumbnail(filePath, targetSize) {
        return this.tryGenerate('epub', filePath, async () => {
            const JSZipCtor = await this.getJSZip();
            const data = await readFile(filePath);
            const zip = await JSZipCtor.loadAsync(data);
            const coverPaths = await this.findEpubCoverPaths(zip);
            for (const coverPath of coverPaths) {
                const normalized = coverPath.replace(/\/\//g, '/').replace(/^\//, '');
                const entry = zip.file(normalized);
                if (!entry)
                    continue;
                try {
                    const imgData = await entry.async('nodebuffer');
                    return await this.toJpegThumbnail(imgData, targetSize);
                }
                catch {
                    // Try the next candidate.
                }
            }
            throw new Error('no cover image found');
        });
    }
    async findEpubCoverPaths(zip) {
        const coverPaths = [];
        // Method 1: parse the OPF metadata referenced from META-INF/container.xml.
        try {
            const containerFile = zip.file('META-INF/container.xml');
            if (containerFile) {
                const containerXml = await containerFile.async('text');
                const opfPathMatch = /full-path="([^"]+)"/.exec(containerXml);
                if (opfPathMatch) {
                    const opfPath = opfPathMatch[1];
                    const opfDir = dirname(opfPath) === '.' ? '' : dirname(opfPath);
                    const opfFile = zip.file(opfPath);
                    if (opfFile) {
                        const opfXml = await opfFile.async('text');
                        coverPaths.push(...findCoverItemsInOpf(opfXml, opfDir));
                    }
                }
            }
        }
        catch {
            // OPF parsing failed — fall back to common paths.
        }
        // Method 2: common hard-coded cover paths.
        coverPaths.push('cover.jpg', 'cover.jpeg', 'cover.png', 'OEBPS/cover.jpg', 'OEBPS/cover.jpeg', 'OEBPS/cover.png', 'OEBPS/images/cover.jpg', 'OEBPS/images/cover.jpeg', 'OEBPS/images/cover.png', 'images/cover.jpg', 'images/cover.jpeg', 'images/cover.png', 'OPS/cover.jpg', 'OPS/cover.jpeg', 'OPS/cover.png');
        // Method 3: any image whose name contains "cover".
        zip.forEach((relativePath) => {
            const lower = relativePath.toLowerCase();
            if (lower.includes('cover') && /\.(jpg|jpeg|png|gif)$/.test(lower)) {
                coverPaths.push(relativePath);
            }
        });
        return coverPaths;
    }
}
/**
 * Parse an OPF manifest and return candidate cover paths (relative to the
 * EPUB root) in priority order. Extracted for testability and to keep
 * {@link ThumbnailService.findEpubCoverPaths} focused on orchestration.
 */
function findCoverItemsInOpf(opfXml, opfDir) {
    const results = [];
    const join = (href) => (opfDir ? `${opfDir}/${href}` : href);
    // Build an id -> { href, properties } map from every <item> in the manifest.
    const items = new Map();
    const itemRegex = /<item\b[^>]*>/g;
    let match;
    while ((match = itemRegex.exec(opfXml)) !== null) {
        const tag = match[0];
        const id = /id="([^"]+)"/.exec(tag)?.[1];
        const href = /href="([^"]+)"/.exec(tag)?.[1];
        const properties = /properties="([^"]+)"/.exec(tag)?.[1] ?? '';
        if (id && href)
            items.set(id, { href, properties });
    }
    // Priority 1: <meta name="cover" content="ID"> → item[id=ID].
    const coverMetaMatch = /<meta[^>]+name="cover"[^>]+content="([^"]+)"/.exec(opfXml);
    if (coverMetaMatch) {
        const item = items.get(coverMetaMatch[1]);
        if (item)
            results.push(join(item.href));
    }
    // Priority 2: EPUB 3 cover-image property, or any id/properties containing "cover".
    for (const [id, { href, properties }] of items) {
        if (/cover-image/.test(properties) || /cover/i.test(id) || /cover/i.test(properties)) {
            results.push(join(href));
        }
    }
    return results;
}
function findZipEntry(zip, candidatePath) {
    const normalizedCandidate = normalizeZipPath(candidatePath);
    return Object.values(zip.files).find((entry) => !entry.dir && normalizeZipPath(entry.name) === normalizedCandidate);
}
function normalizeZipPath(path) {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}
//# sourceMappingURL=thumbnails.js.map