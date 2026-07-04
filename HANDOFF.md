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

### 2026-07-04 — Claude Code — Session 24: Phase 5 daily comeback hooks (brief complete)

- **Files touched:** `js/contract.js` (new), `js/motd.js`, `js/economy.js`,
  `js/diagnosis.js`, `js/state.js` (validateState only), `js/main.js`,
  `js/ui/job.js`, `config/balance.js` (`CONTRACT`), `css/main.css`
  (`.home-contract*`, `.btn-subtext`), `sw.js` (v19→v20 + `js/contract.js`),
  `tests/contract.test.js` (new), `tests/motd.test.js`,
  `tests/ui-markup.test.js`, `GDD.md`, `NOTES.md`.
- **Contract:** `state.contract` is now live: null or `{date, machineType,
  count, reward, progress, paid}` — validateState type-checks every
  interpolated field, so any new field the UI renders must be added there.
  Generation/refresh happens ONLY at action boundaries via
  `ensureContract(state, machines)` (boot + nextTicket in main.js) — never
  call it from render, and a same-day contract must never be regenerated
  (it's pinned; tests enforce this). Progress is recorded ONLY inside
  `settleJob`'s correct branch via `recordContractProgress` — workshop and
  MotD paths deliberately never call it; don't "fix" that. `settleJob` and
  `commitFix` results gained a `contract` key (null when the fix didn't touch
  the contract) — the receipt renders from it. js/contract.js has a local
  `utcToday` on purpose: importing economy.js from it would create a cycle
  (economy → contract → economy). New motd.js exports `nextPuzzleCountdown`
  and `streakAtRisk` power the home MotD button states.
- **Graphics mode:** n/a — no art changes.
- **sw.js cache bumped?** yes v19→v20 (new app-shell file `js/contract.js`;
  css/js/ui changes).
- **prefers-reduced-motion honored?** yes — no new motion; the countdown is a
  static text label, deliberately not a ticking timer.
- **Schema change?** none — v14's reserved `contract: null` slot is now used;
  the existing v13→v14 migration and its fixture test already cover it.
- **Tests:** `node tests/run.js` → 306 passing, 0 failed. Played headless
  (Playwright driving system Chrome, `channel: 'chrome'` — no bundled
  browser on this machine) at 380px and 1280px, fresh + seeded v14 mid-game
  save: at-risk badge shows/clears, contract generates on boot, progresses on
  matching fixes only, completes with the receipt line, pays once, and the
  played MotD button counts down. Zero console errors; screenshots in the
  session scratchpad (not committed).
- **Open / unverified:** the contract regenerates only at boot/nextTicket, so
  a home screen left open across UTC midnight hides the stale contract until
  the next action — accepted (honest, no render mutations). Next-session
  candidates are in NOTES.md's cold-start prompt (prestige-vs-ladder
  playtest, variant-rotation playtest, visual session).

### 2026-07-04 — Claude Code — Session 23: retention pass (Phases 1–4 of 5)

- **Files touched:** `js/state.js` (schema v12→v14, two migrations),
  `js/diagnosis.js`, `js/economy.js`, `js/faults.js`, `js/idle.js`,
  `js/main.js`, `js/ui/job.js`, `js/ui/shop.js`, `js/ui/motd.js`,
  `js/ui/codex.js` (new), `config/balance.js`, `css/main.css`, `index.html`,
  `sw.js` (v18→v19), `data/faults/SCHEMA.md`, 15 fault JSON files (added
  `symptomVariants`), `GDD.md`, `NOTES.md`, tests across the board.
- **Contract:** `earnedSpeedBonus(minutesSpent, testsCount)` in economy.js is
  now the single source of truth for the speed bonus — it gates on
  `DIAGNOSIS.minTestsForBonus`; the old `speedBonus()` (pure decay curve, no
  gate) still exists and is used internally. `commitFix()`/`settleJob()`
  results gained `repDelta`, `testsUsed`, `cleanStreak`, and `codex` fields —
  any UI rendering a settlement result should read from these, not recompute.
  `state.jobs.active`/callback entries gained a `variant` field (0 = base
  presentation, 1..n index into `fault.symptomVariants`); read symptoms via
  `jobSymptoms(job, faults)` and test results via `testResult(job, testId,
  faults)`, never `fault.symptoms`/`fault.tests` directly, or variants won't
  render. `js/economy.js` exports `purchaseLadder(state)` and
  `buyLadderItem(state, id)` — the shop UI is now driven entirely from the
  ladder, not a hand-rolled tool/staff list; `TOOL_CATALOGUE`/`hireTech`
  still exist underneath but the UI should go through the ladder. Codex:
  `recordCodexFix(state, faultId, faults)` must be called after settlement
  (it's already wired inside `commitFix`) — never call it standalone from UI
  code. `state.codex.fixes` and `state.contract` (currently unused, `null`)
  are new top-level fields; `validateState` checks `codex.fixes` values are
  numbers.
- **Graphics mode:** n/a — no art changes this session.
- **sw.js cache bumped?** yes v18→v19 (added `js/ui/codex.js`, the only new
  app-shell file; all touched fault JSON already listed).
- **prefers-reduced-motion honored?** yes (unchanged; no new motion/animation
  added — the repair-hold beat and machine-state CSS are untouched).
- **Schema change?** yes, twice: v12→v13 adds `variant: 0` to jobs/callbacks
  (symptom-variant index); v13→v14 adds `codex: {fixes: {}, milestonesPaid:
  []}` and `contract: null`. Both have fixture migration tests in
  `tests/state.test.js`.
- **Tests:** `node tests/run.js` → 290 passing, 0 failed. Every phase was also
  played headless in Chromium (Playwright driving the system Chrome install,
  no bundled browser on this machine) at 380px and 1280px, fresh-player and
  seeded-mid-game-save, zero console errors — screenshots are in the session's
  scratchpad, not committed to the repo.
- **Open / unverified:** Phase 5 (daily comeback hooks: MotD countdown/streak
  cues, "Today's contract") was cut at the session's usage limit before any
  code was written — nothing to reconcile, just pick it up fresh. See
  GDD.md §5's cut-scope note and NOTES.md's cold-start prompt. One design
  judgment call not covered by the original brief: Multimeter Tier 3's
  eliminated-fix draw is seeded on `job.faultId:clientId:startedAt` rather
  than the job's variant, so the SAME wrong fix is ruled out across
  identical re-rolls of a fault — reasonable, but worth a second look if it
  ever feels too predictable across repeat encounters with the same client.

### 2026-07-03 — Claude Code — Session 22: the finishing session (v1.0 ship pass)

- **Files touched:** `js/state.js`, `js/economy.js`, `js/main.js`, `js/audio.js`
  (new), `js/motd.js`, `js/ui/job.js`, `js/ui/motd.js`, `config/balance.js`,
  `css/main.css`, `index.html`, `sw.js`, `data/clients.json`,
  `assets/fonts/*.woff2` (new), `GDD.md`, `NOTES.md`, `GRAPHICS_REVIEW.md`,
  tests. Deleted: `REVIEW_FINDINGS.md`, preview-* scratch, placeholder PNGs,
  `tools/recover_workspace.py`, `tools/generate-raster-assets.py`.
- **Contract:** `WORKSHOP_MACHINES` prices now live in `config/balance.js`
  (`WORKSHOP.machines`); workshop buy/sell go through
  `buyWorkshopMachine`/`sellWorkshopMachine` in economy.js (sales NOT
  founderBonus-scaled — rule-5 invariant with a test). `contact.flavourLines`
  in clients.json is `{default: [...], "<machineType>": [...]}` consumed by
  `contactFlavourLine()` in js/ui/job.js. `validateState` type-checks
  motd.streak, motd.lastResult.testsUsed/solved, van stock counts, tech
  name/skill — any new save field the UI renders should be added there.
  Outfit is self-hosted from `assets/fonts/` — do not reintroduce the Google
  Fonts link. SFX go through js/audio.js, always gated on
  `state.settings.audio`.
- **Graphics mode:** both — default for NEW games is now `'rendered'`; existing
  saves keep their stored mode. Raster slot is `.machine-stage--raster`, capped
  300px.
- **sw.js cache bumped?** yes v17→v18 (app-shell JS/CSS/HTML changed; also added
  the missing `js/ui/settings.js`, `js/audio.js`, and the two font files to
  APP_SHELL).
- **prefers-reduced-motion honored?** yes (unchanged Codex rules; no new motion).
- **Schema change?** none — still v12. defaultState().settings.graphicsMode
  changed to 'rendered' but no migration touches existing saves.
- **Tests:** `node tests/run.js` → 247 passing, 0 failed.
- **Open / unverified:** none blocking. Post-launch candidates are listed in the
  NOTES.md cold-start prompt.

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
