# Generated art — provenance & regeneration spec

How the raster art in this folder was made, so the set stays consistent and any new
machine/portrait can be generated to match. Update this file whenever you add or
regenerate an asset. (See also `../../GRAPHICS_REVIEW.md` for how the art is wired and
the open integration questions.)

## What's here

Machine renders — `<machineId>-{fault,open,working,probe,leads,ajar}.webp`, one set
of **six** per machine in `data/machines.json`. A catalogue test
(`tests/machine-art.test.js`) fails if any machine is missing a state, so keep all
six per machine. The last three are the tests-as-touches **interaction states**
(2026-07-08): probe = temp-probe test, leads = continuity test, ajar = inspect test.

- `slushie-machine-*` · `soft-serve-commercial-*` (Tier 1/2)
- `froyo-multihead-*` · `granita-slushie-*` · `commercial-ice-dispenser-*` (Tier 3)

Portraits — `nina-patel.webp` (Kwik Stop), `cheryl-voss.webp` (currently reused for
`burgertown-high-st`, `kwiktrip-servo`, `yo-go-froyo` — placeholder reuse, not yet a
per-client portrait).

## How they were generated (Codex built-in image tool, VS Code)

Each machine was generated as **one horizontal triptych** (fault | open | working in a
single image), then split + normalised with Pillow:

- Crop into 3 equal panels by width.
- `panel.thumbnail((590, 590), LANCZOS)` — fit machine within 590×590.
- Paste centered onto a **640×640** canvas; background colour sampled from the source
  panel's corner pixel `(4,4)`.
- Save WebP, `quality=88`, `method=6`.

Generating as a triptych is the key trick: it forces identical scale/camera/lighting
across the three states (the thing that's hard to get with separate per-state prompts).

## Visual direction (shared by ALL machine prompts — keep these constant)

```
Crisp polished 2D indie game illustration; technical cartoon; chunky geometric forms;
subtle cel shading; believable commercial equipment; straight-on orthographic view;
identical machine, scale and camera across all three states; very dark navy workshop
background; palette = navy, slate, ice-cyan, cream, amber, mint-green; NO text, logos,
people, watermark, scenery, or perspective changes.
```

This matches the in-code SVG palette in `js/machine-art.js` (`#354055` body,
`#38bdf8`/`#22d3ee` cyan, `#f59e0b` amber). To add a 6th machine and match the set,
reuse this block verbatim and feed an existing render as a style reference.

## Prompt template (per machine)

```
Create a polished triptych of the SAME fictional commercial <MACHINE> in three states,
left to right:
  1. Malfunctioning, with amber warning light and visible symptoms.
  2. Open for inspection, showing mechanically appropriate internals while remaining
     visibly faulty.
  3. Repaired and operating, with full product/output and green status light.
Each panel uses the same flat very dark navy workshop backdrop. Exact straight-on
orthographic view. Entire machine centered and fully visible, identical scale and
camera, generous padding. Three equal panels separated only by empty spacing. No
borders or labels.
Style: <paste the Visual direction block above>.
```

Machine-specific internals used for the open state:
- **Froyo (`froyo-multihead`):** 3 hoppers + dispense heads; open → 3 barrels, agitator
  drives, thermistors, solenoids, refrigeration lines.
- **Granita (`granita-slushie`):** 3 transparent bowls, augers, taps; open → gear
  motors, evaporator cylinders, drain, condenser, refrigeration.
- **Ice maker (`commercial-ice-dispenser`):** tall ice maker/dispenser; open → cube
  grid, water distributor, reservoir, inlet valve, pump, hot-gas valve, compressor.

## Split/normalise script (conceptual — re-derive, not checked in as a runnable tool)

```python
image = Image.open(sheet).convert("RGB")
panel_w = image.width // 3
for i, state in enumerate(("fault", "open", "working")):
    panel = image.crop((i*panel_w, 0, (i+1)*panel_w, image.height))
    bg = panel.getpixel((4, 4))
    panel.thumbnail((590, 590), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (640, 640), bg)
    canvas.paste(panel, ((640-panel.width)//2, (640-panel.height)//2))
    canvas.save(f"{machine}-{state}.webp", "WEBP", quality=88, method=6)
```

> Note: `tools/generate-raster-assets.py` is an UNRELATED older PIL placeholder
> generator (crude 512×512 PNGs), not this pipeline. The image generation itself is
> Codex's built-in tool and is non-deterministic — exact pixels can't be reproduced,
> only the style/spec above. Record the tool + date here when you regenerate.

## Interaction-state set (probe/leads/ajar) — 2026-07-08

Generated the same way but as a SEPARATE triptych per machine (a fresh generation
from the fault render as a reference image, in Google AI Studio / Gemini image
edit — see the per-machine prompts recorded in the session HANDOFF / NOTES). The
raw triptychs were dropped in `assets/triptichs/*.jpg` (1792×592, three panels:
probe | leads | ajar).

**Scale-matching is the trick here** (the interaction render must not jump in size
when the in-game art swaps fault→probe): each panel was NOT naively thumbnail-fit
like the base set. Instead a per-machine transform was measured and applied:

1. Detect the machine cabinet width in a tool-free mid band (40–52% of panel
   height) for each of the three panels; take the **min** across panels (tools/
   props only add width, so the min ≈ the true body) → new body width.
2. `scale = old_fault_body_width / new_body_width` (bodies measured the same way
   on the existing `<machine>-fault.webp`).
3. Measure the machine base-Y from the clean probe/ajar panels (the leads panel's
   hanging clips are excluded).
4. Scale each panel by that one factor, then paste onto a 640×640 canvas filled
   with the **old fault render's** background colour, positioned so the machine's
   centre-x and base-y land where the fault render's do. One factor per triptych
   keeps the three interaction states mutually consistent AND matched to the base
   set. (Script was in the session scratchpad, not checked in — re-derive from
   this spec; the measurement approach is the reproducible part.)

The `assets/triptichs/` source jpgs can be deleted once you're happy with the
committed webps — they're kept only as regeneration source.

## Resolved: the art lane (2026-07-08)

Rendered raster is now the **only** art lane. With all six states present for every
machine, the Settings "Graphics Mode" toggle was removed and `machineImageSrc()`
always returns the render; the inline SVG (`machineSvg`) survives only as the
fallback for the test env (webp paths don't resolve headless) and any machine with
no render. `state.settings.graphicsMode` remains a vestigial (unread) save field —
kept, not migrated away, because saves are sacred. The old square-in-16:7 slot
concern was already resolved (session 22, `.machine-stage--raster` gives squares a
1:1 slot capped at 300px).
