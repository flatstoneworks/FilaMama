import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback } from 'react';
import { cn } from './utils.js';
/** Minimum milliseconds between seek requests during hover-scrubbing. */
const SCRUB_THROTTLE_MS = 50;
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
export function VideoPreview({ src, posterUrl, className, width, height, aspectRatio = 'none', videoWidth, videoHeight, duration, objectFit = 'cover', onLoad, }) {
    const containerRef = useRef(null);
    const videoRef = useRef(null);
    const lastSeekAtRef = useRef(0);
    const [isHovering, setIsHovering] = useState(false);
    const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
    const [videoDuration, setVideoDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    // Reset transient state whenever `src` changes, using the "adjust state
    // during render" pattern so the next render is already correct.
    const [lastSrc, setLastSrc] = useState(src);
    if (lastSrc !== src) {
        setLastSrc(src);
        setIsMetadataLoaded(false);
        setVideoDuration(0);
        setCurrentTime(0);
        setIsHovering(false);
    }
    const handleMouseEnter = useCallback(() => {
        setIsHovering(true);
        // When a poster is provided we render with `preload="none"` so a grid of
        // previews does not eagerly fetch metadata for every tile. Ask the browser
        // to start loading now so scrubbing works on hover instead of only on the
        // next movement after metadata eventually arrives.
        const video = videoRef.current;
        if (video && !isMetadataLoaded)
            video.load();
    }, [isMetadataLoaded]);
    const handleMouseLeave = useCallback(() => {
        setIsHovering(false);
        setCurrentTime(0);
        const video = videoRef.current;
        if (video) {
            video.pause();
            // Seek before metadata has loaded throws InvalidStateError in some
            // browsers. The mousemove path can't hit this because it's guarded by
            // `isMetadataLoaded`, but this reset runs on leave regardless of state.
            try {
                video.currentTime = 0;
            }
            catch {
                // Ignore — metadata not ready yet.
            }
        }
    }, []);
    const handleMouseMove = useCallback((e) => {
        const container = containerRef.current;
        const video = videoRef.current;
        if (!container || !video || !isMetadataLoaded)
            return;
        const effectiveDuration = duration || videoDuration;
        if (!effectiveDuration || !isFinite(effectiveDuration))
            return;
        const now = Date.now();
        if (now - lastSeekAtRef.current < SCRUB_THROTTLE_MS)
            return;
        lastSeekAtRef.current = now;
        const rect = container.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetTime = percentage * effectiveDuration;
        video.currentTime = targetTime;
        setCurrentTime(targetTime);
    }, [isMetadataLoaded, duration, videoDuration]);
    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        setVideoDuration(video.duration);
        setIsMetadataLoaded(true);
        onLoad?.();
    }, [onLoad]);
    const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';
    const effectiveDuration = duration || videoDuration;
    const hasIntrinsicDimensions = !!(videoWidth && videoHeight && videoWidth > 0 && videoHeight > 0);
    const style = {};
    if (width)
        style.width = width;
    if (height)
        style.height = height;
    if (hasIntrinsicDimensions)
        style.aspectRatio = `${videoWidth} / ${videoHeight}`;
    // Show the poster only while not hovering; hiding it during hover lets the
    // <video> element underneath show through with the scrubbed frame.
    const showPoster = !!posterUrl && !isHovering;
    return (_jsxs("div", { ref: containerRef, className: cn('relative overflow-hidden', !hasIntrinsicDimensions && aspectRatio === 'video' && 'aspect-video', !hasIntrinsicDimensions && aspectRatio === 'square' && 'aspect-square', className), style: Object.keys(style).length ? style : undefined, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, onMouseMove: handleMouseMove, children: [_jsx("video", { ref: videoRef, src: src, className: cn('w-full h-full', fitClass), muted: true, playsInline: true, 
                // With a poster we lazy-load; otherwise fetch metadata so the first
                // frame is visible before any hover interaction.
                preload: posterUrl ? 'none' : 'metadata', onLoadedMetadata: handleLoadedMetadata }), showPoster && (_jsx("img", { src: posterUrl, alt: "Video poster", className: cn('absolute inset-0 w-full h-full', fitClass), loading: "lazy" })), isHovering && isMetadataLoaded && (_jsx("div", { className: "absolute bottom-0 left-0 right-0 h-1 bg-black/30", children: _jsx("div", { className: "h-full bg-white/80 transition-none", style: {
                        width: `${effectiveDuration ? (currentTime / effectiveDuration) * 100 : 0}%`,
                    } }) }))] }));
}
//# sourceMappingURL=VideoPreview.js.map