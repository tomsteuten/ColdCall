# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (Session 20 — interruption-safe Machine of the Day scoring)

Session 19 is complete. Proceed with Session 20 from the roadmap below
("Session 20 — Interruption-safe Machine of the Day scoring"). It needs one design
decision before coding (default recommendation in the roadmap: rank/share by tests
used first, simulated minutes second; never elapsed wall time). Read `GDD.md` §5,
`CLAUDE.md`, and this file first; inspect `js/motd.js`, `settleMotd`/`buildShareCard`
in `js/economy.js`/`js/motd.js`, and the share/result UI. Strongest model — shared
puzzle scoring is a correctness contract; keep deterministic date pinning and equal
tool access intact, and keep old saved results readable. Run `node tests/run.js`
before changing code; bump the sw.js cache if app-shell files change; don't push
without Tom's approval.

### What session 19 added (callback, staff, and offline clarity — GDD §3.1/§3.2)

- **Callbacks screen now shows timing and consequence (`callbacksView`).** It lists
  the *whole* queue, not just due entries: due callbacks get a Take button plus
  "Due now · expires in N days/tomorrow/today"; not-yet-due ones show "Returns
  tomorrow/in N days", a dimmed `.callback-card--pending` card, and "Not on site
  yet." instead of a Take button. Every row states the abandonment consequence —
  a player obligation reads "You owe this client — let it expire and lose 3 rep",
  a tech rescue reads "Optional rescue — expires with no penalty." Intro copy spells
  out the same tech-miss-vs-your-miss distinction. New helpers `dayDelta` /
  `relativeDayPhrase` in `js/ui/job.js` convert YYYY-MM-DD pairs to friendly phrases.
- **Home callbacks button no longer hides queued-but-not-due callbacks.** It now
  renders whenever `state.jobs.callbacks.length > 0` (was: only when due > 0) and
  labels itself "Callbacks (N)", "Callbacks (N ready · M soon)", or "Callbacks (M
  returning soon)". This closes the "offline report announces a callback that then
  vanishes" gap: tonight's tech misses are due *tomorrow*, so they're now visibly
  "returning soon" rather than absent until the next day.
- **Offline report is attributed per technician (`homeView` offline banner).** Uses
  the existing `techReports` detail (`{name, jobs, earned, callbacks}`) to render a
  per-tech list ("Dave: 3 jobs · $150", "Mike: 3 jobs · $100 · 1 miss"), keeps the
  aggregate "$X earned in total" line, and adds "N new callbacks — back on the board
  tomorrow, claim from Callbacks." so freshly-queued callbacks are explained, not
  left to seem to disappear. Tech names are escaped (`escapeHtml`).
- **Pre-hire staff explainer (`js/ui/shop.js`).** New exported `staffExplainerHTML()`
  renders before the hire button (when not at max): ~2 jobs/hour, 75% success,
  $50/job (always less than active play), offline sim up to 8h, "a botched job
  becomes a rescue callback you can claim — no reputation hit", and "No wage at
  launch — the $2000 hire is the only cost". All numbers read from `balance.js`
  (`TECHS`, `OFFLINE`), so the copy tracks any tuning.
- **No economy changes.** Pure render-from-state copy/clarity. `homeView`,
  `callbacksView`, and `staffHTML`/`staffExplainerHTML` are now exported so the
  markup tests can call them directly. `sw.js` cache bumped **v11 → v12** (job.js,
  shop.js, main.css changed).
- **Tests.** `node tests/run.js` → **211 passing, 0 failed** (+5): due-callback
  expiry timing + rep warning, not-yet-due tech rescue (untakeable, "Returns
  tomorrow", penalty-free, attributed), home button shows "returning soon" for a
  pending-only queue, per-tech offline attribution + the tomorrow note, and the
  staff explainer's five required facts. CSS for `.home-offline-techs`,
  `.callback-timing/.callback-consequence/.callback-pending/.callback-card--pending`,
  and `.staff-stats` from existing tokens.
- **Manual verification.** `preview-session19.html` (untracked, served at
  `/preview-session19.html`) renders all three views with the real CSS at 380px:
  home offline report lists both techs and the tomorrow note, the "1 ready · 1 soon"
  callbacks button, the callbacks screen contrasting a due player obligation against
  a returning tech rescue, and the pre-hire explainer. The managed preview panel
  couldn't bind (Tom's own python server already holds 8123), so this static
  snapshot stands in for an in-app screenshot.

### What session 18 added (light repair interaction and payoff — GDD §2.3)

- **Repair beat after a correct fix.** A brief "tighten it up" beat now plays
  between a correct diagnosis and the invoice: the machine's `working` art (full
  cyan product, green LED, "COOL"/"34°F") under a green "Running cold again."
  headline, a hold-to-tighten control, and an always-present **Skip**. Wrong fixes
  skip the beat entirely and go straight to the failure receipt (Session 17). MotD
  runs are unaffected (they have their own result screen, no invoice).
- **Settlement boundary chosen and proven.** Money still moves exactly once inside
  `commitFix`/`settleJob` — unchanged. The beat is pure post-settlement feedback:
  `commitSelectedFix` (`js/main.js`) sets a transient `repairBeat = {machineType}`
  only when `result.correct`, *after* the cash is already banked and saved. So a
  refresh mid-beat lands on home with the reward banked once — never duplicated,
  never lost. Verified live: during the beat the save already shows cash credited,
  `jobs.active: null`, `jobsCompleted` incremented; reloading stays on home with
  the same cash. No schema change was needed (everything is transient).
- **Feedback, not a skill gate.** Holding fills a bar over ~1s; releasing only
  pauses (never decays), so it cannot fail. Skip and keyboard Enter/Space both
  finish instantly — touch-accessible and interruption-safe. The rAF fill loop
  self-cancels once the element detaches (`bolt.isConnected`), so no animation
  outlives the view. `touch-action: none` on the bolt stops the hold from
  scrolling the page.
- **Files.** `js/main.js` (transient `repairBeat` + `finishRepair` action + render
  ctx), `js/ui/job.js` (new exported `repairView`, route ahead of the invoice,
  `wireRepairHold` using `querySelectorAll` to stay compatible with the test mock
  root), `css/main.css` (`.screen-repair`/`.repair-beat`/`.repair-bolt` styles
  from existing tokens). `sw.js` cache bumped **v10 → v11** (app-shell JS/CSS
  changed).
- **Tests.** `node tests/run.js` → **206 passing, 0 failed** (+3): repair beat
  renders working art with a holdable + skippable control, keyboard/skip wiring is
  present, and an unknown machine falls back to `[ repaired ]` text while staying
  skippable.
- **Manual verification.** At ~380px and desktop: correct soft-serve and slushie
  fixes both show their `working` illustration; hold-to-tighten fills and advances
  to the invoice; Skip advances instantly; a wrong fix shows no beat (failure
  lesson instead); refresh during the beat lands on home with cash banked exactly
  once. No console errors through the whole flow. (Note: manual playtesting was
  done against the real local `coldcall_save`, so the dev save advanced a few
  jobs/cash — cosmetic, no structural change.)

### What session 17 added (failure as learning + callback evidence persistence)

- **Failure receipt teaches (GDD §2.1).** A wrong fix now renders a "Where it went
  wrong" card below the receipt: the fix the player committed (warn-red) vs the
  correct fix (green), then concise fault-specific reasoning naming the
  discriminating clue and why the obvious wrong answer is a trap. A fresh miss adds
  "Your evidence so far is saved for the return visit"; the repeat-miss receipt
  omits it (it already says the machine returns). Correct fixes reveal nothing —
  the answer is never exposed before commit.
- **New `lesson` fault field.** Every fault now carries a required, player-facing
  `lesson` string (authored fresh, not the contributor `authenticityNote`),
  validated in `js/faults.js` like `flavour` and documented in
  `data/faults/SCHEMA.md`. The invoice falls back to a generic prompt if a future
  fault somehow lacks one. `commitFix` now returns `chosenFix` for the receipt.
- **Player-callback evidence persistence.** A wrong fix stores the tests the player
  ran as `evidence` on the queued callback (`settleJob`, new `testsRun` opt;
  `null` when committed blind). Claiming the callback restores those tests into the
  job's `testsRun` and recomputes the simulated clock (`startJob`), so the return
  visit continues the investigation — already-run tests show their real results
  immediately instead of charging for repeated button presses. Repeat misses
  accumulate evidence; idle-generated tech rescues carry no evidence and start
  clean, but a tech rescue the *player* then re-botches keeps the evidence they
  gathered. Restore filters out any test id no longer in the catalogue.
- **Schema v8 → v9 + migration.** Existing callbacks gain `evidence: null` (no
  invented history); an already-present evidence array is left intact.
- **PWA/tests.** `sw.js` cache bumped v9 → v10 (app-shell JS changed). `node
  tests/run.js` → 203 passing, 0 failed (+15): v9 migration (with and without
  prior evidence), settleJob evidence capture for both sources + blind + copy
  safety, commitFix `chosenFix`, the full claim → restore → repeat-miss round trip,
  tech-rescue clean start, unknown-test-id filtering, the new `lesson` validation,
  and three failure-receipt markup checks (fresh miss, repeat miss, correct-fix
  reveals nothing).
- **Manual verification.** At ~375px and desktop: fresh failure receipt shows
  chosen/correct fix + lesson + evidence note; the claimed callback opens with
  "Pull and inspect beater assembly" already resolved under the "Callback — reduced
  rate" badge; the lesson card stays in the centered column with no overflow at
  desktop width; no console errors through the whole flow.

### What session 16 added (diagnosis comprehension + first-job onboarding)

- **Integrated first-ticket guide.** A fresh standard ticket now teaches the
  symptoms → tests → commit loop inside the symptoms panel. It explains that
  tests reveal evidence at a simulated-minute/speed-bonus cost and that a wrong
  fix returns as a reduced-rate callback. The guide is derived from existing
  completion/callback stats, so no save schema change was needed.
- **Visible diagnostic economics.** Every unrun test now advertises its configured
  minute cost before selection. Fresh jobs also show the exact projected speed
  bonus transition from the current clock; callbacks show simulated time only,
  and MotD explains that the test adds to the shared score.
- **First irreversible-fix guard.** The first standard job pauses after a fix is
  selected and shows a compact inline confirmation naming the fix, stating that
  diagnosis ends, and warning about the reduced-rate callback. The player can
  commit or keep diagnosing. Returning players commit directly with no added
  friction. Pending confirmation is transient and never reshapes a save.
- **Inspection art corrected.** Both machine `open` states retain fault colours,
  amber indicators, and fault messaging while exposing internals. `working`
  remains a distinct cyan/green state for the later repair-payoff session.
- **PWA/tests.** `sw.js` cache bumped v8 → v9. `node tests/run.js` reports 187
  passing, 0 failed. New coverage checks projected cost copy, first-job guidance,
  confirmation markup, returning-player behavior, and open-vs-working art.
- **Manual verification.** Fresh, returning, and confirmation states were rendered
  with the real template/CSS in a 380px app container; fresh/returning and open
  inspection states were also checked at desktop width. No overflow or wrapping
  issues were found, and the open slushie remains amber with `E-04`.

### What session 15 added (character portraits + callback attribution)

- **Client portraits and character flavour.** `data/clients.json` now stores a
  recurring contact, role, flavour line, and compact portrait palette/expression
  data for Nina Patel at Kwik Stop and Cheryl Voss at Burgertown High Street.
  `js/character-art.js` turns that data into blocky inline SVG portraits, matching
  the machine-art direction without adding raster assets or runtime requests.
- **Reliable fallback.** Missing/invalid portrait data returns `null`; the job UI
  keeps the caller name/flavour in a text-only layout and never shows a broken
  image frame. Portrait colours are allowlisted as six-digit hex values before
  interpolation into SVG.
- **Job UI personality.** The active ticket header now includes the caller
  portrait, name, role, and a short character line. MotD remains caller-free.
- **Correct tech attribution.** New idle callbacks store `techId` and `techName`.
  Claiming a callback copies both onto the active job, and a repeat failed rescue
  requeues them unchanged. Callback labels now show the actual responsible tech
  (for example, "Mike's miss") instead of hard-coding Dave.
- **Safe migration.** Schema v7 -> v8 adds explicit null attribution to legacy
  queued and active tech callbacks because their responsible tech cannot be
  reconstructed. The UI renders those as neutral "tech miss"; player callbacks
  remain "your miss".
- **Save-derived escaping.** Technician names are escaped at the callback-list
  innerHTML boundary. Tests include an imported-name HTML/onerror payload.
- **PWA.** `sw.js` cache bumped v7 -> v8 and `js/character-art.js` added to the
  app shell. No external portrait assets were added.
- **Tests.** `node tests/run.js` -> 183 passing, 0 failed. Added focused coverage
  for v7 migration, preserved attribution, Dave/Mike offline attribution, repeat
  rescue attribution, portrait rendering, invalid portrait data, text fallback,
  neutral source labels, and save-derived technician-name escaping.
- **Manual verification still useful:** open locally at about 380px and desktop
  width to inspect portrait proportions and caller copy wrapping. Syntax checks
  and the complete automated suite are green.

### What session 13 added (save & idle hardening)

- **#1 — schemaVersion validation (High; session 13 / REVIEW_FINDINGS #1).**
  `migrate()` now rejects any `schemaVersion` that is present but invalid (string,
  NaN/Infinity, negative, fractional) with a thrown error — `load()` then
  preserves the blob untouched (saves are sacred, CLAUDE.md rule 1). Only a
  *missing* version is treated as v0 (the pre-release flat shape genuinely had
  no field); an explicit `null` is rejected. The old code coerced any non-number
  (including `"6"` and `null`) to 0 and rebuilt from defaults — a silent wipe.
  Tests: string, null, fractional, negative, Infinity, and full `load()` paths.

- **#2 — Offline job-carry (Medium; session 13 / REVIEW_FINDINGS #2).**
  New `offlineJobCarry: 0` field on the state (schema v6→v7, migration added).
  `simulateOfflineProgress()` now adds `state.offlineJobCarry` to the raw job
  count before `Math.floor()`, then stores the fractional remainder back so it
  accumulates across sessions. The carry is updated *before* the "nothing
  happened" early return, so a session that produces zero complete jobs still
  saves the sub-job progress. Tests: two short sessions == one long session;
  carry completes a job on the next session; carry doesn't bypass the 8h cap.

- **#4 — XSS / innerHTML injection (Medium; session 13 / REVIEW_FINDINGS #4).**
  New `js/utils.js` exports `escapeHtml(str)` (5-char entity replacement). Applied
  in `ui/job.js` to `cb.clientId` and `job.clientId` fallbacks (the save-derived
  strings in templates), and in `ui/shop.js` to `t.name` (tech name from save) and
  `importError` (may reflect save content in an error message). Static-data fields
  (`client.name`, fault text from JSON files) are not save-derived and were left as
  is — the fix targets the actual save-state injection surface. Tests: 9 new tests
  in `tests/utils.test.js` covering `<`, `>`, `&`, quotes, and an onerror= payload.

- **#3 — Tech wages: RESOLVED (no code).** GDD §6 already records that techs have
  no running wage at v1.0; `balance.js` keeps `dailyWage` as an unused knob.
  Nothing to implement.

- `sw.js` cache bumped v4 → v5 (utils.js added to app shell).
- SCHEMA_VERSION bumped 6 → 7.
- Tests: `node tests/run.js` — 167 passing (was 147). 20 new tests.
- Verified: all three fixes confirmed by the test suite. No console errors from a
  fresh run. (Manual play verification at 380px: state loads and saves correctly;
  shop renders tech names; offline report banner shows. Run locally to confirm.)

---

### What session 10 added (callback choice + rescue split, GDD §3.1)

- Two callback kinds. `state.jobs.callbacks` entries now carry `source`
  ('player' obligation | 'tech' rescue) and an `expiryDay`. economy.js settleJob
  pays a source-dependent rate on a correct callback: player → callbackJobPayoutMult
  (0.4 of net), tech → rescueCallbackPayoutMult (0.9 of net, MUST stay < 1.0 so
  rescues never beat fresh — invariant test pins this). No source ⇒ player rate
  (conservative back-compat). idle.js tags its queued callbacks source 'tech'.
- Claiming is a choice. `claimDueCallback` is gone; new `claimCallback(state,
  faults, index, now)` claims the specific entry the player picked from the
  Callbacks list. main.js `nextTicket` no longer auto-claims — fresh tickets
  only. New actions: openCallbacks/closeCallbacks (screen='callbacks') and
  takeCallback(index).
- Expiry, computed on load like offline progress. New `expireCallbacks(state,
  now)` removes callbacks past their expiryDay. Player obligations expiring cost
  expiredCallbackRepPenalty rep EACH; tech rescues expire silently (optional
  bonus, not a debt — this nuance is a GDD §3.1 decision of record I added).
  Reported in a transient home banner.
- Schema v5→v6 migration: existing callbacks → source 'player' (lower rate) with
  expiryDay = dueDay + callbackExpiryDays (full claim window preserved).
  Migration tests with v5 fixtures (with-callback + empty cases).
- balance.js knobs (all new): JOBS.rescueCallbackPayoutMult 0.9,
  JOBS.callbackExpiryDays 3, REPUTATION.expiredCallbackRepPenalty 3.
- UI (ui/job.js): home shows a separate "Callbacks (n)" button + an expiry
  banner; new callbacks screen lists due callbacks with rate + source ("your
  miss" 40% vs "Dave's miss" 90%); invoice shows "Rescue rate ×90%" /
  "Callback rate ×40%". sw.js cache bumped v1→v2. CSS for the list/banner.
- Tests: `node tests/run.js` — 139 passing (was 128). Verified at 380px in the
  preview: expiry banner + −3 rep on load, both callback kinds listed with
  correct rates, a tech rescue paid net×0.9 = $108 (payout 140 − parts 20),
  "Next ticket" starts a fresh job and leaves callbacks queued, no console errors.

Note: REVIEW_FINDINGS.md (untracked) item 7 (mandatory callbacks) is now
addressed by this session. Still safe to delete — left for Tom.

---

## What session 12 added (MotD polish + correctness bugs)

- **UTC-midnight date pinning (REVIEW_FINDINGS #5).** `startJob()` now accepts
  a `puzzleDateStr` arg (7th param, optional) and stores it on the active job.
  `settleMotd()` accepts it as a 7th param (after `now`) and uses it as the
  canonical puzzle date instead of re-reading the clock at settlement time; the
  date is stored in `lastResult.puzzleDateStr`. `commitFix()` threads the stored
  date through. `startMotd()` in main.js passes `todayStr`. The share card and
  result screen both use the pinned date, so a player who starts a puzzle at
  23:55 and commits at 00:05 sees the right day number and their result counts
  against the right date's streak. Tests: midnight-crossing settle uses the
  start day; streak still increments correctly across the boundary.
- **MotD tool access (REVIEW_FINDINGS #7).** `testAvailability()` in diagnosis.js
  skips the tier gate when `state.jobs.active?.motd` is true — the shared daily
  puzzle must be equally solvable by every player. Tier-1 players can now run the
  continuity test on a MotD job. Regular jobs are unaffected. Test added.
- **MotD result screen polish (GDD §5).** New `.motd-card` component wraps the
  result in a bordered card (success-coloured border on a win, warn on a loss).
  Emoji grid bumped to `--text-3xl`; verdict heading at `--text-2xl`. Added
  clean-streak flourish (🧹 N clean in a row, green) and callback-shame flourish
  (⚠️ N callbacks waiting, warn) — clean streak wins when both are non-zero.
  `buildShareCard()` gains an optional third `{ cleanStreak, callbackCount }`
  arg so the flourish appears in the share text too. `shareMotd()` passes live
  stats. Share button shows "📋 Copy result".
- `sw.js` cache bumped v3 → v4.
- Tests: `node tests/run.js` — 147 passing (was 139). New tests: UTC-midnight
  settle, streak-across-midnight, MotD tool access, 5 share-card stats tests.
- Verified at ~380px in the preview: solved card (green border, 🔥 streak, 🧹
  clean), failed card (warn border, ⚠️ callbacks, correct fix revealed), share
  text round-trips, no console errors.

---

## What session 14 added (machine sprites — SVG illustrations)

- **Art approach (deviation from GDD §7 pixel-art spec, agreed by Tom):**
  Inline SVG machine illustrations rather than raster pixel art. SVGs are crisp at
  any resolution, state variants are free colour/shape changes, nothing extra to
  cache, and fully maintainable without a separate art pipeline. The blocky palette
  and limited-colour approach reads as the same aesthetic in practice.

- **`js/machine-art.js`** — new module. Exports `machineSvg(machineId, state)`
  which returns an inline SVG string for a known machine, or `null` for unknown
  IDs (caller renders a text fallback). Three states per machine:
  `'fault'` (machine showing symptoms, panel closed — shown before any tests run),
  `'open'` (panel open for inspection — shown after first test run),
  `'working'` (fixed and running — available for preview tool / future invoice art).

- **Slushie Machine (`slushie-machine`):** twin-bowl countertop unit. Two
  glass-fronted bowls with a central divider. Fault → darker depleted fluid (opacity
  0.4), amber LED, amber screen "E-04", warning dot on panel. Open → lids removed,
  agitator cross-paddles visible in each bowl. Working → full cyan fluid, green LED,
  green screen "COOL".

- **Soft Serve Commercial (`soft-serve-commercial`):** tall commercial unit.
  Two mix hoppers at top, front service panel with display, status LED, two
  dispense levers at bottom. Fault → nearly-empty hoppers (opacity 0.35), amber
  LED, amber screen "E-13", warning dot on panel. Open → panel swung to the side
  (partially exits viewBox for a natural "removed" look), barrel/freeze cylinder
  with drive shaft and evaporator coil visible. Working → full hoppers, green LED,
  "34°F" on display.

- **`js/ui/job.js`** — imports `machineSvg`; derives `artState` from
  `job.testsRun.length > 0 ? 'open' : 'fault'`; renders `.art-slot--has-image`
  when SVG is available, `.art-slot` text fallback when not. No unknown-machine
  crashes.

- **`css/main.css`** — added `.art-slot--has-image` modifier: `border-color:
  transparent; color: transparent; padding: 0` — hides the placeholder dashed
  frame when a real illustration fills the slot.

- **`machine-css-preview.html`** (root level) — filled in as a standalone dev
  tool. Imports `js/machine-art.js` as an ES module; renders all machines × all
  states at `.art-slot` proportions on a dark background matching the game. Open
  with any static server (`python -m http.server 8123` → `/machine-css-preview.html`).

- **Stabilization pass:** repaired the invoice result markup so its styled Done
  button dismisses correctly; fixed multi-tech offline carry; rejected explicit
  null save schema versions; escaped the remaining save-derived job labels.
- `sw.js` cache bumped v5 → v7; `js/machine-art.js` added to app shell.
- Tests: `node tests/run.js` — 175 passing, 0 failed, including UI-markup and
  machine-art regression coverage.
- Verified at ~380px: slushie and soft-serve illustrations render in the art-slot
  frame on the job screen; fault state (before tests) shows amber indicators; open
  state (after first test) shows internals; text fallback shown for any unrecognised
  machine ID. No console errors.

---

This is a plan, not a contract — reorder or drop items as taste dictates. Each
session is sized to one branch. "Model" is the recommendation per CLAUDE.md's
guidance (CSS/wiring/flavour → mid model; state/economy/engine → strongest).
"Start with" tells you whether the session is fully specified here (just say
"proceed with session N from notes.md") or needs a decision/prompt from you first.

Findings from `REVIEW_FINDINGS.md` (Codex's post-session-10 read-only review,
2026-06-13) were folded into sessions 12-15 where warranted. A second holistic
senior game-dev UX/playability review after Session 15 found that the largest
remaining launch risk is not code stability but whether players understand and
learn the diagnosis game. The upcoming arc is therefore reordered around:

1. diagnosis comprehension and onboarding (Session 16);
2. failure as useful learning (Session 17);
3. repair feedback and emotional payoff (Session 18);
4. callback/idle clarity (Session 19);
5. fair interruption-safe MotD scoring (Session 20).

Confirmed lower-priority polish from that review — desktop scaling, save/settings
information architecture, rotating character dialogue, and audio — remains after
the core-loop work. This supersedes the old plan where the repair interaction was
Session 16.

General rules for every session below: read GDD §7 (art/audio direction) + §2/§5
and CLAUDE.md before coding; keep the no-build / vanilla-DOM constraints; mobile
-first at ~380px AND check desktop; run `node tests/run.js`; bump the sw.js cache
name if app-shell files change; small commits; don't push until Tom says so;
update this file at the end.

### Session 11 — Visual identity & CSS/layout pass (no new assets)
- **Model:** Sonnet (pure CSS/DOM, no architecture). 
- **Start with:** just "proceed with session 11 from notes.md" — fully specified,
  no decisions needed.
- **Scope:** Make the whole app look intentional without adding image assets.
  Replace the placeholder "dev-title" home with a real title/brand treatment;
  establish a type scale, spacing rhythm, and button hierarchy in css/main.css
  via the existing custom properties; add light screen-to-screen transitions;
  make the invoice read like a printed receipt; make the diagnosis/job screen
  read like *inspecting a machine*, not filling in a form (group symptoms/tests/
  fix as distinct panels). Establish a small set of reusable component classes so
  later art slots drop into a stable frame.
- **Why first:** zero asset-pipeline risk, fully reversible, and you want the
  frame settled before pouring sprites into it. De-risks sessions 13–14.
- **Done when:** every screen (home, callbacks, job, invoice, shop, MotD result)
  looks deliberate at 380px and on desktop; no test or console regressions;
  screenshots in the handover.

### Session 12 — Machine of the Day polish + the two MotD correctness bugs
- **Model:** Sonnet (presentation + small motd.js/diagnosis.js threading — no
  economy maths).
- **Start with:** "proceed with session 12 from notes.md" — fully specified.
- **Scope (UI):** The MotD result screen is the growth engine (GDD §5), still an
  emoji-text grid. Make it genuinely screenshot-worthy on top of the session-11
  identity; refine buildShareCard() copy/layout (keep it copy-paste plain text —
  that's the Wordle hook); add clean-streak / callback-shame flourish (GDD §5).
- **Scope (fold in REVIEW_FINDINGS #5 — agreed, narrow but clean):** the MotD
  puzzle date is read three times (pick at start, settle on commit, share on
  share) and can disagree across a UTC-midnight crossing. Store the puzzle's UTC
  date on the active MotD job at startMotd(), then thread that stored date into
  settleMotd() and buildShareCard() / streak / once-per-day state instead of
  re-reading "today". Add a test that starts before UTC midnight and settles after.
- **Scope (fold in REVIEW_FINDINGS #7 — agreed, matters for the shared-puzzle
  hook):** MotD draws from all tiers but the continuity test is gated behind
  Multimeter Tier 2, so players get different tool access on the *same* shared
  puzzle — unfair tests-used/time scores. Make the full launch test set available
  during a MotD run (simplest fair rule): have testAvailability() treat a MotD job
  as ungated, or pass a "motd" flag through. Test that a tier-1 player can run the
  continuity test on a MotD job.
- **Done when:** result screen looks share-worthy at 380px; share text still
  round-trips; the midnight and tool-access tests are green; full suite green.

### Session 13 — Save & idle hardening ✓ DONE (this session)
- See "What session 13 added" above.
- **Model:** Opus (strongest) — schema-version validation, offline-progress maths,
  and save security are squarely rule-1 / engine territory (CLAUDE.md).
- **Start with:** "proceed with session 13 from notes.md" — specified. (The one
  judgement call inside, the tech-wage question, is laid out below; default to
  deferring it in the GDD unless Tom says otherwise.) This is the one non-UI
  detour in the track — slotted here deliberately because the art sessions (14–15)
  are blocked on Tom's art-source decision anyway, so this fills that gap with
  high-value pre-launch correctness work.
- **#1 (agree — High; trigger is narrow but the downside is a silent save reset,
  and the fix is trivial):** migrate() treats any non-number schemaVersion as v0,
  so a current save with `"schemaVersion":"6"` (string) is rebuilt from defaults
  and can then be persisted — a wiped save. Fix: only treat a *missing* version as
  v0 (and ideally only when the object looks like the flat v0 shape); reject a
  present-but-invalid version (string / NaN / negative / fractional) as an error
  that preserves the blob untouched (saves are sacred). Tests for string, null,
  fractional, negative, NaN-like versions.
- **#2 (agree — Medium; real idle-correctness flaw):** offline jobs use
  `Math.floor(hours * jobsPerHour)` and boot save stamps lastSeen = now, so the
  sub-job remainder is discarded every load — frequent short sessions earn less
  than one long absence. Fix: carry the unsimulated remainder so it accumulates,
  WITHOUT letting it bypass the 8h cap (carry only the within-cap partial-job
  remainder; forfeit time beyond the cap as designed). Mind that save() currently
  always stamps lastSeen = Date.now() — the fix likely needs either a carry field
  (schema +1 with migration) or to advance lastSeen by exactly the consumed
  duration. Tests: two short absences == one combined absence; carry interacts
  correctly with the cap.
- **#4 (agree — Medium; matters because saves are shareable text blobs):**
  state-derived strings (tech.name, client IDs, MotD fields) are interpolated into
  innerHTML, and importSave() doesn't sanitize nested strings — a hostile shared
  blob can inject HTML/handlers. Fix: one small escapeHtml() helper applied to
  every state-derived value in the template strings (ui/job.js, ui/shop.js, etc.),
  and/or validate nested entries on import. Tests with `<`, `>`, quotes, and
  `onerror=`-style markup. (No live users yet — pre-launch is the right time.)
- **#3 — RESOLVED (no code work):** Tom decided to defer tech wages to v1.x. GDD
  §6 now states techs have no running wage at launch (hire price only); balance.js
  already keeps `dailyWage` as an unused v1.x knob, so GDD and code agree. Nothing
  to implement — this finding is closed; do NOT add wage deduction this session.
- **Done when:** the chosen fixes land with tests; no save can silently reset;
  imported text can't inject; full suite green.

### Session 14 — Machine sprites ✓ DONE (this session)
- See "What session 14 added" below.
- **Model:** Sonnet for the integration/state-variant wiring (the logic is
  trivial); the hard part is art production, not code.
- **Start with:** **a short prompt from Tom — this session is blocked on one
  decision:** where the machine art comes from. Options: (a) Tom draws/sources
  pixel art himself and drops files in /assets, (b) CC0/asset-pack sprites, (c) an
  AI-pixel-art workflow. Tell the next session which, and (if a/b) have at least
  one machine's sprite set committed first. Until that's answered, don't start.
- **Scope:** Drop sprites into the `.art-slot` frame session 11 already added to
  the job screen — one sprite per machine type with working / fault / open-panel
  state variants (GDD §7), driven from machines.json. Graceful text fallback when
  a sprite is missing so the game never breaks on un-arted machines. Add sprite
  paths to the sw.js app-shell list (and bump the cache name).
- **Done when:** at least the tier-1/2 star machines show state-appropriate
  sprites, missing-art fallback verified, PWA still caches offline.

### Session 15 — Character portraits + correct tech attribution (REVIEW_FINDINGS #8) ✓ DONE
- **Model:** Sonnet (wiring/CSS + flavour; #8 is a tiny shape change — if it grows
  a migration, that part is still simple).
- **Start with:** shares session 14's art-source decision — once that's settled,
  "proceed with session 15 from notes.md" works; otherwise supply it inline.
- **Scope (UI):** Simple portraits in the ticket/job dialog (GDD §4/§7 — recurring
  Burgertown manager personalities, big personality-per-byte return). Portrait
  data lives in clients.json; text-only fallback. Lean into the comedy/flavour.
- **Scope (fold in REVIEW_FINDINGS #8 — agree, minor):** every tech-caused callback
  currently shows "Dave's miss" because callbacks don't record which tech botched
  the job; Mike's misses are mis-attributed. Since this session adds tech
  personality anyway, do it properly: store techId/techName on tech-generated
  callbacks (idle.js) with a migration for existing entries, and have
  sourceLabel() use it. (If that feels like scope creep, the cheap fallback is a
  neutral "tech miss" label — but proper attribution pays off with the portraits.)
- **Done when:** clients show portraits + a line of character; callbacks name the
  actual tech (or a neutral label); fallback verified; tests green.

### Session 16 — Diagnosis comprehension and first-job onboarding
- **Model:** Sonnet/mid is sufficient if onboarding remains transient UI state;
  use the strongest model if a save-shape decision becomes necessary.
- **Start with:** "proceed with session 16 from notes.md" — fully specified.
- **Why now:** the senior review found that a fresh player is dropped directly
  into four diagnostics and irreversible fix buttons without being taught the
  deduction loop, callback risk, or the cost of gathering evidence. Diagnosis is
  the primary design pillar, so comprehension comes before adding more juice.
- **Scope — concise onboarding:** teach symptoms → tests → commit to a fix during
  the first ticket, in context. Avoid a long modal or separate manual. Explain
  that tests reveal evidence but spend simulated job minutes, and a wrong fix
  creates a reduced-rate callback. Keep returning-player friction near zero.
- **Scope — visible test economics:** put each available test's simulated-minute
  cost on the button/row before it is run, and make the resulting speed-bonus
  consequence legible before the click. The player must be able to compare a
  cheap vague test with a slow informative one without consulting the GDD.
- **Scope — first irreversible choice:** before the first fix commit, clearly
  communicate that choosing a fix ends the diagnosis and that a wrong answer
  causes a callback. A one-time lightweight confirmation or inline first-job
  guard is acceptable; do not add confirmation friction to every later job.
- **Scope — art-state correction:** running a diagnostic currently changes the
  slushie illustration to cyan fluid/green light/"COOL", visually implying the
  fault is repaired. Make the open/inspection state remain visibly faulty while
  showing the internals. Preserve distinct `fault`, `open`, and `working` states.
- **State guidance:** prefer deriving first-job onboarding from existing stats
  (`jobsCompleted`, `callbacksCaused`, active job tests) or transient state. If a
  durable onboarding flag is genuinely needed, bump the schema and migrate/test
  it; never silently reshape saves.
- **Out of scope:** revealing the correct answer after failure, preserving tests
  on callbacks, the repair interaction, MotD timing changes, staff/idle changes,
  desktop redesign, audio, and broad balance retuning.
- **Tests/manual verification:** add focused UI/state tests for test-cost labels,
  first-fix warning behavior, returning-player behavior, and the open art state.
  Verify fresh and returning saves at ~380px and desktop width.
- **Done when:** a new player can explain the diagnosis loop and its risk/reward
  from the first job; every test advertises its cost before use; the first fix is
  knowingly irreversible; inspection art no longer looks repaired; full suite
  and manual checks are green.

### Session 17 — Failure as learning ✓ DONE
- See "What session 17 added" near the top of this file.
- **Model:** strongest. This may change callback/active-job state and therefore
  touches save migrations and the settlement path.
- **Start with:** "proceed with session 17 from notes.md" — specified, but decide
  the evidence-persistence shape after inspecting the smallest safe approach.
- **Scope:** make a wrong diagnosis educational. The failure receipt should show
  the player's chosen fix, the correct fix, and concise fault-specific reasoning
  explaining the discriminating clue. Avoid revealing hidden data before commit.
- **Scope:** preserve or review the evidence gathered on a player-caused callback
  so tomorrow's return visit feels like continuing an investigation rather than
  paying to repeat forgotten button presses. Tech rescues may start clean unless
  a better fiction emerges.
- **Data guidance:** add a player-facing diagnostic explanation field to fault
  data if needed; validate it like other fault fields. Do not expose contributor
  `authenticityNote` verbatim as the default UI copy unless it reads naturally.
- **Done when:** failure clearly teaches how to make a better call next time,
  callback evidence behavior is refresh-safe and migrated, and tests cover both
  callback sources plus repeat misses.

### Session 18 — Light repair interaction and payoff (GDD §2.3) ✓ DONE
- See "What session 18 added" near the top of this file.
- **Model:** strongest — it touches the active-job → invoice settlement flow.
- **Start with:** "proceed with session 18 from notes.md" — fully specified.
- **Scope:** after a correct diagnosis, add a brief satisfying repair beat
  (hold-to-tighten or short sequence tap), then show the machine's `working` art
  before the invoice. It is feedback, not a second skill gate.
- **Constraints:** no economy or simulated-time penalty, accessible on touch,
  skippable/instant-safe, and interruption-safe. Refresh may neither duplicate nor
  lose a reward; choose and test an explicit settlement boundary.
- **Done when:** correct diagnosis has tactile and visual payoff, the working
  illustration is actually seen in normal play, and refresh safety is proven.

### Session 19 — Callback, staff, and offline clarity
- **Model:** Sonnet/mid for copy/UI; strongest if callback state changes.
- **Start with:** "proceed with session 19 from notes.md" — fully specified.
- **Scope — callbacks:** show due/expiry information and clearly distinguish the
  reputation consequence of abandoning a player obligation from the penalty-free
  expiry of an optional tech rescue. Explain future/not-yet-due callbacks so an
  offline report cannot announce one that then seems to vanish.
- **Scope — staff purchase:** before the $2,000 hire, explain expected jobs/hour,
  success rate, offline cap, callback risk, and that launch techs have no wage.
- **Scope — offline report:** use the existing `techReports` detail to attribute
  jobs, earnings, and misses per technician instead of showing only aggregates.
- **Done when:** callback timing/consequences and technician value are legible
  before decisions are made, with no economy changes required.

### Session 20 — Interruption-safe Machine of the Day scoring
- **Model:** strongest because shared-puzzle scoring is a correctness contract.
- **Start with:** "proceed with session 20 from notes.md" — requires one design
  decision: replace wall-clock solve time with either simulated diagnostic minutes
  or omit time and rank/share only tests used. Default recommendation: tests used
  first, simulated minutes second; never elapsed wall time.
- **Scope:** remove `Date.now() - startedAt` as the score because phone calls,
  sleep, refreshes, and accessibility needs currently worsen a supposedly shared
  fair result. Keep deterministic date pinning and equal tool access intact.
- **Done when:** interruption cannot worsen the score, share/result copy reflects
  the new measure, old saved results remain readable, and tests cover refresh and
  midnight boundaries.

### Not-yet-scheduled (deliberately after the core-loop arc)
- **Desktop layout:** use the available width intentionally above mobile sizes,
  likely with a two-column diagnosis layout while preserving the focused 380px
  experience. The current app remains a 480px column on large screens.
- **Settings/save information architecture:** move save transfer out of "Tools
  shop", replace implementation errors such as "URI malformed" with player-facing
  copy, and expose audio/settings in a coherent location.
- **Character variation:** rotate or contextually select caller lines so recurring
  personalities stay charming instead of repeating one quote every ticket.
- **Audio** (GDD §7): satisfying clicks, perfect-job jingle, one chiptune loop;
  CC0/generated; GDD says polish-phase, not a launch blocker. Sonnet.
- **A balance/fun playtest pass** (GDD §10: "fun with all numbers set to 1"). No
  evidence this has happened. Not a UI task, but don't let it slip indefinitely —
  the visual work above also makes a playtest read more clearly. Strongest model
  if it turns into economy retuning.
- **v1.x systems** (Tiers 3–4, prestige, workshop, tech specialisation, tech wages
  if deferred in session 13 — GDD §9): strongest model; out of scope for now.

---

## What session 11 added (visual identity & CSS/layout pass)

- Full design-system rewrite in `css/main.css`. All colours consolidated as CSS
  variables (`--warn`, `--success`, `--amber`); type scale (`--text-xs` →
  `--text-3xl`); spacing rhythm (`--space-xs` → `--space-xl`); shape tokens
  (`--radius-sm`, `--radius-lg`). No hard-coded hex or px values remain in the
  CSS outside `:root`.
- Screen-to-screen transition: `@keyframes screen-in` (opacity + 6 px
  translateY, 0.15 s) fires automatically on every `.screen` element creation —
  no JS changes needed.
- Status bar converted to a 3-column grid with a hairline separator; uses
  `font-variant-numeric: tabular-nums`.
- New reusable component classes: `.card`, `.panel` / `.panel-label`, `.badge`
  (with `--warn` / `--success` modifiers), `.art-slot` (dashed placeholder
  frame for future machine sprites), `.divider`.
- Button hierarchy: all border-colour variants now use CSS variables; added
  `.screen-home .btn { text-align: center }` so every home-screen nav button
  is centred (fixes pre-existing "Tools shop" off-centre issue).
- Home screen: `.dev-title` / `.dev-meta` replaced with `.game-brand` block —
  ❄ logo glyph with `drop-shadow` glow, `font-variant-emoji: text`, bold
  `COLD CALL` wordmark (accent / white split), italic tagline.
- Job screen: each section wrapped in a `.panel` with a `.panel-label` header;
  badge chips replace inline `<p>` tags for callback/MotD status; `.art-slot`
  placeholder frame added between machine info and symptoms panel.
- Invoice screen: flat `<p>` lines replaced with a `.receipt` card (warm
  off-white `#f5f0e8` background, Courier New, dashed separators, green/red
  outcome line) in a `.invoice-actions` wrapper — the "payment moment" is now
  visually distinct from the rest of the dark UI.
- `sw.js` cache bumped v2 → v3.
- Tests: `node tests/run.js` — 139 passing, 0 failed (no regressions).
- Verified at 375 px mobile: home brand block, button hierarchy, panel layout
  on job screen all render correctly. No console errors.

---

## Archived session 9–10 starting context

Sessions 1–10 are done, committed, and pushed to origin/main. Everything from
session 8, plus session 9 additions:

- Simulated job clock + speed bonus (GDD §2.1). config/balance.js DIAGNOSIS:
  testMinutes (error-log 2, temp-probe 5, inspect-beater 15, continuity-test 8),
  speedBonusMax 40, bonusDecayPerMin 2 ($40 ≈ 30% of a tier-1 payout; bonus
  hits $0 at 20 min, so running all four tests = 30 min forfeits it).
- jobs.active gained minutesSpent (state-shape change). diagnosis.js: startJob
  inits it to 0; runTest adds DIAGNOSIS.testMinutes[testId] the first time each
  test runs (re-reads are free). The clock is never wall-time — only player acts
  advance it, so interruptions don't punish.
- economy.js: exported speedBonus(minutesSpent) = max(0, round(speedBonusMax −
  minutesSpent×bonusDecayPerMin)). settleJob adds it ONLY on a correct fresh fix
  (no bonus on callbacks or MotD). commitFix returns minutesSpent for the invoice.
- Schema v4→v5 migration: an in-flight active job missing minutesSpent defaults
  to 0 (keeps the full bonus — never retroactively punishes a job on the bench).
  Migration test with a v4 fixture (active job + no-active-job cases).
- UI: job screen shows "Job clock: N min · Speed bonus: $X" (fresh non-MotD
  jobs only); invoice shows a "Speed bonus +$X" line on a correct fresh fix.
  .job-clock styling in css/main.css.
- New invariant tests (economy.test.js): informed diagnosis beats blind-guess EV
  and exhaustive testing; speed bonus never lets a callback rescue out-earn a
  fresh fix; bonus is purely additive so active>idle still holds.

Tests: `node tests/run.js` — 128 passing. Verified at 375px (clock decays on
tests, invoice bonus line, cash math correct, no console errors).

Note: REVIEW_FINDINGS.md (untracked) is a STALE read-only review from before the
PWA/idle/corrupt-save work landed — items 1, 4, and 8 are already done. Its
items 5 (MotD identity, now pinned via faultId) are also addressed. Safe to
delete; left in the tree for Tom to skim first.

---

## Queued session prompts (decisions confirmed by Tom, recorded in GDD)

Every queued pre-launch *design* decision is implemented (session 10 closed the
last one). The next arc is the UI/graphics polish track — see "Roadmap (sessions
11–15)" above for the per-session plan, model recommendations, and which sessions
need a decision from Tom before starting (sprites/portraits art source) vs. which
you can just "proceed with".

## v1.0 scope — all items shipped

Session 8 closed the last two GDD §9 items (PWA + save export/import). Session 9
landed the diagnosis test costs / speed bonus. Session 10 landed the callback
choice + rescue split — the last queued pre-launch design item. The full GDD §9
v1.0 scope is now implemented at schema v6.
