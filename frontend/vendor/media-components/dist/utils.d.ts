/**
 * Shared utilities for media components — class-name merging, filename
 * classification, and time formatting. All exports are pure and safe for
 * browser and Node.
 */
import { type ClassValue } from 'clsx';
export { AUDIO_EXTENSIONS, BROWSER_NATIVE_VIDEO, DOCUMENT_EXTENSIONS, EBOOK_EXTENSIONS, EXTENSION_TO_MIME, IMAGE_EXTENSIONS, IMAGE_MIME_TYPES, MEDIA_CAPABILITIES, MEDIA_IMPORT_ACCEPT, MEDIA_KIND_BY_EXTENSION, MEDIA_MIME_TYPES, MIME_TO_MEDIA_KIND, MIME_TO_PREFERRED_EXTENSION, SUPPORTED_MEDIA_FORMATS, THUMBNAIL_EBOOK_EXTENSIONS, THUMBNAIL_EXTENSIONS, THUMBNAIL_IMAGE_EXTENSIONS, THUMBNAIL_VIDEO_EXTENSIONS, UNSUPPORTED_MEDIA_FORMATS, VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, AUDIO_MIME_TYPES, DOCUMENT_MIME_TYPES, EBOOK_MIME_TYPES, buildAcceptString, buildMediaAcceptString, getFileExtension, getMediaKind, getMimeTypeForExtension, getPreferredExtensionForMime, getUnsupportedFormatReason, isAudioFile, isImageFile, isImportableFile, isKnownExtension, isKnownMimeType, isMediaFile, isPreviewableFile, isSupportedExtension, isSupportedMimeType, isThumbnailableFile, isUnsupportedFormat, isVideoFile, normalizeMimeType, videoNeedsTranscoding, } from './capabilities.js';
export type { BuildMediaAcceptStringOptions, MediaCapability, MediaCapabilityFilter, MediaKind, } from './capabilities.js';
/**
 * Merge Tailwind CSS class names, resolving conflicts via `tailwind-merge`.
 * Accepts the same inputs as `clsx` (strings, arrays, objects, falsy values).
 *
 * @example
 * cn('px-2', condition && 'px-4') // 'px-4' when condition is true, else 'px-2'
 */
export declare function cn(...inputs: ClassValue[]): string;
/**
 * Format a duration in seconds as `M:SS` or `H:MM:SS`. Negative, `NaN`, and
 * non-finite values render as `'0:00'`.
 *
 * @example
 * formatVideoTime(65)    // '1:05'
 * formatVideoTime(3661)  // '1:01:01'
 */
export declare function formatVideoTime(seconds: number): string;
//# sourceMappingURL=utils.d.ts.map