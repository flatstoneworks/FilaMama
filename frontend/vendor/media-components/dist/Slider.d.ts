import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
/**
 * Props accepted by {@link Slider}. Mirrors `@radix-ui/react-slider`'s
 * `Root` component, so refer to Radix documentation for the full API
 * (`value`, `min`, `max`, `step`, `onValueChange`, etc.).
 */
export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;
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
declare const Slider: React.ForwardRefExoticComponent<Omit<SliderPrimitive.SliderProps & React.RefAttributes<HTMLSpanElement>, "ref"> & React.RefAttributes<HTMLSpanElement>>;
export { Slider };
//# sourceMappingURL=Slider.d.ts.map