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
export { THUMBNAIL_EBOOK_EXTENSIONS, THUMBNAIL_EXTENSIONS, THUMBNAIL_IMAGE_EXTENSIONS, THUMBNAIL_VIDEO_EXTENSIONS, isThumbnailableFile, } from './capabilities.js';
/** Minimal logger interface; defaults to a no-op. */
export interface ThumbnailLogger {
    warn: (message: string, error?: unknown) => void;
    info: (message: string) => void;
}
export interface ThumbnailServiceOptions {
    /** Directory to store cached thumbnails. Created on first write. */
    cacheDir: string;
    /** Named size presets, e.g. `{ thumb: 256, large: 1080 }`. */
    sizes: Record<string, number>;
    /** JPEG quality (1–100, default 85). */
    quality?: number;
    /** Max cache size in MB. `0` (default) disables eviction. */
    maxCacheSizeMb?: number;
    /** Optional logger; defaults to a no-op. */
    logger?: ThumbnailLogger;
    /** Path to the ffmpeg binary (default: `'ffmpeg'`, resolved via `PATH`). */
    ffmpegPath?: string;
}
export declare class ThumbnailService {
    /** Number of writes between lazy eviction checks. */
    static readonly EVICTION_CHECK_INTERVAL = 50;
    private readonly cacheDir;
    private readonly sizes;
    private readonly quality;
    private readonly maxCacheSizeBytes;
    private readonly logger;
    private readonly ffmpegPath;
    private writeCount;
    private cacheDirReady;
    private _sharp;
    private _jszip;
    constructor(options: ThumbnailServiceOptions);
    private ensureCacheDir;
    private getSharp;
    private getJSZip;
    private computeCacheKey;
    private getCachePath;
    /** Shared sharp pipeline: resize, flatten transparency, output JPEG. */
    private toJpegThumbnail;
    /** Wrap a generator call and convert throws into a `null` result + warning. */
    private tryGenerate;
    /**
     * Return the width/height of an image file. Returns `{0, 0}` if the file
     * is missing, unreadable, or not a supported image format.
     */
    getImageDimensions(filePath: string): Promise<{
        width: number;
        height: number;
    }>;
    /**
     * Generate or retrieve a cached thumbnail for `filePath` at the named
     * `size` preset. Returns the JPEG bytes, or `null` if the file type is
     * unsupported, the file is missing, or generation fails.
     */
    getThumbnail(filePath: string, size?: string): Promise<Buffer | null>;
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
    clearCache(filePath?: string): Promise<number>;
    /**
     * Run LRU eviction immediately. Deletes the oldest-accessed `.jpg` files
     * until the total cache size fits under `maxCacheSizeMb`. No-op when
     * eviction is disabled. Returns the number of files removed.
     */
    evict(): Promise<number>;
    private generate;
    private generateVideoThumbnail;
    private generatePixelmatorThumbnail;
    private readPixelmatorPreview;
    private readPixelmatorPackagePreview;
    private readPixelmatorZipPreview;
    private generateEpubThumbnail;
    private findEpubCoverPaths;
}
//# sourceMappingURL=thumbnails.d.ts.map