/**
 * Shared utilities for media components — class-name merging, filename
 * classification, and time formatting. All exports are pure and safe for
 * browser and Node.
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export { AUDIO_EXTENSIONS, BROWSER_NATIVE_VIDEO, DOCUMENT_EXTENSIONS, EBOOK_EXTENSIONS, EXTENSION_TO_MIME, IMAGE_EXTENSIONS, IMAGE_MIME_TYPES, MEDIA_CAPABILITIES, MEDIA_IMPORT_ACCEPT, MEDIA_KIND_BY_EXTENSION, MEDIA_MIME_TYPES, MIME_TO_MEDIA_KIND, MIME_TO_PREFERRED_EXTENSION, SUPPORTED_MEDIA_FORMATS, THUMBNAIL_EBOOK_EXTENSIONS, THUMBNAIL_EXTENSIONS, THUMBNAIL_IMAGE_EXTENSIONS, THUMBNAIL_VIDEO_EXTENSIONS, UNSUPPORTED_MEDIA_FORMATS, VIDEO_EXTENSIONS, VIDEO_MIME_TYPES, AUDIO_MIME_TYPES, DOCUMENT_MIME_TYPES, EBOOK_MIME_TYPES, buildAcceptString, buildMediaAcceptString, getFileExtension, getMediaKind, getMimeTypeForExtension, getPreferredExtensionForMime, getUnsupportedFormatReason, isAudioFile, isImageFile, isImportableFile, isKnownExtension, isKnownMimeType, isMediaFile, isPreviewableFile, isSupportedExtension, isSupportedMimeType, isThumbnailableFile, isUnsupportedFormat, isVideoFile, normalizeMimeType, videoNeedsTranscoding, } from './capabilities.js';
/**
 * Merge Tailwind CSS class names, resolving conflicts via `tailwind-merge`.
 * Accepts the same inputs as `clsx` (strings, arrays, objects, falsy values).
 *
 * @example
 * cn('px-2', condition && 'px-4') // 'px-4' when condition is true, else 'px-2'
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * Format a duration in seconds as `M:SS` or `H:MM:SS`. Negative, `NaN`, and
 * non-finite values render as `'0:00'`.
 *
 * @example
 * formatVideoTime(65)    // '1:05'
 * formatVideoTime(3661)  // '1:01:01'
 */
export function formatVideoTime(seconds) {
    if (!isFinite(seconds) || seconds < 0)
        return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ss = secs.toString().padStart(2, '0');
    if (hours > 0) {
        const mm = minutes.toString().padStart(2, '0');
        return `${hours}:${mm}:${ss}`;
    }
    return `${minutes}:${ss}`;
}
//# sourceMappingURL=utils.js.map