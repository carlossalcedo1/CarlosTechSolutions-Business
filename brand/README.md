# NexFix brand assets

The masters live here; `frontend/public/logo.svg` is a copy of
`nexfix-mark.svg` and is the only one the site actually loads.

| File | What it's for |
| --- | --- |
| `nexfix-lockup.svg` | Full lockup (monogram + NEXFIX + tagline). **Use this for business cards, signage, anything printed** — it's vector, so there's no resolution to run out of at any size. |
| `nexfix-lockup.png` | Same lockup at 1254px, for anywhere that won't take an SVG. At a 2in-wide card logo that's still ~600dpi. |
| `nexfix-mark.svg` | Monogram only, square viewBox, orange gradient. This is what ships as the site logo and favicon. |
| `nexfix-mark-flat.svg` | Monogram in one flat orange. Use when a single-colour mark is needed — embroidery, vinyl, a one-colour print run. |
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
