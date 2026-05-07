/**
 * Shared media capability registry.
 *
 * Keep browser-safe format detection here so FLATSTONE apps can share import
 * validation, MIME mapping, preview decisions, and thumbnail capability checks.
 */
export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'ebook';
export type MediaCapability = {
    extension: string;
    kind: MediaKind;
    mime: string;
    mimeAliases?: readonly string[];
    importable: boolean;
    previewable: boolean;
    thumbnailable: boolean;
};
export type UnsupportedMediaFormat = {
    extension: string;
    kind: MediaKind;
    mime: string;
    reason: string;
};
export type MediaCapabilityFilter = 'all' | 'import' | 'preview' | 'thumbnail';
export interface BuildMediaAcceptStringOptions {
    /** Limit accepted formats to one or more media kinds. Defaults to all importable kinds. */
    kinds?: MediaKind | readonly MediaKind[];
    /** Include MIME types such as `image/png`. Defaults to `true`. */
    includeMimeTypes?: boolean;
    /** Include dot extensions such as `.png`. Defaults to `true`. */
    includeExtensions?: boolean;
    /** Limit formats by capability. Defaults to `import`. */
    capability?: MediaCapabilityFilter;
}
export declare const IMAGE_EXTENSIONS: readonly ["jpg", "jpeg", "jfif", "png", "webp", "gif", "bmp", "tiff", "tif", "avif", "heic", "heif", "svg", "pxd"];
export declare const VIDEO_EXTENSIONS: readonly ["mp4", "webm", "mov", "avi", "mkv", "m4v", "ogg", "ogv", "flv", "wmv", "mpeg", "mpg", "3gp", "3g2", "ts", "mts", "m2ts"];
export declare const AUDIO_EXTENSIONS: readonly ["mp3", "wav", "ogg", "oga", "flac", "aac", "m4a", "webm", "opus", "aiff", "aif"];
export declare const DOCUMENT_EXTENSIONS: readonly ["pdf"];
export declare const EBOOK_EXTENSIONS: readonly ["epub"];
/**
 * Video extensions that mainstream browsers can usually play without
 * transcoding. Kept for backward compatibility with `videoNeedsTranscoding`.
 */
export declare const BROWSER_NATIVE_VIDEO: readonly ["mp4", "webm", "m4v", "ogg", "ogv"];
export declare const THUMBNAIL_IMAGE_EXTENSIONS: readonly ["jpg", "jpeg", "jfif", "png", "webp", "gif", "bmp", "tiff", "tif", "avif", "heic", "heif", "svg", "pxd"];
export declare const THUMBNAIL_VIDEO_EXTENSIONS: readonly ["mp4", "webm", "mov", "avi", "mkv", "m4v", "ogg", "ogv", "flv", "wmv", "mpeg", "mpg", "3gp", "3g2", "ts", "mts", "m2ts"];
export declare const THUMBNAIL_EBOOK_EXTENSIONS: readonly ["epub"];
export declare const THUMBNAIL_EXTENSIONS: readonly ["jpg", "jpeg", "jfif", "png", "webp", "gif", "bmp", "tiff", "tif", "avif", "heic", "heif", "svg", "pxd", "mp4", "webm", "mov", "avi", "mkv", "m4v", "ogg", "ogv", "flv", "wmv", "mpeg", "mpg", "3gp", "3g2", "ts", "mts", "m2ts", "epub"];
export declare const MEDIA_CAPABILITIES: readonly [{
    readonly extension: "jpg";
    readonly kind: "image";
    readonly mime: "image/jpeg";
    readonly mimeAliases: readonly ["image/jpg", "image/pjpeg"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "jpeg";
    readonly kind: "image";
    readonly mime: "image/jpeg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "jfif";
    readonly kind: "image";
    readonly mime: "image/jpeg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "png";
    readonly kind: "image";
    readonly mime: "image/png";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "webp";
    readonly kind: "image";
    readonly mime: "image/webp";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "gif";
    readonly kind: "image";
    readonly mime: "image/gif";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "bmp";
    readonly kind: "image";
    readonly mime: "image/bmp";
    readonly mimeAliases: readonly ["image/x-ms-bmp", "image/x-bmp"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "tiff";
    readonly kind: "image";
    readonly mime: "image/tiff";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "tif";
    readonly kind: "image";
    readonly mime: "image/tiff";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "avif";
    readonly kind: "image";
    readonly mime: "image/avif";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "heic";
    readonly kind: "image";
    readonly mime: "image/heic";
    readonly mimeAliases: readonly ["image/heif-sequence", "image/heic-sequence"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "heif";
    readonly kind: "image";
    readonly mime: "image/heif";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "svg";
    readonly kind: "image";
    readonly mime: "image/svg+xml";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "pxd";
    readonly kind: "image";
    readonly mime: "application/x-pixelmator-pxd";
    readonly mimeAliases: readonly ["application/x-pixelmator"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mp4";
    readonly kind: "video";
    readonly mime: "video/mp4";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "webm";
    readonly kind: "video";
    readonly mime: "video/webm";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "mov";
    readonly kind: "video";
    readonly mime: "video/quicktime";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "avi";
    readonly kind: "video";
    readonly mime: "video/x-msvideo";
    readonly mimeAliases: readonly ["video/avi"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mkv";
    readonly kind: "video";
    readonly mime: "video/x-matroska";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "m4v";
    readonly kind: "video";
    readonly mime: "video/x-m4v";
    readonly mimeAliases: readonly ["video/mp4"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "ogg";
    readonly kind: "video";
    readonly mime: "video/ogg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "ogv";
    readonly kind: "video";
    readonly mime: "video/ogg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "flv";
    readonly kind: "video";
    readonly mime: "video/x-flv";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "wmv";
    readonly kind: "video";
    readonly mime: "video/x-ms-wmv";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mpeg";
    readonly kind: "video";
    readonly mime: "video/mpeg";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mpg";
    readonly kind: "video";
    readonly mime: "video/mpeg";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "3gp";
    readonly kind: "video";
    readonly mime: "video/3gpp";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "3g2";
    readonly kind: "video";
    readonly mime: "video/3gpp2";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "ts";
    readonly kind: "video";
    readonly mime: "video/mp2t";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mts";
    readonly kind: "video";
    readonly mime: "video/mp2t";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "m2ts";
    readonly kind: "video";
    readonly mime: "video/mp2t";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mp3";
    readonly kind: "audio";
    readonly mime: "audio/mpeg";
    readonly mimeAliases: readonly ["audio/mp3"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "wav";
    readonly kind: "audio";
    readonly mime: "audio/wav";
    readonly mimeAliases: readonly ["audio/x-wav", "audio/wave"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "ogg";
    readonly kind: "audio";
    readonly mime: "audio/ogg";
    readonly mimeAliases: readonly ["application/ogg"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "oga";
    readonly kind: "audio";
    readonly mime: "audio/ogg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "flac";
    readonly kind: "audio";
    readonly mime: "audio/flac";
    readonly mimeAliases: readonly ["audio/x-flac"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "aac";
    readonly kind: "audio";
    readonly mime: "audio/aac";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "m4a";
    readonly kind: "audio";
    readonly mime: "audio/mp4";
    readonly mimeAliases: readonly ["audio/x-m4a"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "webm";
    readonly kind: "audio";
    readonly mime: "audio/webm";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "opus";
    readonly kind: "audio";
    readonly mime: "audio/opus";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "aiff";
    readonly kind: "audio";
    readonly mime: "audio/aiff";
    readonly mimeAliases: readonly ["audio/x-aiff"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: false;
}, {
    readonly extension: "aif";
    readonly kind: "audio";
    readonly mime: "audio/aiff";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: false;
}, {
    readonly extension: "pdf";
    readonly kind: "document";
    readonly mime: "application/pdf";
    readonly importable: false;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "epub";
    readonly kind: "ebook";
    readonly mime: "application/epub+zip";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}];
export declare const SUPPORTED_MEDIA_FORMATS: readonly [{
    readonly extension: "jpg";
    readonly kind: "image";
    readonly mime: "image/jpeg";
    readonly mimeAliases: readonly ["image/jpg", "image/pjpeg"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "jpeg";
    readonly kind: "image";
    readonly mime: "image/jpeg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "jfif";
    readonly kind: "image";
    readonly mime: "image/jpeg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "png";
    readonly kind: "image";
    readonly mime: "image/png";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "webp";
    readonly kind: "image";
    readonly mime: "image/webp";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "gif";
    readonly kind: "image";
    readonly mime: "image/gif";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "bmp";
    readonly kind: "image";
    readonly mime: "image/bmp";
    readonly mimeAliases: readonly ["image/x-ms-bmp", "image/x-bmp"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "tiff";
    readonly kind: "image";
    readonly mime: "image/tiff";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "tif";
    readonly kind: "image";
    readonly mime: "image/tiff";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "avif";
    readonly kind: "image";
    readonly mime: "image/avif";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "heic";
    readonly kind: "image";
    readonly mime: "image/heic";
    readonly mimeAliases: readonly ["image/heif-sequence", "image/heic-sequence"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "heif";
    readonly kind: "image";
    readonly mime: "image/heif";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "svg";
    readonly kind: "image";
    readonly mime: "image/svg+xml";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "pxd";
    readonly kind: "image";
    readonly mime: "application/x-pixelmator-pxd";
    readonly mimeAliases: readonly ["application/x-pixelmator"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mp4";
    readonly kind: "video";
    readonly mime: "video/mp4";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "webm";
    readonly kind: "video";
    readonly mime: "video/webm";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "mov";
    readonly kind: "video";
    readonly mime: "video/quicktime";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "avi";
    readonly kind: "video";
    readonly mime: "video/x-msvideo";
    readonly mimeAliases: readonly ["video/avi"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mkv";
    readonly kind: "video";
    readonly mime: "video/x-matroska";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "m4v";
    readonly kind: "video";
    readonly mime: "video/x-m4v";
    readonly mimeAliases: readonly ["video/mp4"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "ogg";
    readonly kind: "video";
    readonly mime: "video/ogg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "ogv";
    readonly kind: "video";
    readonly mime: "video/ogg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: true;
}, {
    readonly extension: "flv";
    readonly kind: "video";
    readonly mime: "video/x-flv";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "wmv";
    readonly kind: "video";
    readonly mime: "video/x-ms-wmv";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mpeg";
    readonly kind: "video";
    readonly mime: "video/mpeg";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mpg";
    readonly kind: "video";
    readonly mime: "video/mpeg";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "3gp";
    readonly kind: "video";
    readonly mime: "video/3gpp";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "3g2";
    readonly kind: "video";
    readonly mime: "video/3gpp2";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "ts";
    readonly kind: "video";
    readonly mime: "video/mp2t";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mts";
    readonly kind: "video";
    readonly mime: "video/mp2t";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "m2ts";
    readonly kind: "video";
    readonly mime: "video/mp2t";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}, {
    readonly extension: "mp3";
    readonly kind: "audio";
    readonly mime: "audio/mpeg";
    readonly mimeAliases: readonly ["audio/mp3"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "wav";
    readonly kind: "audio";
    readonly mime: "audio/wav";
    readonly mimeAliases: readonly ["audio/x-wav", "audio/wave"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "ogg";
    readonly kind: "audio";
    readonly mime: "audio/ogg";
    readonly mimeAliases: readonly ["application/ogg"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "oga";
    readonly kind: "audio";
    readonly mime: "audio/ogg";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "flac";
    readonly kind: "audio";
    readonly mime: "audio/flac";
    readonly mimeAliases: readonly ["audio/x-flac"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "aac";
    readonly kind: "audio";
    readonly mime: "audio/aac";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "m4a";
    readonly kind: "audio";
    readonly mime: "audio/mp4";
    readonly mimeAliases: readonly ["audio/x-m4a"];
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "webm";
    readonly kind: "audio";
    readonly mime: "audio/webm";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "opus";
    readonly kind: "audio";
    readonly mime: "audio/opus";
    readonly importable: true;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "aiff";
    readonly kind: "audio";
    readonly mime: "audio/aiff";
    readonly mimeAliases: readonly ["audio/x-aiff"];
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: false;
}, {
    readonly extension: "aif";
    readonly kind: "audio";
    readonly mime: "audio/aiff";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: false;
}, {
    readonly extension: "pdf";
    readonly kind: "document";
    readonly mime: "application/pdf";
    readonly importable: false;
    readonly previewable: true;
    readonly thumbnailable: false;
}, {
    readonly extension: "epub";
    readonly kind: "ebook";
    readonly mime: "application/epub+zip";
    readonly importable: true;
    readonly previewable: false;
    readonly thumbnailable: true;
}];
export declare const UNSUPPORTED_MEDIA_FORMATS: readonly [{
    readonly extension: "psd";
    readonly kind: "image";
    readonly mime: "image/vnd.adobe.photoshop";
    readonly reason: "Unsupported: this package does not include a PSD decoder, and the local Sharp/libvips build exposes no PSD input loader.";
}];
export declare const EXTENSION_TO_MIME: Readonly<Record<string, string>>;
export declare const MIME_TO_PREFERRED_EXTENSION: Readonly<Record<string, string>>;
export declare const MEDIA_KIND_BY_EXTENSION: Readonly<Record<string, MediaKind>>;
export declare const MIME_TO_MEDIA_KIND: Readonly<Record<string, MediaKind>>;
export declare const IMAGE_MIME_TYPES: readonly string[];
export declare const VIDEO_MIME_TYPES: readonly string[];
export declare const AUDIO_MIME_TYPES: readonly string[];
export declare const DOCUMENT_MIME_TYPES: readonly string[];
export declare const EBOOK_MIME_TYPES: readonly string[];
export declare const MEDIA_MIME_TYPES: readonly string[];
export declare const MEDIA_IMPORT_ACCEPT: string;
/**
 * Extract the lowercase extension of a filename or URL path without the dot.
 * Returns an empty string when the value has no extension.
 */
export declare function getFileExtension(filename: string): string;
/** Normalize a MIME type by lowercasing and removing parameters. */
export declare function normalizeMimeType(mimeType: string): string;
export declare function getMimeTypeForExtension(extensionOrFilename: string): string | undefined;
export declare function getPreferredExtensionForMime(mimeType: string): string | undefined;
export declare function getMediaKind(filenameOrMime: string): MediaKind | null;
export declare function isKnownExtension(extensionOrFilename: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function isKnownMimeType(mimeType: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function isSupportedExtension(extensionOrFilename: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function isSupportedMimeType(mimeType: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function isImageFile(filenameOrMime: string): boolean;
export declare function isVideoFile(filenameOrMime: string): boolean;
export declare function isAudioFile(filenameOrMime: string): boolean;
export declare function isMediaFile(filenameOrMime: string): boolean;
export declare function isImportableFile(filenameOrMime: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function isPreviewableFile(filenameOrMime: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function isThumbnailableFile(filenameOrMime: string, kinds?: MediaKind | readonly MediaKind[]): boolean;
export declare function videoNeedsTranscoding(filenameOrMime: string): boolean;
export declare function buildMediaAcceptString(options?: BuildMediaAcceptStringOptions): string;
/** Alias with shorter naming for `<input accept>` call sites. */
export declare const buildAcceptString: typeof buildMediaAcceptString;
export declare function isUnsupportedFormat(filenameOrMime: string): boolean;
export declare function getUnsupportedFormatReason(filenameOrMime: string): string | undefined;
//# sourceMappingURL=capabilities.d.ts.map