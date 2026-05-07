import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import { cn, formatVideoTime } from './utils.js';
import { Slider } from './Slider.js';
/**
 * Full-featured video player with standard controls, a playback speed menu,
 * fullscreen support, and keyboard shortcuts (scoped to the player container
 * so multiple players on one page do not conflict).
 *
 * ### Keyboard shortcuts (when the player has focus)
 * - `Space` / `K` — toggle play
 * - `J` / `←` — skip back 10s
 * - `L` / `→` — skip forward 10s
 * - `↑` / `↓` — volume up/down
 * - `M` — toggle mute
 * - `F` — toggle fullscreen
 * - `0`–`9` — jump to 0–90%
 * - `Escape` — close the speed menu
 */
export function VideoPlayer({ src, title, className, autoPlay, videoWidth, videoHeight, onLoad }) {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    // Reset transient state on src change. Using the "adjust state during render"
    // pattern rather than a useEffect so we don't render a stale frame first.
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [lastSrc, setLastSrc] = useState(src);
    if (lastSrc !== src) {
        setLastSrc(src);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(true);
        setError(null);
        setShowSpeedMenu(false);
    }
    // --- Controls visibility --------------------------------------------------
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }
        if (isPlaying) {
            controlsTimeoutRef.current = window.setTimeout(() => {
                setShowControls(false);
                setShowSpeedMenu(false);
            }, 3000);
        }
    }, [isPlaying]);
    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current)
                clearTimeout(controlsTimeoutRef.current);
        };
    }, []);
    // --- Video <-> state synchronisation --------------------------------------
    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video)
            return;
        setDuration(video.duration);
        setVolume(video.volume);
        setIsMuted(video.muted);
        setIsLoading(false);
        onLoad?.();
    };
    const handleTimeUpdate = () => {
        if (videoRef.current)
            setCurrentTime(videoRef.current.currentTime);
    };
    const handleVolumeChangeEvent = () => {
        const video = videoRef.current;
        if (!video)
            return;
        setVolume(video.volume);
        setIsMuted(video.muted || video.volume === 0);
    };
    const handleRateChange = () => {
        if (videoRef.current)
            setPlaybackSpeed(videoRef.current.playbackRate);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
        setIsPlaying(false);
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }
    };
    const handleEnded = () => {
        setIsPlaying(false);
        setShowControls(true);
    };
    const handleError = () => {
        const mediaError = videoRef.current?.error;
        const messages = {
            1: 'Video loading was aborted.',
            2: 'A network error occurred while loading the video.',
            3: 'The video could not be decoded. The format may not be supported.',
            4: 'The video format is not supported by your browser.',
        };
        setError(messages[mediaError?.code ?? 0] ?? 'Failed to load video.');
        setIsLoading(false);
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    // --- Commands (all mutate the DOM element; React state follows via events) -
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        if (video.paused) {
            video.play().catch(() => { });
        }
        else {
            video.pause();
        }
    }, []);
    const seek = useCallback((time) => {
        const video = videoRef.current;
        if (!video)
            return;
        video.currentTime = Math.max(0, Math.min(time, duration));
    }, [duration]);
    const seekRelative = useCallback((delta) => {
        const video = videoRef.current;
        if (!video)
            return;
        seek(video.currentTime + delta);
    }, [seek]);
    const applyVolume = useCallback((value) => {
        const video = videoRef.current;
        if (!video)
            return;
        const clamped = Math.max(0, Math.min(1, value));
        video.volume = clamped;
        video.muted = clamped === 0;
    }, []);
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        video.muted = !video.muted;
    }, []);
    const setSpeed = useCallback((speed) => {
        const video = videoRef.current;
        if (!video)
            return;
        video.playbackRate = speed;
        setShowSpeedMenu(false);
    }, []);
    const toggleFullscreen = useCallback(async () => {
        if (!containerRef.current)
            return;
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            else {
                await containerRef.current.requestFullscreen();
            }
        }
        catch {
            // Fullscreen may be blocked by browser policy or user denial.
        }
    }, []);
    const jumpToPercent = useCallback((percent) => {
        seek(duration * (percent / 100));
    }, [duration, seek]);
    // --- Fullscreen change listener ------------------------------------------
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);
    // --- Keyboard shortcuts --------------------------------------------------
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
        const handleKeyDown = (e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            if (e.key === 'Escape') {
                setShowSpeedMenu(false);
                return;
            }
            showControlsTemporarily();
            // Digit keys 0–9 jump to 0%–90%.
            if (e.key.length === 1 && e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                jumpToPercent(parseInt(e.key, 10) * 10);
                return;
            }
            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'arrowleft':
                case 'j':
                    e.preventDefault();
                    seekRelative(-10);
                    break;
                case 'arrowright':
                case 'l':
                    e.preventDefault();
                    seekRelative(10);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    // Read the live volume from the DOM element rather than React state
                    // so this handler doesn't depend on `volume` — otherwise holding the
                    // key would reattach the listener on every volumechange event.
                    applyVolume((videoRef.current?.volume ?? 0) + 0.1);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    applyVolume((videoRef.current?.volume ?? 0) - 0.1);
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
            }
        };
        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, seekRelative, applyVolume, toggleMute, toggleFullscreen, jumpToPercent, showControlsTemporarily]);
    // --- Autoplay on mount / src change --------------------------------------
    useEffect(() => {
        if (!autoPlay)
            return;
        const video = videoRef.current;
        if (!video)
            return;
        video.play().catch(() => {
            // Autoplay blocked — show controls so the user can play manually.
            setShowControls(true);
        });
    }, [autoPlay, src]);
    // --- Render --------------------------------------------------------------
    const hasIntrinsicDimensions = !!(videoWidth && videoHeight && videoWidth > 0 && videoHeight > 0);
    const containerStyle = hasIntrinsicDimensions
        ? { aspectRatio: `${videoWidth} / ${videoHeight}` }
        : undefined;
    return (_jsxs("div", { ref: containerRef, tabIndex: 0, style: containerStyle, className: cn('relative flex flex-col bg-black outline-none', isFullscreen ? 'w-screen h-screen' : className || 'max-h-[85vh] max-w-[85vw]'), onMouseMove: showControlsTemporarily, onMouseLeave: () => isPlaying && setShowControls(false), children: [title && (_jsx("div", { className: cn('absolute top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300', showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'), children: _jsx("span", { className: "text-white font-medium truncate", children: title }) })), _jsxs("div", { className: "flex-1 flex items-center justify-center cursor-pointer relative min-h-0 overflow-hidden", onClick: togglePlay, children: [isLoading && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-black/50 z-10", children: _jsx(Loader2, { className: "h-12 w-12 text-white animate-spin" }) })), error ? (_jsxs("div", { className: "flex flex-col items-center justify-center gap-4 p-8", children: [_jsx("p", { className: "text-red-400 text-sm text-center", children: error }), _jsx("p", { className: "text-zinc-500 text-xs", children: "Try downloading the file instead" })] })) : (_jsx("video", { ref: videoRef, src: src, className: "max-w-full max-h-full object-contain", onLoadedMetadata: handleLoadedMetadata, onTimeUpdate: handleTimeUpdate, onVolumeChange: handleVolumeChangeEvent, onRateChange: handleRateChange, onPlay: handlePlay, onPause: handlePause, onEnded: handleEnded, onError: handleError, onWaiting: handleWaiting, onCanPlay: handleCanPlay, playsInline: true })), !isPlaying && !isLoading && !error && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: _jsx("div", { className: "bg-black/50 rounded-full p-4", children: _jsx(Play, { className: "h-12 w-12 text-white", fill: "white" }) }) }))] }), _jsx(VideoControlsBar, { isPlaying: isPlaying, isMuted: isMuted, volume: volume, currentTime: currentTime, duration: duration, isFullscreen: isFullscreen, playbackSpeed: playbackSpeed, showSpeedMenu: showSpeedMenu, onTogglePlay: togglePlay, onSkip: seekRelative, onSeek: (t) => seek(t), onVolumeChange: applyVolume, onToggleMute: toggleMute, onToggleSpeedMenu: () => setShowSpeedMenu((v) => !v), onSelectSpeed: setSpeed, onToggleFullscreen: toggleFullscreen })] }));
}
// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
function IconButton({ className, children, ...props }) {
    return (_jsx("button", { className: cn('inline-flex items-center justify-center rounded-md transition-colors', 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white', 'disabled:pointer-events-none disabled:opacity-50', className), ...props, children: children }));
}
function VideoControlsBar({ isPlaying, isMuted, volume, currentTime, duration, isFullscreen, playbackSpeed, showSpeedMenu, onTogglePlay, onSkip, onSeek, onVolumeChange, onToggleMute, onToggleSpeedMenu, onSelectSpeed, onToggleFullscreen, }) {
    return (_jsxs("div", { className: "relative z-20 bg-black/90 flex-shrink-0", onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "px-4 pt-4", children: _jsx(Slider, { value: [currentTime], min: 0, max: duration || 100, step: 0.1, onValueChange: (v) => onSeek(v[0]), className: "cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3" }) }), _jsxs("div", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(IconButton, { className: "h-9 w-9 text-white hover:bg-white/20", onClick: onTogglePlay, "aria-label": isPlaying ? 'Pause' : 'Play', children: isPlaying ? _jsx(Pause, { className: "h-5 w-5", fill: "white" }) : _jsx(Play, { className: "h-5 w-5", fill: "white" }) }), _jsx(IconButton, { className: "h-9 w-9 text-white hover:bg-white/20", onClick: () => onSkip(-10), "aria-label": "Skip back 10 seconds", children: _jsx(SkipBack, { className: "h-5 w-5" }) }), _jsx(IconButton, { className: "h-9 w-9 text-white hover:bg-white/20", onClick: () => onSkip(10), "aria-label": "Skip forward 10 seconds", children: _jsx(SkipForward, { className: "h-5 w-5" }) }), _jsxs("span", { className: "text-white text-sm ml-2 font-mono", children: [formatVideoTime(currentTime), " / ", formatVideoTime(duration)] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(IconButton, { className: "h-9 w-9 text-white hover:bg-white/20", onClick: onToggleMute, "aria-label": isMuted || volume === 0 ? 'Unmute' : 'Mute', children: isMuted || volume === 0 ? _jsx(VolumeX, { className: "h-5 w-5" }) : _jsx(Volume2, { className: "h-5 w-5" }) }), _jsx("div", { className: "w-24 hidden sm:block", children: _jsx(Slider, { value: [isMuted ? 0 : volume], min: 0, max: 1, step: 0.01, onValueChange: (v) => onVolumeChange(v[0]), className: "cursor-pointer" }) }), _jsxs("div", { className: "relative", children: [_jsxs(IconButton, { className: "h-9 px-2 text-white hover:bg-white/20 text-sm font-mono", onClick: onToggleSpeedMenu, "aria-label": `Playback speed ${playbackSpeed}x`, "aria-expanded": showSpeedMenu, children: [playbackSpeed, "x"] }), showSpeedMenu && (_jsx("div", { className: "absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden", children: PLAYBACK_SPEEDS.map((speed) => (_jsxs("button", { className: cn('block w-full px-4 py-2 text-sm text-left hover:bg-zinc-800', speed === playbackSpeed ? 'text-white bg-zinc-800' : 'text-zinc-300'), onClick: () => onSelectSpeed(speed), children: [speed, "x"] }, speed))) }))] }), _jsx(IconButton, { className: "h-9 w-9 text-white hover:bg-white/20", onClick: onToggleFullscreen, "aria-label": isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', children: isFullscreen ? _jsx(Minimize, { className: "h-5 w-5" }) : _jsx(Maximize, { className: "h-5 w-5" }) })] })] })] }));
}
//# sourceMappingURL=VideoPlayer.js.map