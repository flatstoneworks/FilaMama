import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from './utils.js';
/**
 * Styled range input built on `@radix-ui/react-slider`.
 *
 * The default appearance is tuned for dark backgrounds: a semi-transparent
 * white track, solid white range fill, and a white thumb with a subtle
 * border. Override any of this via the `className` prop — Tailwind classes
 * are merged via `cn` so conflicts resolve predictably.
 *
 * @example
 * <Slider value={[50]} min={0} max={100} step={1} onValueChange={...} />
 */
const Slider = React.forwardRef(({ className, ...props }, ref) => (_jsxs(SliderPrimitive.Root, { ref: ref, className: cn('relative flex w-full touch-none select-none items-center', className), ...props, children: [_jsx(SliderPrimitive.Track, { className: "relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/20", children: _jsx(SliderPrimitive.Range, { className: "absolute h-full bg-white" }) }), _jsx(SliderPrimitive.Thumb, { className: "block h-4 w-4 rounded-full border border-white/50 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50" })] })));
Slider.displayName = SliderPrimitive.Root.displayName;
export { Slider };
//# sourceMappingURL=Slider.js.map