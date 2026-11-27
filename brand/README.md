# NexFix brand assets

The masters live here. What the site loads, and why each:

- **Header and footer** — `frontend/public/logo-32.png`, `-64`, `-96`, cut
  from `nexfix-mark-detailed.png` at exactly 1x/2x/3x. A raster on purpose:
  this version of the mark has fold shading, and a vector trace flattens it.
- **Browser tab** — `frontend/public/logo.svg` (a copy of `nexfix-mark.svg`),
  plus `favicon-32.png` for browsers that won't take an SVG. At 16px the
  shading can't be seen, and a vector stays sharp where a raster goes soft.
- **iPhone home screen** — `frontend/public/apple-touch-icon.png`, on white,
  because iOS paints a transparent icon's background black.

| File | What it's for |
| --- | --- |
| `nexfix-lockup.svg` | Full lockup (monogram + NEXFIX + tagline). **Use this for business cards, signage, anything printed** — it's vector, so there's no resolution to run out of at any size. |
| `nexfix-lockup.png` | Same lockup at 1254px, for anywhere that won't take an SVG. At a 2in-wide card logo that's still ~600dpi. |
| `nexfix-mark-detailed.png` | **The current mark**, with its fold shading — 1024px, transparent, edges un-blended from white so there's no halo on dark backgrounds. Source of every raster the site uses. |
| `nexfix-mark-detailed-source.webp` | The artwork it was cut from, as supplied. |
| `nexfix-mark.svg` | The detailed mark's outline traced to vector, under a gradient sampled from it. Ships as the favicon. |
| `nexfix-mark-flat.svg` | Same outline in one flat orange. Use when a single-colour mark is needed — embroidery, vinyl, a one-colour print run. |
| `nexfix-source-blue.webp` | The original supplied artwork, still blue. Kept so the recolour can be redone from source if the brand orange ever changes. |

## How the orange was made

The supplied artwork was blue (`#1087FE`). Everything orange here is that
same artwork with its hue rotated to 24°, which lands on `#FE6F10`. The
rotation was gated on brightness so only the bright blue moved — the navy in
`NEX` and the tagline sits at the same hue but a fifth of the brightness, and
would otherwise have gone brown.

The SVGs were traced from the recoloured raster rather than redrawn, so the
letterforms and the wrench cut-out are the artwork's own geometry, not an
approximation of it. The trace flattens the original's gradient-and-drop-
shadow shading into either a two-stop gradient (`nexfix-mark.svg`) or one
flat fill (`nexfix-mark-flat.svg`); at favicon size that shading was never
visible anyway, and losing it is what makes the mark hold up at 16px.

## The lockup is still the first version

`nexfix-lockup.svg` and `.png` (mark plus NEXFIX wordmark plus tagline) were
traced from the first artwork, before the detailed mark replaced it. The N in
them is the older, flatter one. Fine for now; redo it from
`nexfix-mark-detailed.png` before the business cards are printed.
