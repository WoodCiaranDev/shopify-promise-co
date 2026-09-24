# Co-Lab stone preview — image generation pipeline

How the `assets/colab-heirloom-{metal}-{centre}-{halo}.jpg` images for the
Modern Heirloom Birthstone Ring were made (20–21 Sep 2026). Scripts here are
recovered from the Claude Code session on the MacBook Pro; they ran from a
scratchpad with a Pillow/NumPy venv, so paths inside them are relative to that
working folder.

## Source images

- Gold: the client's product photograph `07.jpg` (emerald centre) from the live
  site, saved as `client/real07.jpg`.
- Silver: the sterling silver packshot, saved as `packshots/silver.jpg`.
- Raw AI outputs and the 144-per-metal combination sets are kept outside the
  repo in `~/Downloads/promise-co-birthstones/` (also on the MacBook Pro):
  `per-slot-source/` (24 gold), `silver/per-slot-source/` (24 silver),
  `all-144-combinations/`, `silver/all-144-combinations/`, plus contact sheets.

## Model and cost

- Provider: OpenRouter, `POST /api/v1/images`, key in 1Password
  `op://Freelance/Open Router Promise Co/password` (read via `opc`).
- Main model: `google/gemini-3.1-flash-image` at 2K, 1:1, with the packshot as
  an `input_references` image. Gemini sometimes ignores the requested
  resolution, so each call asserts the output is at least 2048px and retries once.
- Fallback: `google/gemini-3-pro-image` for the handful of silver slots Flash
  drifted on (april/january/june centre; july/may halo, then july/november
  centre and july/october halo redone).
- Rejected after testing: gpt-5-image-mini, gemini-2.5-flash-image, gpt-5.4-image-2.
- Whole exercise cost roughly $20 of OpenRouter credit.

## The per-slot trick

Instead of generating all 144 centre x halo pairings, generate 24 per metal:
12 where the centre stone varies and the halo is held as colourless diamonds,
and 12 where the halo varies and the centre is held colourless. Any pairing is
then composited from two of those using a feathered halo mask, so cost is
additive (24 calls) not multiplicative (144).

## Prompt

```
Edit this product photograph of a gold halo ring. Replace the gemstones: make
the large oval centre stone {stone description}, and make all sixteen small
round halo stones colourless white diamonds. Keep everything else
pixel-for-pixel identical - the yellow gold metal, the bezel and claws, the
band, the white background, the shadow, the camera angle, the lighting and the
framing must not change at all. Photorealistic jewellery product photography,
faceted transparent gemstones with realistic internal reflections.
```

Halo variants swap the two clauses (centre held colourless, halo gets the
stone). Silver swaps "gold halo ring" / "yellow gold metal" for "sterling
silver halo ring" / "sterling silver metal". Stone descriptions:

| Month | Description |
|---|---|
| january | a deep red garnet |
| february | a medium purple amethyst |
| march | a pale sky-blue aquamarine |
| april | a colourless white diamond |
| may | a rich deep green emerald |
| june | a soft pale lilac lavender stone |
| july | a vivid pinkish-red ruby |
| august | a bright yellow-green apple-green peridot |
| september | a rich royal blue sapphire |
| october | a soft rose pink stone |
| november | a warm champagne-brown topaz |
| december | a violet-blue tanzanite |

## Scripts, in order

1. `01_mask_photo_gold.py` — fits the 16-stone halo geometry from the CAD
   (5.24 mm radius, 2.71 mm stones) onto the gold photo and writes
   `photo/mask_centre.npy` and `photo/mask_halo.npy`.
2. `02_ai_slots_gold.py` — the 24 OpenRouter calls for gold into `slots/`.
   Run with `AI_MODEL=... OPENROUTER_API_KEY=... python 02_ai_slots_gold.py`.
   The silver version was made by `sed`-swapping the source path, output dir
   and metal wording; the pro-model fixes were the same script with a reduced
   `STONES` list and `AI_MODEL=google/gemini-3-pro-image`.
3. `03_mask_silver.py` — silver masks; the centre stone gives the px/mm scale
   and the gold halo geometry is reused.
4. `04_combine_silver_144.py` — validates each slot against the packshot
   (metal drift under 6, silhouette width within 60px), then composites the
   144 silver pairings with a feathered halo mask and builds the contact sheet.
   The gold equivalent was the same code against `slots/` and `photo/mask_halo.npy`.
5. `05_build_layers.py` — the first web approach: 24 files per metal (centre
   JPG plus transparent halo PNG) stacked in the browser. Committed in
   `e016088`, then dropped on 21 Sep because the gallery lightbox needs one
   direct-child img per cell.
6. `06_build_composites.py` — the current approach: renames the 144-per-metal
   pre-composited JPGs to `colab-heirloom-{metal}-{centre}-{halo}.jpg` at
   1000px, quality 86, progressive. These 288 files are what ships in `assets/`.

## 22 Sep 2026 — centre edge fix and halo lightening

**Client feedback:** the centre stone looked blurred at its edges. Measured
against the original photo, Gemini's centre stones were as sharp as the
original in the middle but 3–7x softer in the outer ~1 mm by the bezel. The
softness came from generation, not compositing.

7. `07_rim_fix.py` — sharpens only a band just inside the centre-stone mask
   (unsharp mask, local contrast, slight darkening towards the girdle). Presets
   are `subtle`, `medium` and `strong`. The shipped assets use `medium`.
8. `08_halo_tone.py` — lightens small halo stones per birthstone in Lab space
   (lightness towards white, chroma down, peridot nudged yellower), protecting
   the metal. Figures come from research into how small stones lighten because
   light travels a shorter distance through them (Beer–Lambert). Pale stones
   (aquamarine, lavender, pink, apple green) lighten most, while deep ones barely
   move. Levels are `none`, `half` and `research`. Shipped: `none`, pending the
   client's choice.
9. `09_build_assets.py` — rebuilds all 288 assets:
   `python 09_build_assets.py medium none <assets dir>`. It runs from a folder
   containing `client/real07.jpg`, `packshots/silver.jpg` and the `photo/*.npy`
   masks from scripts 1 and 3. It reads raw slots from
   `~/Downloads/promise-co-birthstones`.
10. `10_ai_regen_centres_pro.py` — the proper fix, not yet run. It regenerates
    only the centre slots on Gemini 3 Pro Image at 4K, with a prompt demanding a
    crisp girdle and no inclusions. To trial three stones first, run:
    `ONLY_CENTRE=1 STONE_KEYS=july,september,may AI_MODEL=google/gemini-3-pro-image OPENROUTER_API_KEY=... python 10_ai_regen_centres_pro.py`

`03_mask_silver.py` now takes the silver vertical scale from the horizontal
one using the gold aspect, because the bounding box caught reflections and
stretched the halo mask.

Comparison sheets for the client are in
`~/Downloads/promise-co-birthstones/client-options/`.

## Halo shade picker for the client (22 Sep 2026)

All stones on this ring are 7A cubic zirconia, according to the product page.
CZ suppliers sell each colour in light, medium and dark grades, so letting the
client choose a halo shade per birthstone matches how the real stones are
bought.

- `11_halo_shade_steps.py`: signed shade steps for the halo stones only. One
  lighter step moves lightness 11% of the way to white and cuts chroma 12%.
  One darker step cuts lightness 11% and lifts chroma 6%. Apple green also
  shifts 2° towards yellow per lighter step. Metal is protected.
- `12_picker_sheet.py`: one sheet per metal, one row per coloured birthstone,
  halo shades A to F. A and B are darker, C is the current image, and D to F
  are lighter. A gold outline marks the research-based suggestion.

No AI is needed for any shade. Once the client picks letters, map A to F onto
steps -2 to +3 and rebuild the 288 assets with the shades applied.

Suggested letters, from three research passes (gemmology, CZ materials and
render practice):

| Letter | Birthstones |
|---|---|
| F | aquamarine, lavender |
| E | amethyst, apple green, pink, champagne, tanzanite |
| D | garnet, emerald, ruby, sapphire |

The main evidence: GIA notes that small aquamarine, tanzanite and peridot are
paler or less intense, and absorption scales with path length. No source
compares 2.7 mm melee with an 8x6 oval directly, so the exact letters are
judgement. Coloured CZ's fire is mostly masked by its body colour, so any
added sparkle should be white, with rainbow fire only on the diamond simulant.

## Icon colour match (22 Sep 2026)

`14_icon_colour_match.py` matches each AI stone's colour to its stone picker icon (the
`birthstone` metaobject images, copied into `icons/`). It is a Reinhard transfer in Lab
space: the mean and spread of L, a and b inside the stone mask are matched to the icon's
opaque pixels. Contrast changes are capped (L ×0.8–1.25, a/b ×0.6–1.6) so high-contrast
icons can't blow out the facets. Centre stones use the centre mask. Halo stones use the halo
mask, gated to pixels already coloured like the stone, so metal and background caught by
the looser disc mask are never tinted.

`13_cream_background.py` then puts the result on the live-site cream (#F2EDE5).
`build_module.py` is the scratch build module tying these steps together:
rim fix, icon match, halo shade, compositing, then cream.

## Client halo references (23 Sep 2026)

The client supplied six ring photos whose halo stones are the approved colours. They were
identified by measured colour against the picker icons and the client's own collage labels:

| Photo | Halo birthstone |
|---|---|
| 3 | August (apple green) |
| 4 | March (aquamarine) |
| 6 | April (diamond simulant, white) |
| 7 | June (lavender) |
| 8 | July (ruby, purple-magenta) |
| 9 | September (sapphire, teal-blue) |

A seventh photo, the original emerald packshot, has a pale olive halo that matches none of
the birthstones, so it isn't used. The photos are framed and cut differently from our
packshot, so they supply colour only, never pixels.

`15_client_halo_reference.py` isolates each photo's halo stones (an annulus around the head,
minus metal by hue) and measures their saturated half. The halo target was then corrected
until our halo's median lightness, chroma and hue matched the client's to within about two
units. Those targets are stored in `client-halo-refs/stats.npy`. Client halos also lock hue
at 0.8 so every stone reads one colour. June is the exception, because lavender is too pale
for hue locking.

Birthstones without a client photo (January, February, May, October, November and December)
take their halo colour from the lightest coloured facets of their own centre stone, via
`light_part_stats` in `14_icon_colour_match.py`.

## Halo v2: detected stones + whole-distribution matching (23 Sep 2026)

- **The pale bottom stones were a compositing bug.** They weren't an AI failure. The first
  halo mask was an analytic ellipse fit that missed the bottom stones, so those pixels came
  from the centre-stone image, where the halo is colourless. The 16 stones are now detected
  directly from strongly coloured halo images: sapphire on both metals, since apple green
  sits too close to gold's green shadows. Positions are in `halo_stones.json`, and both
  `mask_halo` files are rebuilt from them.
- **Colour matching uses the whole distribution.** `16_halo_repair_and_match.py` quantile-maps
  the lightness and chroma of every halo-stone pixel onto the client's reference stones, so
  dark rims and highlights land where the client's do, not just the average. Hue is set to
  the client's median, keeping 0.3 of each stone's own natural hue variation, because copying
  the reference's hue spread caused rainbow speckle on pale stones. Birthstones without a
  client reference map onto their own centre stone, lifted to its lighter facets.
- `repair()` swaps any stone left uncoloured for a copy of a good one. None of the current
  slots needed it once the mask was fixed.

## Real-stone transplant (24 Sep 2026)

The AI halos had the right colour but the wrong internal structure. Compared with the client's
real stones they had about a third of the dark facets, a seventh of the white glints, and a
hazy, fine facet pattern. So the client's actual halo stones are transplanted into our
settings (`18_stone_transplant.py`):

- **Finding stones:** in each client photo, stones are found by colour. Where colour fails
  (pale or colourless stones, or a centre stone sharing the hue), the July photo's clean
  positions are carried over by edge cross-correlation. Each stone is then refined onto its
  own bezel edge. Positions are in `client-halo-refs/client_stones_*.json`.
- **Sizing:** scale comes from the median spacing between neighbouring stones in each image.
  That measure is identical in any photo, whereas measured stone radii depend on colour.
- **Pasting:** each stone goes into our matching slot at the same angle around the halo, so
  the lighting direction agrees, blended at our visible stone radius. When the donor photo
  is gold and the target is silver, gold-hued slivers are neutralised.
- **Coverage:** transplanted halos are August, March, June, July and September, on both
  metals. April stays as the AI's colourless stones, because they can't be located reliably
  on the silver photo. The six birthstones without a client photo still use the colour
  matching.
