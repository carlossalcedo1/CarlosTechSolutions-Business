// The NexFix mark, wherever it appears at UI size.
//
// A raster at exactly 1x, 2x and 3x of the slot rather than the SVG, because
// this version of the mark has fold shading that a vector trace flattens
// away — and the shading is the detail worth having. Each size was resized
// once, carefully (Lanczos), from brand/nexfix-mark-detailed.png; left to
// the browser, an 8x downscale of one big image comes out mushier. The
// browser tab keeps the traced SVG (public/logo.svg): at 16px the shading
// can't be seen, and a vector stays sharp there where a raster goes soft.
//
// alt="" on purpose: it always sits beside the "NexFix" wordmark, so a
// screen reader announcing it too would just say the name twice.
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src="/logo-32.png"
      srcSet="/logo-32.png 1x, /logo-64.png 2x, /logo-96.png 3x"
      alt=""
      width={32}
      height={32}
      className={className}
    />
  );
}
