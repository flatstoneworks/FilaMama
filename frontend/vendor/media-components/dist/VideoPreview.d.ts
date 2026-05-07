export interface VideoPreviewProps {
    /** Video source URL. */
    src: string;
    /** Optional static poster image shown until the user hovers. */
    posterUrl?: string;
    /** Extra class names for the container element. */
    className?: string;
    /** Fixed width in pixels. */
    width?: number;
    /** Fixed height in pixels. */
    height?: number;
    /**
     * Aspect-ratio constraint used when no intrinsic dimensions are provided.
     * Defaults to `'none'` so the parent controls sizing.
     */
    aspectRatio?: 'video' | 'square' | 'none';
    /** Video intrinsic width — sets CSS `aspect-ratio` to avoid layout shift. */
    videoWidth?: number;
    /** Video intrinsic height — sets CSS `aspect-ratio` to avoid layout shift. */
    videoHeight?: number;
    /** Override the video's metadata-reported duration when computing scrub position. */
    duration?: number;
    /** `object-fit` mode for the displayed media. Defaults to `'cover'`. */
    objectFit?: 'cover' | 'contain';
    /** Called once video metadata has loaded. */
    onLoad?: () => void;
}
/**
 * Interactive video thumbnail. The user sees a static poster (or the paused
 * first frame of the video) until they hover; hovering converts horizontal
 * mouse position into a seek on the underlying `<video>` element, which
 * scrubs the preview in place.
 *
 * The component renders a single `<video>` element and relies on the browser
 * to paint the current frame — there is no canvas, no `toDataURL`, and no
 * cross-origin fetch required.
 *
 * @remarks
 * When `posterUrl` is not provided the `<video>` uses `preload="metadata"` so
 * the first frame is available without downloading the whole file. The video
 * is muted and `playsInline` so it never produces audio or enters fullscreen.
 */
export declare function VideoPreview({ src, posterUrl, className, width, height, aspectRatio, videoWidth, videoHeight, duration, objectFit, onLoad, }: VideoPreviewProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=VideoPreview.d.ts.map