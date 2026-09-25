# Heirloom ring stone preview: handover

Read this first in a new chat. It's the working state of the stone preview for the
**Modern Heirloom Birthstone Ring** (`modern-heirloom-birthstone-ring`) as of 25 Sep 2026.

## What's built

- **Customise slide-out** (theme code, heirloom only):
  - Files: `snippets/co-lab-picker.liquid`, `assets/co-lab-picker.{js,css}`.
  - The page has a select-style "Choose your gemstones & engraving" button that opens a
    right-hand drawer. It holds a pinned preview, full-width stone grids for the centre and
    halo, and an engraving box.
  - Confirm closes the drawer and opens the existing review modal.
  - Tapping the preview opens the theme's own full-screen gallery viewer on top of the drawer.
- **Stone preview images:** `assets/colab-heirloom-{metal}-{centre}-{halo}.jpg`.
  - 2 metals × 12 × 12 = 288 images, 1600px, on the live-site cream (#F2EDE5).
  - They're swapped in by `assets/co-lab-stone-preview.js`, and the image links carry a
    `?v=` version tag.
- **How each image is made.** No AI ring or stone is used anywhere now.
  - **Ring:** the client's real product photo, `pipeline/client/real07.jpg` for gold and
    `pipeline/packshots/silver.jpg` for silver.
  - **Centre stones:** the live picker's real stone images (`pipeline/icons_solid/`), scaled
    evenly to cover the opening, never stretched.
  - **May centre:** the client's own emerald, cut from their photo
    (`refs/emerald_cut.png`).
  - **Halo stones:** the client's real round stones, cut out of their ring photos and set into
    our 16 settings, which are template-matched (`slots_matched.json`).
    - August, March, June, July and September come straight from their photos.
    - The other seven are the same real stones recoloured to the picker colour.
  - **Client colour settings:** applied on top, from `pipeline/client_colours_2026-09-24.json`.
- **Heirloom Stone Tuner** (for the client): https://claude.ai/artifact/ALU3GY545aHKR5AasstyRu
  - The page is in `tuner/`.
  - It adjusts the halo stones only. The centres are fixed picker stones.
  - The client exports a JSON file, which is applied with `pipeline/rebuild.py`.
  - The page saves progress in the browser under a permanent key, with 20 rolling backups.

## Rebuild on any Mac

```bash
cd docs/colab/stone-preview/pipeline
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python rebuild.py client_colours_2026-09-24.json          # all 288 site images, client colours
.venv/bin/python rebuild.py client_colours_2026-09-24.json --tuner  # also refresh the tuner's images
```

A clean rebuild is verified to reproduce the committed images exactly, with zero pixel
difference.

Then push the images to the **Promise Co - Dev** theme, never live:

```bash
shopify theme push --store thepromiseringco --theme 197557649791 --nodelete --only 'assets/colab-heirloom-*-*-*.jpg'
```

**New client settings.** Save their JSON into `pipeline/` and run `rebuild.py <file>`. If it
was made against older images it prints a warning and applies it anyway.

**Republishing the tuner.** Run the Artifact tool with `file_path` set to
`docs/colab/stone-preview/tuner/index.html`, root `tuner/`, and the files listed in
`tuner/publish-files.json`. Pass the tuner's URL above as `url` so the same link updates.
Never change `STORE_KEY` in `index.html`, or the client's saved work disappears.

## Open items

1. **Silver looks off to the client.** The silver packshot has the halo slightly off-centre
   and flat-looking metal. A better silver photo from the client is the cleanest fix. Ask
   exactly what bothers her.
2. **The live picker's May stone** is the Emerald entry of the `birthstone` metaobject. It's
   shared by every Co-Lab product and not yet replaced. The ready file is
   `picker-stones/may_client_emerald.png`, also saved at 200×200 in Downloads. Changing it is
   a **live-site** change, so it needs the user's explicit OK.
3. **Six halos have no client photo:** January, February, May, October, November and
   December. They're recoloured real stones. Client photos of those would make them exact.
4. **Softer centres up close.** The picker stone files are only 200px, so zoomed in they're
   softer. Larger originals from the client would fix it.

## Gotchas learned the hard way

- **Never go back to AI-generated rings or centre stones.** Their geometry drifts between
  images, so transplanted stones misalign and the cut changes.
- **Measure stones by template-matching, not edge-fitting.** Edge fits lock onto the bezel.
  Size stones by neighbour spacing.
- **Protected AI rim clean-up doesn't work.** Gemini thickened the bezels and smudged the
  prongs (`23_ai_rim_cleanup_experiment.py`, kept for reference only).
- **OpenRouter key:** it's in 1Password as "Open Router Promise Co" and in each Mac's
  git-ignored `.env` as `OPENROUTER_API_KEY`. It's only needed for AI experiments, not for
  rebuilds.
