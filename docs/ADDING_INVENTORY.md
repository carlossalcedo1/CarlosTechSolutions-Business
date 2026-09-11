# Adding inventory

How to put a device on the site. Takes about a minute per item.

## One-time setup

```bash
pip3 install -r backend/requirements.txt
```

That installs Pydantic (validates what you type), Pillow (resizes photos), and
pillow-heif (lets Pillow read iPhone HEICs). You only ever do this once.

On a fresh Linux box you may need `sudo apt install python3-pip` first.

## Adding a device

Get your photos onto the laptop first — AirDrop, cable, whatever. Then, from
the project root:

```bash
python3 backend/scripts/add_item.py
```

Answer the prompts. Nothing is saved until every answer passes validation, so
a typo stops the script rather than reaching the live site.

### What each prompt wants

| Prompt | What it's for |
|---|---|
| **Device name** | Shows as the page title. Also becomes the URL — "iPhone 14 Pro 256GB" becomes `/product/iphone-14-pro-256gb` |
| **Category** | Pick a number. Drives the shop filters |
| **Brand** | Press Enter for Apple, or type another. Drives the brand dropdown |
| **Condition** | Pick a number. Shows as the coloured badge |
| **Price** | `289` or `289.99`, with or without the `$` |
| **Short spec line** | The one grey line under the name on cards, e.g. `256GB . Unlocked` |
| **Spec bullets** | One per line, Enter twice when done. These are the bullets on the product page |
| **Description** | One paragraph, in your voice. Mention factory-unlocked status here |
| **Feature on homepage?** | Enter for no |
| **Photos** | See below |

### Photos

You have three ways to give it photos. **On Linux, typing a folder or a glob
is the reliable one** — drag-and-drop behaviour varies between terminals:

```
~/Pictures/iphone14                 a whole folder (all images inside, in order)
~/Pictures/iphone14/*.heic          a glob
~/Pictures/iphone14/front.heic ...  individual paths, space separated
```

Drag-and-drop does work, but what lands in the terminal differs by
environment. GNOME Terminal pastes `file:///home/you/photo%20one.heic` URIs,
macOS pastes `/Users/you/photo\ one.heic`, and some terminals paste nothing at
all. The script understands URIs, percent-encoded spaces, escaped spaces,
quotes and `~` — so dragging is fine when your terminal supports it, and the
folder/glob approach is there when it doesn't.

Order matters: **the first photo is the one shop cards use**, so lead with your
best angle. Folders and globs are taken in filename order, so `1-front.heic`,
`2-back.heic` gives you control. Three or four photos is plenty.

Press Enter with nothing typed to skip photos for now.

### Photo formats

**Shoot in whatever your phone shoots in.** iPhone HEIC, PNG, JPEG, WebP, TIFF,
BMP and GIF all work as input — you don't need to convert anything first.

Everything is converted to **JPEG on the way out**, because browsers can't
reliably display HEIC. Chrome and Firefox won't render it at all, so an HEIC
served directly would be a broken image for most of your visitors. Converting
at intake means the format question never reaches the website.

Three things happen automatically to each photo:

- **Resized** to 1600px wide and compressed. A 4MB camera shot lands around
  100-200KB, which keeps pages fast and makes copying inventory between
  computers quick
- **Rotated upright.** Phones store rotation as an EXIF flag rather than
  rotating the actual pixels, so portrait shots would otherwise appear sideways
  on the site
- **Transparency flattened onto white**, so a cut-out PNG doesn't come out with
  a black background

They're saved as `frontend/public/items/<item-id>/1.jpg`, `2.jpg`, and so on.

## Check it, then ship it

The dev server picks up the change immediately:

```bash
cd frontend && npm run dev
```

Look at the item, then deploy when you're happy with it.

## Inventory lives on your computer, not in git

The catalog and its photos are gitignored, so each computer keeps its own
copy and `git pull` never brings inventory along. To move it — to another
computer, or onto the server before a deploy — copy both by hand:

- `frontend/src/data/items.json` — the catalog
- `frontend/public/items/` — the photos

Copy them together: an item whose photo folder didn't come along shows
broken images.

- **On the server,** `deploy.sh` stops with a clear message if the catalog is
  missing, rather than shipping an empty store by accident
- **On a fresh clone,** `npm run dev` / `npm run build` create an empty
  catalog so the site still runs, and `add_item.py` starts from it
- **Back it up yourself.** Git isn't keeping history of it anymore, so drop a
  copy of both into iCloud/Dropbox after each batch you add

## Fixing or removing an item

There's no CLI for this yet. Both live in `frontend/src/data/items.json`:

- **Change a price or a typo** — edit the entry directly. Remember prices are
  in **cents**: `$749.99` is `74999`
- **Remove a sold item** — delete its `{ ... }` block from the array, and
  delete its photo folder from `frontend/public/items/`

Run `npm run build` afterwards. If you broke the JSON, the build fails and
tells you where — your live site is untouched until a build succeeds.

## When something goes wrong

**`ModuleNotFoundError: No module named 'pydantic'`**
Run the setup command at the top.

**`id 'x' already exists`**
You've listed a device with that name before. It'll ask you for a unique id —
add a distinguishing detail, like `iphone-13-128-blue`.

**`couldn't read IMG_1234.HEIC`**
pillow-heif didn't install. Re-run the setup command. On Linux, if it still
fails, `sudo apt install libheif1` then try again.

**A photo path wasn't found**
Dragging usually gets it right. If you typed the path by hand and it has
spaces, wrap it in quotes.

**The item saved but photos didn't attach**
Add them by hand: drop the files in `frontend/public/items/<item-id>/` named
`1.jpg`, `2.jpg`, and list them in that item's `images` array as
`/items/<item-id>/1.jpg`.
