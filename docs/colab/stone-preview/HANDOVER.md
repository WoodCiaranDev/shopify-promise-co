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

## Silver = the finished gold, turned silver (26 Sep 2026)

Charlotte asked for the silver images to be the approved gold rings with only the metal turned
silver. `pipeline/gold_to_silver.py` does that inside `rebuild.py`:

- **Metal away from stones:** every warm pixel is converted, so no gold survives, including
  orange-looking gold in shadow and the small beads.
- **Around stones:** only the gold hue band (45-100 in OKLab) is converted, so stone colour is
  never touched. The centre stone and each halo stone's core are protected outright.
- **Bezel lip:** the lip is found on the donor's own gold transplant, because the recoloured
  halos (pink, champagne and so on) have a tinted lip that no longer reads as gold.
- **Silver tone:** metal lightness is mapped onto the real silver packshot's metal, with a
  neutral tint.
- **Checking:** `check_no_gold.py <files>` counts gold-hued pixels outside stones. It should
  be near zero, apart from champagne and apple green, whose own colour sits near gold.
- **Current settings:** the client's settings are in `client_colours_2026-09-27.json`, which
  includes her latest October and March halo edits.

The silver packshot (`packshots/silver.jpg`) is no longer used for images, only for the
silver metal tone.

## Clean settings (27 Sep 2026)

- **What was wrong.** The olive halo stones of the original gold photo showed as green crescents
  wherever a transplanted stone didn't cover its setting exactly.
- **Clean base.** `pipeline/base_openings.py` `clean_base()` removes every original halo stone.
  Each setting is refilled with the bezel's own colour just outside it, sampled round the
  circle, which gives a clean gold cup. It's saved as `photo/gold_clean_base.jpg`, and
  `build.py` uses it for gold.
- **Transplanted stones.** `pipeline/regen_transplants.py` rebuilds all 12
  `transplants_ps/gold_*.jpg` on that base.
  - Only the stone core, 0.88 × the setting radius (`CORE`), is pasted, so the gold cup forms
    the rim.
  - Donor stones whose core catches their own bezel are dropped.
  - The seven recoloured halos are recoloured in the donor photo before pasting, so no halo
    forms round them.
  - Run it before `rebuild.py` whenever the donors or the base change.
- **Client colour settings** apply only inside the 0.88r stone core (`weight_halo_*` in
  `rebuild.py`), so the metal is never tinted.
- **Silver.** `gold_to_silver.py` treats everything outside 0.855r of a halo stone as metal.
  It also converts strong gold hues inside the stone cores, except for November (champagne),
  whose colour overlaps gold.

## August and April halo fixes (28 Sep 2026)

- **August top-right stone was cut off.** Donor stone 10 in `refs/3.png` has a pale strip of
  bezel across its top. The metal check only sees gold hues, so it missed it. It's now dropped
  by hand (`DROP` in `regen_transplants.py`), and that setting takes the next-nearest stone.
- **April (diamond simulant) read slightly blue.** Recolouring the March donor left a cool cast.
  `neutralise_stones()` now shifts the April stones to a neutral median and damps what chroma is
  left. Lightness, and so the sparkle, is untouched.
- **Only the April and August images were committed.** A full rebuild also moves a few dozen
  pixels by up to 13 levels in other halos, which is invisible. Those were restored from git to
  keep the change small, and the version file was recomputed.
- **Checking Dev images:** fetch them with the page's own `?v=` tag. Any other query string can
  return a stale CDN copy.

## Champagne on silver (29 Sep 2026)

- **What was wrong.** Champagne sits in the gold hue band, so on silver its yellow-green facets read
  as leftover gold, and its saturated edge stopped dead against grey. The stones looked olive and
  too small for their settings.
- **Fix.** `_champagne_on_silver()` in `gold_to_silver.py` runs for the November halo on silver.
  It pulls facet hues towards champagne, cools the brightest sparkle, and shades a thin warm
  girdle where stone meets bezel. Gold images are unchanged.

## Legacy ring (19 Oct 2026)

The **Promise Legacy Birthstone Ring** (`promise-legacy-birthstone-ring`) has its own preview set:
`assets/colab-legacy-{metal}-{centre}-{halo}.jpg` and `assets/colab-legacy-version.txt`. It's built by
`pipeline/rings/legacy/`, which imports the shared pipeline code. Heirloom's files are untouched.

**How it's made:**
- **No real photo exists.** The client's Legacy images are AI-generated 2x2 grids.
  - `crop_grids.py` cuts each ring out as `renders/{metal}_c-{centre}_h-{halo}.png`.
  - `ai_base.py` asks Gemini 3 Pro (OpenRouter) for one sharp 4K redraw of the April & April gold ring.
  - Attempt 2 was chosen (`ai/gold_c-april_h-april_2.png`). It is the **only** geometry source. No image is AI-generated per combination.
- **`prep_base.py`** places the base on the 1600px canvas, with the band matched to Heirloom's width (964px).
  It flattens the AI background to plain white and keeps only the contact shadow.
  - **Gold is yellowed:** the AI redraw's gold ran orange (hue 73.5 against the original render's 78.9, worse round the middle). `yellow_the_gold()` rotates gold hue by `HUE_SHIFT` (6.5 degrees) and eases chroma slightly. The targets were measured from Charlotte's own screenshot of the two rings (21 Oct). Re-measure with the same method if she says the gold is off again.

- **`measure.py`** finds the centre opening and the 16 halo slots on the colourless base stones.
  - Writes `geometry.json`, `slots_matched.json`, `photo/mask_centre_stone.npy` and `photo/overlay.png`.
  - Check the overlay: the centre mask must stay inside the bezel lip, clear of the milgrain.
- **`build_legacy.py`** places the centre and recolours the halo:
  - **Centres** are the live picker's real stone images (`icons_solid/`), as on Heirloom. They're turned 90° to sit north-south and scaled to cover the opening, grown 3px (`CENTRE_GROW`) so no white base stone shows at the bezel.
  - **Sharpened centres:** `ai_centres.py` has Gemini redraw each 200px picker stone once at 4K.
    - The result is fitted back to the picker stone's bounds, cut out with its own outline, and its colours matched to the picker image. It keeps the approved cut and colour and only gains detail.
    - Any redraw whose proportions are more than 2% off is rejected.
    - The output is `centres/{k}.png`, and `build_legacy.py` uses it when present.
    - Pale stones are sent on a dark canvas (`BACKGROUND`). On grey, June's edge merged with its shadow and failed the check.
  - **Do not recolour the AI's colourless centre.** It was tried, and a white diamond's facets go milky and smeared when made a deep colour (May looked washed out).
  - **Halos are Heirloom's real stones, seated in the AI ring's own settings.** Charlotte wants both rings to show *identical* stones, and (21 Oct) stones that sit *in* the ring, not over it.
    - Each Legacy stone is cut from the approved Heirloom image (`assets/colab-heirloom-gold-april-{k}.jpg`, her tuner settings already applied).
    - `stone_footprints()` models each stone in the base as a circle a touch wider than the white stone (`SEAT_GROW`). `set_stone()` fills that circle with the Heirloom stone everywhere the base is not gold metal, so the base's own bezel lip, milgrain and prongs stay **on top** of the stone.
    - Only gold connected to the rim outside the circle counts as metal. Warm reflections inside the old white stone must not, or they leave gold specks in the new stone.
    - The stone is eased darker at its edge (`SEAT_SHADOW`) as the bezel would shade it.
    - Stones are paired one-to-one in order round the ring from the top stone, so none repeats beside itself and top stays top for the lighting.
    - **April uses the base's own sparkly diamonds, not Heirloom's April stones** (Charlotte: Heirloom's looked flat beside them). On silver they get a desaturation (`APRIL_SILVER_DESATURATE`) to lose the peach cast they pick up from gold.
  - **Do not use `clean_base()` or `transplant()` here.** They are right for Heirloom's flat packshot, but they flatten everything within 1.1x of a stone, wiping this ring's bezel lip and prongs, so the stones look stuck on top ("not set in the ring"). That was the second version.
  - **Do not recolour the base's white stones.** That was the first version. A white diamond's facets, recoloured, come out flat and washed out next to Heirloom's vivid real stones (Charlotte spotted it on July and August). Real stones are the only way to match.
  - Silver is the finished gold converted by `gold_to_silver.py`, run from the Legacy folder, with Heirloom's silver tone. The background and the AI's warm shadow are protected.
  - Flags:
    - `--poc` writes contact sheets to `poc/`.
    - No flag builds the 288 images.
    - `<colours.json>` applies the Legacy tuner settings.
    - `--tuner` refreshes the tuner assets.
- **Shared code changed:** only `centre_real`, which has an optional `rotate`. Heirloom's output is byte-identical, verified on a full 288-image rebuild against a baseline (that check was made before the later halo and centre work, none of which touches shared code).

**Legacy Stone Tuner:** https://claude.ai/artifact/TpwchWGWtzghmp69YfR5X1
- The page is in `rings/legacy/tuner/`, with `STORE_KEY = "legacy-stone-tuner"`.
- Unlike Heirloom's, it adjusts **both centre and halo**.
- Apply the client's JSON with `build_legacy.py <json>`.
- To republish, copy the folder to a path under the working directory or scratchpad and publish with `url` set to the link above.

**Theme switch:**
- `snippets/co-lab-preview-set.liquid` returns:
  - `legacy` when the product field **Stone preview set** (`custom.stone_preview_set`) is `legacy`
  - `heirloom` when **Customise drawer** is ticked
  - otherwise blank, meaning off
- The drawer, the gallery preview, the cart image and the image prefix all read it.
- The field is set on Legacy. The live theme ignores it until this code goes live, so Legacy's drawer switches on with the code push.
- **Drawer crop:** the compact preview shows a fixed window of the 1600px image. Legacy is taller than Heirloom, so `co-lab-stone-preview--legacy` in `assets/co-lab-stone-preview.css` has its own window (y 425-1202), or the top of the halo is clipped on mobile. A new ring needs its window measured the same way.
- **JS gotcha:** the component stores the prefix as `this.filePrefix`. `prefix` is a read-only DOM property and throws.

**Rebuild (from `pipeline/rings/legacy/`):**

```bash
../../.venv/bin/python prep_base.py ai/gold_c-april_h-april_2.png
../../.venv/bin/python measure.py
../../.venv/bin/python build_legacy.py && ../../.venv/bin/python build_legacy.py --tuner
```

**Checking a build:** `rings/legacy/check_clean.py` measures every halo stone against Heirloom's own images: gold-hued pixels inside the stone (a bezel sliver), a pale ring left from the base's white stone, and gold on the silver metal. Read it alongside full-size crops (about 1000px per ring), not contact sheets, which hide edge faults.
- **Last result (20 Oct 2026):** no gold inside any non-champagne stone (champagne scores 0.76 against Heirloom's 0.75, as expected). The pale ring is under 1%. On silver, every warm pixel is inside a stone, none on the metal.
- **Normal variation:** a few stones look a touch paler or darker than their neighbours in every month. Each one tracks its paired Heirloom stone exactly (it's the same real stone), so it's not a Legacy fault.

**Legacy open items:**
1. **Centres:** all 12 months use the sharpened redraws.
   - Heirloom gets them too: `pipeline/sharpen_heirloom_centres.py` places them onto the committed Heirloom images. Nothing outside the centre changes beyond JPEG re-encoding (mean difference under 0.1 level).
   - It's **on the Dev theme and in this worktree's `assets/`, not live.** Going live with it changes live Heirloom images, so ship it as its own commit with the client's OK.
   - **Note:** `rebuild.py` doesn't know about it. A full Heirloom rebuild brings back the soft centres unless this script is run afterwards.
2. **November halo** (champagne) sits close to the gold, as it did on Heirloom.
3. **Higher resolution:** if Charlotte finds larger originals of the AI renders, rerun `ai_base.py` on the April & April one.
4. **The Dev theme carries the house-style versions** of the edited snippets. The Legacy edits were applied to those copies for Dev. The feature branch is based on `main`.

## Going live

1. **Sync first.** Run `/sync` so main has the client's latest live edits, then merge this branch
   into main.
2. **Images before code.** Push the 288 `assets/colab-heirloom-*.jpg` files and
   `assets/colab-heirloom-version.txt` to the auto-detected live theme first. Check one image
   and the version file return 200. Then push the Liquid, JS and CSS. Code without the images
   shows broken rings everywhere.
3. **Test order.** Place one test order and check the confirmation email and admin order list
   the metal, both stones and the engraving. Checkout, emails and admin show the stock product
   image, because Shopify only allows a custom checkout image on Plus.
4. **Turning it on.** The drawer, gallery preview and cart image are switched on per product by
   the pinned product field **Customise drawer & stone preview** (`custom.customise_drawer`,
   true/false). It's ticked on `modern-heirloom-birthstone-ring` (set 28 Sep 2026). The preview
   images are of the heirloom design, so only tick it on a product with that ring.
5. **Supported values.** Previews exist only for the 12 months and for gold or silver metals.
   Any other stone month or metal hides the preview and uses the product image instead of
   showing a wrong or broken one.

## Rebuild on any Mac

```bash
cd docs/colab/stone-preview/pipeline
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python rebuild.py client_colours_2026-09-27.json          # all 288 site images, client colours
.venv/bin/python rebuild.py client_colours_2026-09-27.json --tuner  # also refresh the tuner's images
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
- **OpenRouter key** (only for AI experiments; rebuilds don't need it). It's in 1Password:
  - Vault: `Freelance`. Item: `Open Router Promise Co`. Field: `password`.
  - Reference: `op://Freelance/Open Router Promise Co/password`.
  - Read it with `opc` (`~/.local/bin/opc`, which caches in the Keychain). Pass it straight
    into the command and never echo it:

    ```bash
    OPENROUTER_API_KEY="$(opc read 'op://Freelance/Open Router Promise Co/password')" .venv/bin/python <script>.py
    ```

  - Or add it once to the repo's git-ignored `.env` as `OPENROUTER_API_KEY=` (the Pro's
    `.env` may not have it yet).
