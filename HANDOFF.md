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

### 2026-07-08 — Claude Code — Session 30: playtest-feedback pass (nav, density, repetition)

- **Files touched:** `js/main.js` (routing, goHome/resumeJob actions, guards,
  delegated go-home listener, boot resume), `js/ui/job.js` (statusBar opts +
  `.status-bar--nav`, render routing, homeView Resume/disabled-MotD, callbacks
  guard, compact caller markup), `js/ui/shop.js`/`codex.js`/`motd.js`
  (statusBar home:true), `js/tickets.js` (anti-repeat draw +
  `recordRecentFault`/`RECENT_FAULT_WINDOW`), `js/state.js` (schema v15,
  migration, validateState), `js/economy.js` (prestige clears the window),
  `css/main.css` (.status-home, .callback-blocked, density: raster 190px
  mobile/300px desktop, compact .client-callout, job-client lg, tighter gaps,
  compact .btn-test), `data/clients.json` (Lakeview Pool Kiosk, T1),
  `data/faults/slushie-killed-by-wall-timer.json` (new) + `index.json`,
  6 slushie fault files (+2 symptom variants each), `sw.js` (v29→v30 + new
  fault JSON), tests (state fixture, tickets ×3, character-art fixture fix),
  `GDD.md` §2.1, `DESIGN.md` §5.
- **Contract (routing — the big one):** explicit navigation now WINS over an
  active job. `viewKey()`/`paint()` precedence: motd > repair > invoice >
  shop > codex > callbacks > job-if-active-AND-screen-not-'home' > home.
  Every job start sets `screen = 'job'` (nextTicket, takeCallback,
  repairWorkshopMachine, startMotd) and boot sets it when a save holds an
  active job. `actions.goHome()` clears transient invoice/repairBeat/
  pendingFirstFixId and sets screen='home' — the ACTIVE JOB IS KEPT (pause);
  homeView renders "Resume job — <client>" as primary via
  `data-action="resume-job"`. Anything that would call startJob while a job
  exists is guarded (it throws otherwise): nextTicket/takeCallback/
  repairWorkshopMachine return early, callbacks view disables Take with
  `.callback-blocked` note, home's unplayed MotD button renders disabled.
  A test-harness gotcha from this: `jobScreen.render` with an active job and
  `screen: 'home'` now renders HOME — fixtures that want the job screen must
  pass `screen: 'job'` (character-art.test.js was fixed for this).
- **Contract (statusBar):** `statusBar(state, { home: true })` adds the
  Home button + `.status-bar--nav` (4-column grid). Home view passes no opts.
  The button is wired by a DELEGATED listener in main.js on
  `[data-action="go-home"]` — do NOT also wire it per-screen or it fires
  twice. Van right-align moved from `:last-child` to `:nth-child(3)`.
- **Contract (anti-repeat):** `pickTicket(faults, clients, tier, next,
  recentFaultIds)` excludes recent ids, falling back to the full pool rather
  than throwing when exclusion empties it. `state.jobs.recentFaultIds`
  (schema v15) holds the last `RECENT_FAULT_WINDOW` (3) fresh-ticket draws,
  updated ONLY in nextTicket via `recordRecentFault` — callbacks/MotD/
  workshop replay by design and must never touch it. Prestige clears it.
- **Content:** T1 now has 2 clients (new `lakeview-pool-kiosk` uses the SVG
  portrait fallback — no webp; add to the portrait backlog with sanjay/chloe),
  13 slushie faults (new red herring `slushie-killed-by-wall-timer`, free
  fix, T1), and every original T1 fault has symptomVariants. The red
  herring's error-log entry was DELETED on purpose — slushie error-log is at
  its info-design uniqueness cap (the suite caught it); temp-probe carries
  its tell. Symptom lines must NOT contain literal quote marks — the
  renderer wraps them in curly quotes already (staff-didnt-prime-it
  predates this rule and still has them; cosmetic, T2).
- **Graphics mode:** n/a (no art changes; raster cap resize only).
- **sw.js cache bumped?** yes v29→v30 (js/css + new fault JSON in APP_SHELL).
- **prefers-reduced-motion honored?** yes — no new animation;
  .status-home reuses the .btn hover/press transition pattern.
- **Schema change?** v14→v15: `jobs.recentFaultIds: []` + migration +
  fixture test (state.test.js) + live-verified round trip.
- **Tests:** `node tests/run.js` → **342 passing, 0 failed** (+4: v15
  fixture, anti-repeat window, tiny-pool fallback, FIFO cap).
- **Desktop fold fix (same session, after Tom's live screenshot):** at 150%
  Windows browser zoom the effective viewport is ~1280×640 CSS px and the
  old desktop job layout (full-width ticket stacked ABOVE the two columns)
  ran ~996px tall. New desktop layout: `.screen-job` is itself a 2-column
  grid — ticket + art left, diagnostics + commit right — via
  `.job-cols { display: contents }`; desktop raster cap 300→240px. Mobile
  (<601px) flex layout untouched (verified). Measured after: a standard job
  fits EXACTLY at 1280×640 (page 640, commit bottom 620); the first job
  (onboarding guide) still needs ~56px of scroll — accepted, it's one job.
  CONTRACT: `.job-col-right` spans `grid-row: 1 / span 2` — anything added
  as a third direct child of `.screen-job` lands in column 1 below the art;
  keep the one-`.machine-stage`-per-view rule (view transitions).
- **Open / unverified:** deeper repetition levers deliberately not built
  (intermittent-fault engine, multi-fault jobs, Tier 3 variants — GDD §2.1
  note). Density verified at 375×812 (ticket fully above the fold incl. the
  first-job guide) and 1280×640/desktop — but not on a real phone or Tom's
  actual monitor; Tom should sanity-check on-device. The paused-job home
  screen still shows shop/codex buttons that work (by design) but Restock
  inside the job screen was not re-tested this session. Lakeview portrait
  is SVG-only until a webp is generated. Port 8128 burned mid-session
  (stale css/main.css despite SW+cache clearing — the known python
  http.server heuristic-cache gotcha); static-alt6 (8129) added and is the
  latest known-good port.

### 2026-07-08 — Claude Code — Session 29b: raster interaction-state art + pick-the-lane

- **Files touched:** `assets/generated/*-{probe,leads,ajar}.webp` (15 new,
  Tom-generated triptychs split/scaled here), `assets/triptichs/*.jpg` (5 raw
  sources, kept as regeneration source — deletable), `js/machine-art.js`
  (`GENERATED_MACHINES` now built from a state list incl. probe/leads/ajar;
  `machineImageSrc` drops the graphicsMode arg, always returns the render),
  `js/ui/job.js` (`artSlotHtml` drops the graphicsMode param + both call
  sites), `js/ui/settings.js` (Graphics Mode toggle removed),
  `js/main.js` (`toggleGraphics` action removed), `sw.js` (v28→v29 + 15 new
  webps in APP_SHELL), `tests/machine-art.test.js` (asset catalogue now
  covers all six states), `assets/generated/PROMPTS.md`, `GDD.md` §2.1/§7.
- **Contract:** rendered raster is now the SOLE art lane.
  `machineImageSrc(machineId, state)` (2-arg now — the graphicsMode 3rd arg is
  GONE; any caller still passing it just has an ignored extra arg, but update
  them) returns the webp for all six states, or null → SVG fallback only in
  the test env (`globalThis.test`) or for a machine with no render.
  `artSlotHtml(machineType, artState, opts)` likewise dropped its graphicsMode
  param. `state.settings.graphicsMode` is now a **vestigial, unread** save
  field — deliberately NOT migrated away (saves are sacred); its v11→v12
  migration + validateState check stay green and untouched. The SVG code
  (`machineSvg`, `js/machine-art.js` bodies, `machine-css-preview.html`)
  is retained as the fallback/authoring path, not deleted.
- **Scale-matching (the important part):** the interaction renders were NOT
  naively thumbnail-fit — each machine got ONE measured scale factor (cabinet
  width in a tool-free mid-band, min across panels ÷ the old fault render's
  body width) applied to all three of its panels, then pasted onto 640×640
  with the old fault render's bg colour at the fault render's centre-x/base-y.
  This keeps fault→probe→leads→ajar from jumping in size. Full method in
  PROMPTS.md's new "Interaction-state set" section. Verified via per-machine
  fault|probe|leads|ajar comparison sheets before wiring — all five align.
- **Graphics mode:** rendered (only). SVG fallback path exercised only by tests.
- **sw.js cache bumped?** yes v28→v29 (15 new app-shell webps + js/css changes).
- **prefers-reduced-motion honored?** yes/n-a — no new motion; the wrapper
  motion that already ran on the raster `<img>` is unchanged.
- **Schema change?** none — no save-shape change (graphicsMode field kept as-is).
- **Tests:** `node tests/run.js` → **338 passing, 0 failed** (asset catalogue
  test widened to six states; no count change since it's one test looping more
  states).
- **Open / unverified:** screenshots timed out this session (compositor busy
  with the continuous CSS animations), so visual QA of the IN-GAME swap was via
  DOM assertions (img src + machine-stage class flip on each hotspot tap, zero
  console errors) plus the pre-wire comparison sheets — not a live screenshot.
  A next session with working screenshots should eyeball the fault→probe→leads
  →ajar swap in-game on a couple of machines at 380px + desktop, and confirm
  soft-serve's slightly different fault-render colour grade doesn't read as a
  jump against its new interaction states (it was the least-clean scale match).
  `assets/triptichs/` can be deleted once Tom's happy with the committed webps.

### 2026-07-08 — Claude Code — Session 29: tests-as-touches diagnosis hotspots

- **Files touched:** `js/machine-art.js` (new `HOTSPOTS` export),
  `js/diagnosis.js` (new `TEST_INTERACTION_STATE` export), `js/ui/job.js`
  (`artHotspotsHtml`, `artSlotHtml` opts, job art-state derivation),
  `css/main.css` (`.art-hotspot`), `sw.js` (v27→v28), `tests/ui-markup.test.js`,
  `tests/machine-art.test.js`, `.claude/launch.json` (added `static-alt5`
  on port 8128), `GDD.md`, `DESIGN.md`.
- **Contract:** `HOTSPOTS[machineType][interactionState]` gives `{x, y}` in
  the shared `viewBox="0 0 160 70"` space — kept hand-in-sync with the
  coordinates already passed to `tempProbe()`/`meterLeads()`/the ajar
  screwdriver rect inside each machine's SVG function; if a machine's art is
  ever redrawn with different tool placement, update `HOTSPOTS` in the same
  change or the hotspot ring drifts off the visual. `TEST_INTERACTION_STATE`
  maps a test id to the art state it plays out as (`temp-probe`→`'probe'`,
  `continuity-test`→`'leads'`, `inspect-beater`→`'ajar'`; `error-log` is
  intentionally absent). `jobView`'s art state is now derived from the
  **last** test run via this map (falls back to `'open'` when the last test
  has no matching gesture, or `'fault'` before any test) — this changed the
  meaning of "art state" from "any test run → open" to "last test run →
  its state", but the one existing test asserting `error-log` → `'open'`
  still holds since `error-log` isn't in the map. `artSlotHtml()` gained an
  `opts.hotspotsHtml` param (job view only, never passed on the repair
  screen) — when present, the slot's own `aria-hidden="true"` is dropped
  (it now contains focusable controls) while the decorative art/particles/
  glow stay individually hidden as before, and `.art-slot > svg`/`.machine-art`
  stay direct children (unchanged) so the existing CSS motion selectors
  keep matching. Hotspots reuse the exact same `data-test` attribute/wiring
  as the button list (`wire()`'s `querySelectorAll('[data-test]')`) — zero
  new dispatch code — and are native `<button>` elements, so keyboard focus
  works for free without a hand-rolled `tabindex`/`keydown` handler. A
  gated hotspot (`continuity-test`) only renders when
  `testAvailability()` says available, same gate the button list uses; no
  duplicate "Requires Multimeter Tier 2" copy on the art.
- **Graphics mode:** both, by design (confirmed with Tom before implementing).
  Vector mode gets the full payoff — the SVG swaps to the matching
  `probe`/`leads`/`ajar` illustration. Raster mode (the default) has no
  interaction-state photos, so hotspots still run the test correctly but the
  `<img>` doesn't change — an explicit, documented interim state (GDD §2.1
  decision of record), not an oversight.
- **sw.js cache bumped?** yes v27→v28 (js/machine-art.js, js/diagnosis.js,
  js/ui/job.js, css/main.css all changed; no new app-shell files).
- **prefers-reduced-motion honored?** yes/n-a — no new keyframe animation was
  added; `.art-hotspot`'s hover/press transitions reuse `.btn`'s existing
  motion language, which itself isn't gated (only real keyframes are, per
  the existing reduced-motion block) — nothing new to add there.
- **Schema change?** none — pure render/interaction feature, no `state.*`
  shape touched.
- **Tests:** `node tests/run.js` → **338 passing, 0 failed** (+4: hotspot
  markup/gating, art-state-follows-last-test, raster-mode hotspot presence,
  a `HOTSPOTS` coverage test mirroring the existing webp-coverage pattern).
- **Open / unverified:** the raster-mode visual gap (no probe/leads/ajar
  photos) is the explicit next step for a future asset-pipeline session —
  15 renders (3 states × 5 machines) following `assets/generated/PROMPTS.md`'s
  process, then wire them into `GENERATED_MACHINES` in machine-art.js.
  Verified live at 8128/vector+raster/380px width: hotspots render and align
  visually over both raster photos and vector SVGs for the slushie machine
  (temp-probe left-bowl ring, inspect-beater service-bay ring); tapping a
  hotspot updates `testsRun`, shows the correct result text, and flips the
  art to the matching state exactly like the equivalent button click;
  continuity-test hotspot is absent pre-Multimeter-Tier-2 and appears after;
  keyboard focus works on a bare `<button>` with no extra wiring; zero
  console errors throughout. Did not visually check the other 4 machine
  types or desktop width this session — coordinates were sourced from the
  same values the SVG functions already use, so they're expected to line up,
  but a next session doing more visual polish should spot-check them.

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
