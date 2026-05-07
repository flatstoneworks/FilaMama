/**
 * Shared media capability registry.
 *
 * Keep browser-safe format detection here so FLATSTONE apps can share import
 * validation, MIME mapping, preview decisions, and thumbnail capability checks.
 */
export const IMAGE_EXTENSIONS = [
    'jpg',
    'jpeg',
    'jfif',
    'png',
    'webp',
    'gif',
    'bmp',
    'tiff',
    'tif',
    'avif',
    'heic',
    'heif',
    'svg',
    'pxd',
];
export const VIDEO_EXTENSIONS = [
    'mp4',
    'webm',
    'mov',
    'avi',
    'mkv',
    'm4v',
    'ogg',
    'ogv',
    'flv',
    'wmv',
    'mpeg',
    'mpg',
    '3gp',
    '3g2',
    'ts',
    'mts',
    'm2ts',
];
export const AUDIO_EXTENSIONS = [
    'mp3',
    'wav',
    'ogg',
    'oga',
    'flac',
    'aac',
    'm4a',
    'webm',
    'opus',
    'aiff',
    'aif',
];
export const DOCUMENT_EXTENSIONS = ['pdf'];
export const EBOOK_EXTENSIONS = ['epub'];
/**
 * Video extensions that mainstream browsers can usually play without
 * transcoding. Kept for backward compatibility with `videoNeedsTranscoding`.
 */
export const BROWSER_NATIVE_VIDEO = ['mp4', 'webm', 'm4v', 'ogg', 'ogv'];
export const THUMBNAIL_IMAGE_EXTENSIONS = IMAGE_EXTENSIONS;
export const THUMBNAIL_VIDEO_EXTENSIONS = VIDEO_EXTENSIONS;
export const THUMBNAIL_EBOOK_EXTENSIONS = ['epub'];
export const THUMBNAIL_EXTENSIONS = [
    ...THUMBNAIL_IMAGE_EXTENSIONS,
    ...THUMBNAIL_VIDEO_EXTENSIONS,
    ...THUMBNAIL_EBOOK_EXTENSIONS,
];
export const MEDIA_CAPABILITIES = [
    {
        extension: 'jpg',
        kind: 'image',
        mime: 'image/jpeg',
        mimeAliases: ['image/jpg', 'image/pjpeg'],
        importable: true,
        previewable: true,
        thumbnailable: true,
    },
    { extension: 'jpeg', kind: 'image', mime: 'image/jpeg', importable: true, previewable: true, thumbnailable: true },
    { extension: 'jfif', kind: 'image', mime: 'image/jpeg', importable: true, previewable: true, thumbnailable: true },
    { extension: 'png', kind: 'image', mime: 'image/png', importable: true, previewable: true, thumbnailable: true },
    { extension: 'webp', kind: 'image', mime: 'image/webp', importable: true, previewable: true, thumbnailable: true },
    { extension: 'gif', kind: 'image', mime: 'image/gif', importable: true, previewable: true, thumbnailable: true },
    {
        extension: 'bmp',
        kind: 'image',
        mime: 'image/bmp',
        mimeAliases: ['image/x-ms-bmp', 'image/x-bmp'],
        importable: true,
        previewable: true,
        thumbnailable: true,
    },
    { extension: 'tiff', kind: 'image', mime: 'image/tiff', importable: true, previewable: false, thumbnailable: true },
    { extension: 'tif', kind: 'image', mime: 'image/tiff', importable: true, previewable: false, thumbnailable: true },
    { extension: 'avif', kind: 'image', mime: 'image/avif', importable: true, previewable: true, thumbnailable: true },
    {
        extension: 'heic',
        kind: 'image',
        mime: 'image/heic',
        mimeAliases: ['image/heif-sequence', 'image/heic-sequence'],
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
    { extension: 'heif', kind: 'image', mime: 'image/heif', importable: true, previewable: false, thumbnailable: true },
    { extension: 'svg', kind: 'image', mime: 'image/svg+xml', importable: true, previewable: true, thumbnailable: true },
    {
        extension: 'pxd',
        kind: 'image',
        mime: 'application/x-pixelmator-pxd',
        mimeAliases: ['application/x-pixelmator'],
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
    { extension: 'mp4', kind: 'video', mime: 'video/mp4', importable: true, previewable: true, thumbnailable: true },
    { extension: 'webm', kind: 'video', mime: 'video/webm', importable: true, previewable: true, thumbnailable: true },
    {
        extension: 'mov',
        kind: 'video',
        mime: 'video/quicktime',
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
    {
        extension: 'avi',
        kind: 'video',
        mime: 'video/x-msvideo',
        mimeAliases: ['video/avi'],
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
    {
        extension: 'mkv',
        kind: 'video',
        mime: 'video/x-matroska',
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
    {
        extension: 'm4v',
        kind: 'video',
        mime: 'video/x-m4v',
        mimeAliases: ['video/mp4'],
        importable: true,
        previewable: true,
        thumbnailable: true,
    },
    { extension: 'ogg', kind: 'video', mime: 'video/ogg', importable: true, previewable: true, thumbnailable: true },
    { extension: 'ogv', kind: 'video', mime: 'video/ogg', importable: true, previewable: true, thumbnailable: true },
    { extension: 'flv', kind: 'video', mime: 'video/x-flv', importable: true, previewable: false, thumbnailable: true },
    {
        extension: 'wmv',
        kind: 'video',
        mime: 'video/x-ms-wmv',
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
    { extension: 'mpeg', kind: 'video', mime: 'video/mpeg', importable: true, previewable: false, thumbnailable: true },
    { extension: 'mpg', kind: 'video', mime: 'video/mpeg', importable: true, previewable: false, thumbnailable: true },
    { extension: '3gp', kind: 'video', mime: 'video/3gpp', importable: true, previewable: false, thumbnailable: true },
    { extension: '3g2', kind: 'video', mime: 'video/3gpp2', importable: true, previewable: false, thumbnailable: true },
    { extension: 'ts', kind: 'video', mime: 'video/mp2t', importable: true, previewable: false, thumbnailable: true },
    { extension: 'mts', kind: 'video', mime: 'video/mp2t', importable: true, previewable: false, thumbnailable: true },
    { extension: 'm2ts', kind: 'video', mime: 'video/mp2t', importable: true, previewable: false, thumbnailable: true },
    {
        extension: 'mp3',
        kind: 'audio',
        mime: 'audio/mpeg',
        mimeAliases: ['audio/mp3'],
        importable: true,
        previewable: true,
        thumbnailable: false,
    },
    {
        extension: 'wav',
        kind: 'audio',
        mime: 'audio/wav',
        mimeAliases: ['audio/x-wav', 'audio/wave'],
        importable: true,
        previewable: true,
        thumbnailable: false,
    },
    {
        extension: 'ogg',
        kind: 'audio',
        mime: 'audio/ogg',
        mimeAliases: ['application/ogg'],
        importable: true,
        previewable: true,
        thumbnailable: false,
    },
    { extension: 'oga', kind: 'audio', mime: 'audio/ogg', importable: true, previewable: true, thumbnailable: false },
    {
        extension: 'flac',
        kind: 'audio',
        mime: 'audio/flac',
        mimeAliases: ['audio/x-flac'],
        importable: true,
        previewable: true,
        thumbnailable: false,
    },
    { extension: 'aac', kind: 'audio', mime: 'audio/aac', importable: true, previewable: true, thumbnailable: false },
    {
        extension: 'm4a',
        kind: 'audio',
        mime: 'audio/mp4',
        mimeAliases: ['audio/x-m4a'],
        importable: true,
        previewable: true,
        thumbnailable: false,
    },
    { extension: 'webm', kind: 'audio', mime: 'audio/webm', importable: true, previewable: true, thumbnailable: false },
    { extension: 'opus', kind: 'audio', mime: 'audio/opus', importable: true, previewable: true, thumbnailable: false },
    {
        extension: 'aiff',
        kind: 'audio',
        mime: 'audio/aiff',
        mimeAliases: ['audio/x-aiff'],
        importable: true,
        previewable: false,
        thumbnailable: false,
    },
    { extension: 'aif', kind: 'audio', mime: 'audio/aiff', importable: true, previewable: false, thumbnailable: false },
    {
        extension: 'pdf',
        kind: 'document',
        mime: 'application/pdf',
        importable: false,
        previewable: true,
        thumbnailable: false,
    },
    {
        extension: 'epub',
        kind: 'ebook',
        mime: 'application/epub+zip',
        importable: true,
        previewable: false,
        thumbnailable: true,
    },
];
export const SUPPORTED_MEDIA_FORMATS = MEDIA_CAPABILITIES;
export const UNSUPPORTED_MEDIA_FORMATS = [
    {
        extension: 'psd',
        kind: 'image',
        mime: 'image/vnd.adobe.photoshop',
        reason: 'Unsupported: this package does not include a PSD decoder, and the local Sharp/libvips build exposes no PSD input loader.',
    },
];
const formatsByExtension = new Map();
const formatsByMime = new Map();
const unsupportedByExtension = new Map();
const unsupportedByMime = new Map();
for (const format of SUPPORTED_MEDIA_FORMATS) {
    appendMapValue(formatsByExtension, format.extension, format);
    appendMapValue(formatsByMime, normalizeMimeType(format.mime), format);
    for (const alias of getMimeAliases(format)) {
        appendMapValue(formatsByMime, normalizeMimeType(alias), format);
    }
}
for (const format of UNSUPPORTED_MEDIA_FORMATS) {
    unsupportedByExtension.set(format.extension, format);
    unsupportedByMime.set(normalizeMimeType(format.mime), format);
}
export const EXTENSION_TO_MIME = buildExtensionToMime();
export const MIME_TO_PREFERRED_EXTENSION = buildMimeToPreferredExtension();
export const MEDIA_KIND_BY_EXTENSION = buildExtensionToKind();
export const MIME_TO_MEDIA_KIND = buildMimeToKind();
export const IMAGE_MIME_TYPES = mimeTypesForKind('image');
export const VIDEO_MIME_TYPES = mimeTypesForKind('video');
export const AUDIO_MIME_TYPES = mimeTypesForKind('audio');
export const DOCUMENT_MIME_TYPES = mimeTypesForKind('document');
export const EBOOK_MIME_TYPES = mimeTypesForKind('ebook');
export const MEDIA_MIME_TYPES = unique([
    ...IMAGE_MIME_TYPES,
    ...VIDEO_MIME_TYPES,
    ...AUDIO_MIME_TYPES,
    ...DOCUMENT_MIME_TYPES,
    ...EBOOK_MIME_TYPES,
]);
export const MEDIA_IMPORT_ACCEPT = buildMediaAcceptString({ kinds: ['image', 'video', 'audio'] });
/**
 * Extract the lowercase extension of a filename or URL path without the dot.
 * Returns an empty string when the value has no extension.
 */
export function getFileExtension(filename) {
    const pathWithoutQuery = (filename.trim().split(/[?#]/, 1)[0] ?? '').trim();
    const slashIndex = Math.max(pathWithoutQuery.lastIndexOf('/'), pathWithoutQuery.lastIndexOf('\\'));
    const basename = pathWithoutQuery.slice(slashIndex + 1);
    const dot = basename.lastIndexOf('.');
    if (dot <= 0 || dot === basename.length - 1)
        return '';
    return basename.slice(dot + 1).toLowerCase();
}
/** Normalize a MIME type by lowercasing and removing parameters. */
export function normalizeMimeType(mimeType) {
    return (mimeType.trim().toLowerCase().split(';', 1)[0] ?? '').trim();
}
export function getMimeTypeForExtension(extensionOrFilename) {
    return EXTENSION_TO_MIME[normalizeExtension(extensionOrFilename)];
}
export function getPreferredExtensionForMime(mimeType) {
    return MIME_TO_PREFERRED_EXTENSION[normalizeMimeType(mimeType)];
}
export function getMediaKind(filenameOrMime) {
    if (looksLikeMimeType(filenameOrMime)) {
        return MIME_TO_MEDIA_KIND[normalizeMimeType(filenameOrMime)] ?? null;
    }
    return MEDIA_KIND_BY_EXTENSION[normalizeExtension(filenameOrMime)] ?? null;
}
export function isKnownExtension(extensionOrFilename, kinds) {
    return getFormatsByExtension(extensionOrFilename).some((format) => matchesKind(format.kind, kinds));
}
export function isKnownMimeType(mimeType, kinds) {
    return getFormatsByMime(mimeType).some((format) => matchesKind(format.kind, kinds));
}
export function isSupportedExtension(extensionOrFilename, kinds) {
    return hasCapabilityByExtension(extensionOrFilename, 'import', kinds);
}
export function isSupportedMimeType(mimeType, kinds) {
    return hasCapabilityByMime(mimeType, 'import', kinds);
}
export function isImageFile(filenameOrMime) {
    return hasInputCapability(filenameOrMime, 'import', 'image');
}
export function isVideoFile(filenameOrMime) {
    return hasInputCapability(filenameOrMime, 'import', 'video');
}
export function isAudioFile(filenameOrMime) {
    return hasInputCapability(filenameOrMime, 'import', 'audio');
}
export function isMediaFile(filenameOrMime) {
    return hasInputCapability(filenameOrMime, 'import', ['image', 'video', 'audio']);
}
export function isImportableFile(filenameOrMime, kinds) {
    return hasInputCapability(filenameOrMime, 'import', kinds);
}
export function isPreviewableFile(filenameOrMime, kinds) {
    return hasInputCapability(filenameOrMime, 'preview', kinds);
}
export function isThumbnailableFile(filenameOrMime, kinds) {
    return hasInputCapability(filenameOrMime, 'thumbnail', kinds);
}
export function videoNeedsTranscoding(filenameOrMime) {
    if (looksLikeMimeType(filenameOrMime)) {
        const ext = getPreferredExtensionForMime(filenameOrMime);
        return ext ? videoNeedsTranscoding(ext) : false;
    }
    const ext = normalizeExtension(filenameOrMime);
    return (VIDEO_EXTENSIONS.includes(ext) && !BROWSER_NATIVE_VIDEO.includes(ext));
}
export function buildMediaAcceptString(options = {}) {
    const includeMimeTypes = options.includeMimeTypes ?? true;
    const includeExtensions = options.includeExtensions ?? true;
    if (!includeMimeTypes && !includeExtensions)
        return '';
    const capability = options.capability ?? 'import';
    const values = [];
    for (const format of SUPPORTED_MEDIA_FORMATS) {
        if (!matchesKind(format.kind, options.kinds) || !matchesCapability(format, capability))
            continue;
        if (includeMimeTypes) {
            values.push(format.mime, ...getMimeAliases(format));
        }
        if (includeExtensions) {
            values.push(`.${format.extension}`);
        }
    }
    return unique(values).join(',');
}
/** Alias with shorter naming for `<input accept>` call sites. */
export const buildAcceptString = buildMediaAcceptString;
export function isUnsupportedFormat(filenameOrMime) {
    return getUnsupportedFormat(filenameOrMime) !== undefined;
}
export function getUnsupportedFormatReason(filenameOrMime) {
    return getUnsupportedFormat(filenameOrMime)?.reason;
}
function hasInputCapability(filenameOrMime, capability, kinds) {
    if (looksLikeMimeType(filenameOrMime)) {
        return hasCapabilityByMime(filenameOrMime, capability, kinds);
    }
    return hasCapabilityByExtension(filenameOrMime, capability, kinds);
}
function hasCapabilityByExtension(extensionOrFilename, capability, kinds) {
    return getFormatsByExtension(extensionOrFilename).some((format) => matchesKind(format.kind, kinds) && matchesCapability(format, capability));
}
function hasCapabilityByMime(mimeType, capability, kinds) {
    return getFormatsByMime(mimeType).some((format) => matchesKind(format.kind, kinds) && matchesCapability(format, capability));
}
function getFormatsByExtension(extensionOrFilename) {
    return formatsByExtension.get(normalizeExtension(extensionOrFilename)) ?? [];
}
function getFormatsByMime(mimeType) {
    return formatsByMime.get(normalizeMimeType(mimeType)) ?? [];
}
function normalizeExtension(extensionOrFilename) {
    const value = extensionOrFilename.trim().toLowerCase();
    const pathWithoutQuery = value.split(/[?#]/, 1)[0] ?? '';
    if (/^\.[a-z0-9][a-z0-9+-]*$/.test(pathWithoutQuery))
        return pathWithoutQuery.slice(1);
    if (/^[a-z0-9][a-z0-9+-]*$/.test(pathWithoutQuery))
        return pathWithoutQuery;
    return getFileExtension(pathWithoutQuery);
}
function matchesKind(kind, kinds) {
    if (!kinds)
        return true;
    return Array.isArray(kinds) ? kinds.includes(kind) : kind === kinds;
}
function matchesCapability(format, capability) {
    if (capability === 'all')
        return true;
    if (capability === 'import')
        return format.importable;
    if (capability === 'preview')
        return format.previewable;
    return format.thumbnailable;
}
function looksLikeMimeType(value) {
    return /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*/i.test(value.trim());
}
function allMimeTypesForFormat(format) {
    return [format.mime, ...getMimeAliases(format)].map(normalizeMimeType);
}
function buildExtensionToMime() {
    const record = {};
    for (const format of SUPPORTED_MEDIA_FORMATS) {
        record[format.extension] ??= format.mime;
    }
    record.ogg = 'audio/ogg';
    record.webm = 'video/webm';
    record.mp4 = 'video/mp4';
    return Object.freeze(record);
}
function buildMimeToPreferredExtension() {
    const record = {};
    for (const format of SUPPORTED_MEDIA_FORMATS) {
        for (const mime of allMimeTypesForFormat(format)) {
            record[mime] ??= format.extension;
        }
    }
    record['audio/mp4'] = 'm4a';
    record['audio/x-m4a'] = 'm4a';
    record['audio/x-wav'] = 'wav';
    record['video/mp4'] = 'mp4';
    return Object.freeze(record);
}
function buildExtensionToKind() {
    const record = {};
    for (const format of SUPPORTED_MEDIA_FORMATS) {
        record[format.extension] ??= format.kind;
    }
    record.ogg = 'audio';
    record.webm = 'video';
    record.mp4 = 'video';
    return Object.freeze(record);
}
function buildMimeToKind() {
    const record = {};
    for (const format of SUPPORTED_MEDIA_FORMATS) {
        for (const mime of allMimeTypesForFormat(format)) {
            record[mime] ??= format.kind;
        }
    }
    return Object.freeze(record);
}
function mimeTypesForKind(kind) {
    const values = [];
    for (const format of SUPPORTED_MEDIA_FORMATS) {
        if (format.kind === kind) {
            values.push(format.mime, ...getMimeAliases(format));
        }
    }
    return unique(values);
}
function getMimeAliases(format) {
    return format.mimeAliases ?? [];
}
function unique(values) {
    return Object.freeze([...new Set(values.filter(Boolean))]);
}
function appendMapValue(map, key, value) {
    map.set(key, [...(map.get(key) ?? []), value]);
}
function getUnsupportedFormat(filenameOrMime) {
    if (looksLikeMimeType(filenameOrMime)) {
        return unsupportedByMime.get(normalizeMimeType(filenameOrMime));
    }
    return unsupportedByExtension.get(normalizeExtension(filenameOrMime));
}
//# sourceMappingURL=capabilities.js.map