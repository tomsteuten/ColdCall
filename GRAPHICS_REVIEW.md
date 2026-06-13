# Graphics review — vector SVG vs rendered raster (2026-06-14)

Review of why the "decent" generated graphics are not showing by default, and a
recommended path forward. Conducted by Claude (Opus 4.8). No visual QA was possible
this session — the managed preview panel can't bind because the local python server
holds port 8123 — so findings are from static code/asset analysis. **Flagged items
needing a visual check are marked [VERIFY].**

## TL;DR

There are two machine-art systems:

- **Vector** (`js/machine-art.js` → `machineSvg`): inline animated SVGs, `viewBox
  0 0 160 70` (**16:7**), one for each of the 5 machines, palette-matched to the
  dark UI. These fit the art slot exactly and animate (LED pulse, fluid slosh,
  agitator spin).
- **Rendered** (`assets/generated/*.webp` → `machineImageSrc`): higher-fidelity
  AI-style raster renders, **640×640 (1:1 square)**, only for **2 of 5** machines
  (`slushie-machine`, `soft-serve-commercial`).

The rendered art is gated behind `state.settings.graphicsMode`, which **defaults to
`'vector'`** (`js/state.js:69`, and the v11→v12 migration `js/state.js:228`). So the
game ships on the SVGs. Flipping the default is *not* a one-liner, because the
rendered path has three unfinished pieces (below).

The SVGs are not an "ugly fallback" — they are the only art that is actually
integrated with the slot. The renders are nicer in isolation but not production-ready
as wired today.

## Findings

### 1. Default is `'vector'` — rendered is opt-in only
`machineImageSrc(id, state, graphicsMode='vector')` returns `null` whenever the mode
is `'vector'` (`js/machine-art.js:52`), so `js/ui/job.js:490` falls back to
`machineSvg`. The only way to see renders today is the Settings toggle
(`js/ui/settings.js:37`, "VECTOR (ANIMATED)" / "RENDERED (STATIC)").

### 2. Rendered mode is visually broken as wired [VERIFY]
The render `<img>` is emitted with `width="768" height="480"` (`js/ui/job.js:493`,
`:615`) but **there is no `.machine-art` CSS rule at all** — no `max-width`, no
`object-fit`. The slot (`.art-slot`) is `width:100%; max-height:110px;
aspect-ratio:16/7`. So a 768px-wide attribute on an uncontained `<img>` inside a
~110px-tall flex slot will overflow / distort. This review adds a minimal
containment rule (`object-fit: contain`) so the toggle is at least usable; see
"Changes made" below.

### 3. Aspect-ratio mismatch: square renders in a 16:7 letterbox slot
The SVGs are 16:7 and fill the slot edge-to-edge. The renders are 1:1 squares.
Even with `object-fit: contain`, a square image in a 16:7 / max-110px slot displays
as a small ~110×110 centered tile — **smaller and less impactful than the SVG it
replaces.** So flipping the default without reshaping the slot for raster would make
Tier 1/2 art look *worse*, not better. A proper "surface the renders" change needs a
raster-specific slot shape (e.g. a `.art-slot--raster` modifier sized ~1:1 / 4:3,
taller than 110px) so the square renders get real estate. [VERIFY]

### 4. Coverage gap: only 2 of 5 machines have renders
`GENERATED_MACHINES` (`js/machine-art.js:29`) covers `slushie-machine` and
`soft-serve-commercial`. The three Tier 3 machines (`froyo-multihead`,
`granita-slushie`, `commercial-ice-dispenser`) have **no `.webp`**, so even in
'rendered' mode they fall back to SVG. Defaulting to 'rendered' today yields a
mixed look: Tier 1/2 raster, Tier 3 vector.

### 5. No reproducible pipeline for the renders
`tools/generate-raster-assets.py` produces crude 512×512 PIL placeholders at
`assets/machine-broken.png` / `machine-working.png` / `tech-avatar.png` — **not**
the committed 640×640 `assets/generated/*.webp`. `tools/fetch-portraits.js` and
`tools/README.md` were committed empty (0 bytes) and carry no information. **There is
no checked-in way to regenerate the renders or produce the 6 missing Tier 3 ones.**
Whatever external image generator made them needs to be re-identified and documented
before the coverage gap can be closed.

### 6. Portraits already use raster unconditionally (and it's fine)
Client portraits call `clientPortraitImageSrc(client.id)` with **no graphicsMode
gate** (`js/ui/job.js:469-470`), so they always use the 320×320 `.webp` when
available (`nina-patel`, `cheryl-voss`) at `<img width="64" height="64">` — small,
so no layout issue. Note three clients (`kwiktrip-servo`, `yo-go-froyo`,
`burgertown-high-st`) all map to `cheryl-voss.webp` (`js/character-art.js:8-10`) —
a placeholder reuse, not a per-client portrait.

## Recommended path forward

Two coherent directions; pick one:

**Option A — Make rendered the default (what Tom wants), done properly.** In order:
1. Add a raster-specific slot shape so square renders get real space (don't just
   reuse the 16:7 slot). [VERIFY each state at 380px + desktop]
2. Identify/restore the render pipeline and **generate the 6 missing Tier 3 renders**
   (3 machines × fault/open/working) so coverage is complete, or accept the Tier 3
   SVG fallback as intentional and document it.
3. Flip the default: `defaultState().settings.graphicsMode = 'rendered'`. For
   existing saves, leave the v11→v12 migration as-is (don't override a value already
   in a save — saves are sacred) OR add a v12→v13 migration only if you decide every
   pre-existing save should also flip. Add a test either way.
4. Keep the "rendered where available, vector otherwise" fallback (already the
   behavior) so it degrades cleanly.
5. Bump `sw.js` cache **and add `assets/generated/*.webp` to `APP_SHELL`** — they are
   currently NOT cached (`sw.js` only lists `assets/icon.svg`), so renders won't work
   offline.

**Option B — Keep vector as default, polish rendered as an opt-in.** Cheaper: just
fix the slot/containment so the existing toggle looks good, leave Tier 3 on SVG,
document the renders as a "static/high-detail" mode. The animated SVGs remain the
primary, slot-fitted presentation.

Recommendation: **Option A** matches Tom's stated preference, but it is blocked on
item 5/#5 (the missing render pipeline + Tier 3 assets). Until those exist, the
honest interim state is Option B with the containment fix applied.

## Changes made this session
- Added a `.machine-art` CSS containment rule (`object-fit: contain`, fits the slot)
  so 'rendered' mode no longer overflows. Safe under either option. [VERIFY visually]
- Removed the two empty 0-byte tool stubs (`tools/fetch-portraits.js`,
  `tools/README.md`) that were committed by mistake in the previous commit.
- No default change, no slot reshape, no asset work — those need visual QA and (for
  Tier 3) a render pipeline that does not currently exist in the repo.
