/**
 * Props for {@link VideoPlayer}.
 */
export interface VideoPlayerProps {
    /** Video source URL. Changing this resets playback and error state. */
    src: string;
    /** Title rendered in the header overlay. */
    title?: string;
    /** Extra class names for the outer container. */
    className?: string;
    /** Start playback on mount. Falls back to controls-visible when the browser blocks autoplay. */
    autoPlay?: boolean;
    /** Video intrinsic width — enables instant correct aspect ratio without layout shift. */
    videoWidth?: number;
    /** Video intrinsic height — enables instant correct aspect ratio without layout shift. */
    videoHeight?: number;
    /** Called when the video's metadata has loaded. */
    onLoad?: () => void;
}
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
export declare function VideoPlayer({ src, title, className, autoPlay, videoWidth, videoHeight, onLoad }: VideoPlayerProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=VideoPlayer.d.ts.map