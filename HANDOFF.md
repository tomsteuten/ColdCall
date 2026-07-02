# HANDOFF — agent-to-agent contract

This file is the shared scratch channel between agents working this repo
(Claude Code, Codex, Antigravity, etc.). The **git diff is always the source of
truth** — this file only orients the next agent so they don't have to re-derive
the integration surface from scratch.

## Protocol

1. **Leave the tree green before handing off.** `node tests/run.js` must pass.
2. **Leave the tree internally consistent.** No half-reverted features, no
   markup that references CSS/JS that isn't there. (The Antigravity handoff broke
   this: `simMinutes` vs `timeMs` split across files — don't repeat it.)
3. **One agent per file at a time.** If two agents edit `css/main.css` or
   `js/machine-art.js` in overlapping windows, they clobber each other. Tom is the
   traffic cop — coordinate before touching a file the other agent owns.
4. **Append a dated entry below** using the template. Newest at the top.
5. **Don't push** without Tom's say-so.

## Entry template

```
### <YYYY-MM-DD> — <agent> — <one-line summary>

- **Files touched:** <paths>
- **Contract:** <the binding the next agent must respect — e.g. CSS class names
  the SVG markup emits, data attributes, exported function signatures, state-shape
  fields. The thing that breaks silently if the other side doesn't match it.>
- **Graphics mode:** <vector / rendered / both / n/a — animations only apply to
  vector SVG; static webp can't keyframe internally>
- **sw.js cache bumped?** <yes vN→vM / no — REQUIRED yes if any app-shell file
  (css/main.css, js/**, index.html) changed, or PWA users get stale assets>
- **prefers-reduced-motion honored?** <yes / no / n/a>
- **Schema change?** <none / vN→vM + migration + test>
- **Tests:** <`node tests/run.js` → N passing, 0 failed>
- **Open / unverified:** <anything the next agent should check>
```

---

<!-- newest entry below this line -->

### 2026-06-14 - Codex - CSS machine-state motion wired into job and repair views

- **Files touched:** `css/main.css`, `js/ui/job.js`, `sw.js`,
  `tests/ui-markup.test.js`, `HANDOFF.md`.
- **Contract:** Machine artwork wrappers emit `machine-stage`, optional
  `machine-stage--raster`, sanitized `machine-stage--<machine-id>`, and exactly
  one state class: `machine-stage--fault`, `machine-stage--open`, or
  `machine-stage--working`. CSS animation selectors depend on those names.
- **Graphics mode:** both - wrapper transforms and pseudo-element effects apply
  to rendered WebP images and vector SVG artwork.
- **sw.js cache bumped?** yes v16->v17.
- **prefers-reduced-motion honored?** yes.
- **Schema change?** none.
- **Tests:** `node tests/run.js` -> 223 passing, 0 failed.
- **Open / unverified:** Effects are intentionally subtle. Raster sizing and all
  three states were visually checked in a narrow preview harness; final feel
  should also be judged during normal gameplay with Graphics Mode set to
  rendered.

### 2026-06-14 — Claude Code — HANDOFF.md scaffold created (session 21)

- **Files touched:** `HANDOFF.md` (new)
- **Contract:** none — documentation only.
- **Graphics mode:** n/a
- **sw.js cache bumped?** no — HANDOFF.md is not an app-shell file.
- **prefers-reduced-motion honored?** n/a
- **Schema change?** none
- **Tests:** `node tests/run.js` → 222 passing, 0 failed
- **Open / unverified:** Codex is implementing CSS animations for the machine
  images. When that lands, the next agent wiring it in needs to know: (1) which
  files changed, (2) the CSS↔markup class-name contract and whether
  `js/machine-art.js` actually emits those classes, (3) vector-only vs rendered,
  (4) whether `sw.js` cache was bumped (currently v16), (5) reduced-motion. Please
  fill those into an entry here.
