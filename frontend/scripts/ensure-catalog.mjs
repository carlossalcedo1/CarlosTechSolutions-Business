// Runs before `npm run dev` and `npm run build` (the predev/prebuild hooks).
//
// items.json is gitignored — inventory is local to each computer, see
// docs/ADDING_INVENTORY.md — so a fresh clone doesn't have it. The site
// imports it directly, so without it the build fails outright. Create an
// empty catalog instead. Never touches a file that already exists.
import { existsSync, writeFileSync } from "node:fs";

const catalog = new URL("../src/data/items.json", import.meta.url);

if (!existsSync(catalog)) {
  writeFileSync(catalog, "[]\n");
  console.log(
    "Created an empty src/data/items.json — inventory isn't in git; see docs/ADDING_INVENTORY.md.",
  );
}
