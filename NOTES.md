# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Status (Session 28 done — diagnosis information-design pass: evidence not verdicts; committed, NOT pushed)

**Session 28 worked candidate (1) from session 27's list: the inspect-beater
dominance problem.** `node tests/run.js` → **334 passing, 0 failed** (+23:
20 per-machine/per-test uniqueness caps, a fairness guard, a label check, a
verdict-phrase lint). sw.js cache **v25**. Schema stays **v14** — no state
shape, `config/balance.js`, or `economy.js` changes (rule 5 untouched by
construction).

### What shipped

- **Machine-specific test labels + generics** (`TESTS[...].machine` in
  `js/diagnosis.js`, new `testLabel()`/`testGeneric()`, wired in
  `js/ui/job.js`): inspect reads "Pull the lid and inspect bowl and auger" on
  the slushie, "Open the door and inspect the evaporator" on the ice
  dispenser, etc. The ice machine's "N/A (no beater)" hack is gone. The
  generic "nothing unusual" line is machine-flavoured too. Default
  label/generic still apply to unknown machine types (tested).
- **All 51 fault files rewritten: results are observations, not verdicts.**
  Each test now has a fixed observation scope (SCHEMA.md documents it):
  inspect can't see the condenser/compressor/supply; the log reports codes and
  timestamps, not narrative conclusions; continuity reports readings ("run
  capacitor measures a fraction of its rated microfarads"), never "it's dead".
  Evidence that lived in the wrong instrument moved (e.g. the seized condenser
  fan is now a silent-grille temp-probe observation); evidence a test couldn't
  honestly show was deleted so the generic speaks. The core mechanic:
  **faults on the same machine that would present the same observation share
  the exact same result string** (barrel-freeze-up + worn-scraper-blades both
  show "Hard ice built up on the barrel wall…"; hopper-thermistor-drift +
  heat-treat-sensor-fault share the probe-vs-panel disagreement line), so a
  single result stays ambiguous and the answer lives in combining
  symptoms + tests. Redundant variant test-overrides (re-flavoured verdicts)
  were deleted — variant COUNTS are unchanged, so seeded draws, MotD
  determinism and callback replays are unaffected. ~8 lessons updated where
  they cited evidence that moved.
- **Invariant test** (`tests/information-design.test.js`) over the real
  library: per machine, a single ungated test may uniquely identify at most
  ceil(30%) of the pool; the tier-2-gated continuity test gets ceil(60%) —
  deliberately looser, the paid-for meter is SUPPOSED to be decisive (bounded
  by the tool gate + time cost, not ambiguity). Plus: no two faults on a
  machine may present identical symptoms AND identical full evidence
  (unsolvable-job guard); every machine has a sensible inspect label; verdict
  phrasing ("that'll do it", "replace the…", "N/A") anywhere in results fails
  the suite. Soft-serve temp-probe and granita/froyo/ice ungated tests sit AT
  their caps — adding a new fault with a unique result string there will fail
  the suite and force sharing; that is working as intended.
- **Known consequence, on purpose:** a few faults are now genuinely
  undecidable without the Tier-2 meter (hopper-lid-magnet's
  realign-vs-replace trap; froyo draw microswitch) — at most ~one per
  machine, and it's the multimeter's sales pitch. GDD §2.1 decision of
  record (2026-07-07) covers all of this; SCHEMA.md gained a "Writing test
  results" authoring section and the example was updated to the new style.

### Verified

- 334 tests green. A patch script (scratchpad, not committed) applied the 51
  rewrites from one reviewable table and self-checked the uniqueness caps
  before the real test was written; one missed deletion
  (scale-blocked-mix-line's base temp entry) was caught by the self-check.
- Live on a **fresh port 8126** (`static-alt3` added to `.claude/launch.json`
  per the session-27 cache rule — 8125 was assumed burned, not fought):
  fresh save at 380px, full loop on a slushie ticket (machine-specific
  inspect label, shared syrup-crust evidence string, deleted error-log entry
  falling back to the generic, first-fix confirm → repair beat → invoice
  $80+$6, Codex 1/51, contract 1/2); seeded tier-3 ice-dispenser job at
  1280px (evaporator label, freeze-timeout/plate-cold/cube-sheet evidence,
  422px/422px grid intact). Zero console errors throughout. Dev save cleared
  after.
- **NOT pushed** — awaiting Tom's say-so.

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. Session 28 was the diagnosis
> information-design pass: test results are now evidence, not verdicts —
> machine-specific test labels/generics (`testLabel` in js/diagnosis.js),
> all 51 fault files rewritten with deliberately-shared evidence strings, and
> `tests/information-design.test.js` enforcing per-test uniqueness caps
> (~30% ungated / 60% for the tool-gated meter), an unsolvable-job guard and
> a verdict-phrase lint. `node tests/run.js` should be 334 green, schema v14,
> sw.js cache v25. Sessions 27 AND 28 are committed but unpushed — ask Tom.
> Several ungated tests sit exactly at their caps; a new fault there must
> share strings (SCHEMA.md "Writing test results" explains how). Open
> candidates, in leverage order: (1) the tests-as-touches interactive machine
> — all art states (probe/leads/ajar) ready since session 26, and the new
> machine-specific test labels map naturally onto touch targets; (2) a real
> playtest of the rewritten diagnosis (does shared evidence feel like
> deduction or like guessing? — only measurable by playing, ideally Tom);
> (3) the Burgertown narrative arc. If the dev server serves stale JS, add a
> fresh port to `.claude/launch.json` (8126 is the latest); don't fight the
> cache. Don't push without Tom's say-so.

---

## Status (Session 27 done — game-feel pass: symptoms-first layout + juice; committed, NOT pushed)

**Session 27 worked the "looks pretty mid" verdict from session 25/26 notes.**
Diagnosis stood: the gap was moment-to-moment feedback, not illustration
fidelity (art was already rebuilt in session 26). `node tests/run.js` →
**311 passing, 0 failed** (no new tests added — this was a pure presentation
pass; existing markup tests already assert on text/class presence, not exact
DOM position, so they didn't need updating). sw.js cache **v24**. Schema
stays **v14** — nothing here touches state shape, `config/balance.js`, or
`economy.js` (rule 5 untouched by construction, not just by inspection).

### What shipped

- **Symptoms-first job layout** (`js/ui/job.js` `jobView`, `css/main.css`
  `.job-ticket`): reported symptoms are now the first content after the
  status bar on every viewport. The client/machine header + symptoms (quoted
  as a work order, left-accent blockquote) moved into one full-width panel
  rendered *outside* `.job-cols`, so the two-column desktop grid can no
  longer bury it behind the art or below the fold. `.job-cols` now only
  holds the art slot (left) and the diagnostics/commit-fix controls (right).
  DESIGN.md §5/§7 updated with the component and the anti-pattern it fixes.
- **The juice pass**, all DOM/CSS + a little JS, no canvas needed (particles
  didn't jank at 375px, so the pre-authorized canvas fallback went unused):
  - Invoice: the settlement number counts up from $0 with a floating `+$N`
    badge (`wireInvoiceJuice` in job.js, gated on the new
    `prefersReducedMotion()` in `utils.js` since a JS tween needs its own
    check, not just a CSS media query); receipt lines print in sequence via
    staggered `nth-child` delays; rep/streak lines pop in with one extra beat.
  - Wrong fix: one hard `.screen-shake` on the invoice screen, layered onto
    the existing fade-in. Correct fix: a one-shot `.repair-glow` flash on the
    repair beat's art slot before the invoice.
  - Test results stamp in (`test-result-stamp` keyframe) with a new soft
    "key" sound (`stamp` in `js/audio.js`), instead of popping in.
  - Machine art: continuous ambient "breathing" on every state (`idle-breathe`,
    filter-based so it never fights a state's own transform animation) plus a
    one-shot jolt only when a fault ticket's art first mounts
    (`machine-fault-jolt-once`, replacing the old *repeating* jolt); four
    small DOM particles (`.art-particles`) drift over the art slot on every
    state (real elements, not canvas).
  - Clean streak gains a small SVG flame icon (not emoji — DESIGN.md
    anti-pattern) at 5/10/20, escalating via glow tier and a pulse at tier 3.
  - Tier unlock and completed-daily-contract moments get a half-second bouncy
    `.celebration-card` entrance, plus a new `fanfare` sound (`js/audio.js`),
    layered alongside the existing jingle/thunk in `main.js`'s
    `commitSelectedFix`.
  - Shared `artSlotHtml()` helper factored out in job.js so the job and
    repair views build identical art-slot markup (art/particles/glow) from
    one place instead of two copies.
- `js/audio.js` gained two functions: `stamp`, `fanfare`. `js/utils.js` gained
  `prefersReducedMotion()`. Every new CSS animation is covered by the
  `prefers-reduced-motion: reduce` query in main.css (consolidated, not
  scattered); every new JS-driven animation checks `prefersReducedMotion()`
  before doing anything, so skipping it is always a no-op against the
  already-correct server-rendered text.
- GDD.md §7 and DESIGN.md §5/§6/§7 updated with decisions of record.

### Verified

- 311 tests green throughout (ran after every sub-change, not just at the end).
- Live in the preview browser at 375px and 1280px width (a fresh port,
  **static-alt2 on 8125**, was needed mid-session — see gotcha below).
  Confirmed: symptoms render first on both widths (desktop: `.job-cols`
  computed as a 422px/422px grid sitting *below* the full-width ticket
  panel); a wrong fix's shake settles cleanly back to neutral (no residual
  offset); a correct fix's invoice shows the total counting up ($0 → final,
  `.receipt-float` badge present mid-tween, confirmed via DOM inspection
  since screenshots land after the ~650ms tween finishes); a completed daily
  contract showed the `.celebration-card` line live; particles present in
  the art slot (4 per mount); simulated `prefers-reduced-motion` via a
  monkeypatched `matchMedia` and confirmed the count-up skips straight to
  the final value with no float badge. Zero console errors across the whole
  session.
- **Cache gotcha got worse, not just repeated:** this session, `static-alt`
  on port 8124 served genuinely stale JS (`utils.js` missing the new export)
  even after unregistering the SW, clearing the Cache Storage API, and
  `location.reload()` / `fetch(url, {cache:'reload'})` — none of it forced
  revalidation. Root cause looks like heuristic HTTP caching on python's
  header-less responses compounding across a whole session's worth of
  browsing on one origin, not just one stale module. **Fix that actually
  worked: a brand-new port the browser has never fetched from** — added
  `static-alt2` (port 8125) to `.claude/launch.json`. If this recurs, add
  another fresh port rather than fighting the cache further; a per-file
  `?dev=timestamp` query bypasses it too (confirmed) but doesn't help a real
  page load, only manual `fetch()` probes from `preview_eval`.
- **NOT pushed** — awaiting Tom's say-so.

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. Session 27 was a game-feel pass:
> symptoms now render first on the job screen (before header/art/diagnostics)
> on every viewport, plus a full juice pass (invoice count-up + printer
> receipt, wrong-fix shake, correct-fix glow, test-result stamp-in with
> sound, ambient machine-art breathing + one-shot fault jolt + DOM
> steam/frost particles, escalating clean-streak flame, celebratory
> tier-unlock/contract-complete cards). `node tests/run.js` should be 311
> green, schema v14, sw.js cache v24. No economy/balance changes. If the dev
> server serves stale JS despite unregistering the SW, don't fight it — add
> a fresh port to `.claude/launch.json` (see this session's cache-gotcha
> note) rather than retrying reload/cache-bust tricks on the same origin.
> Open candidates, in leverage order: (1) the diagnosis information-design
> pass — inspect-beater names the culprit on 40/52 faults, rewrite results as
> evidence not verdicts + machine-specific tests + an information-design
> invariant test (no single diagnostic uniquely identifies more than ~30% of
> its machine's fault pool); (2) the tests-as-touches interactive machine —
> all art states (probe/leads/ajar) are ready from session 26; (3) the
> Burgertown narrative arc. Don't push without Tom's say-so.

---

## Status (Session 26 done — SVG machine art rebuilt + interaction states; committed, NOT pushed)

**Session 26 rebuilt the entire vector art set.** Tom rated the old flat SVGs
"crappy" (he plays in rendered mode); he chose **independent stylized look**
(not a trace of the raster renders) with **machines + interaction states**
scope via an in-session question. `node tests/run.js` → **311 passing, 0
failed**. sw.js cache **v23**. No schema change.

### What shipped

- **js/machine-art.js rewritten** (same exported API): shared visual language
  — per-instance gradient `defs()` (steel/glass/fluid/trim, id-prefixed so
  multiple inline SVGs never collide), top-left lighting, ground shadows,
  shared helpers (`led`, `warnBadge`, `tempProbe`, `meterLeads`, `miniSwirl`).
  All 5 machines redrawn with real-equipment silhouettes: slushie (twin bowls,
  spiral augers, domed lids, pull taps), soft serve (hopper deck, FROSTKING
  brand strip, bolted dispense doors, barrel+coil internals when open, swirl
  cone on the tray when working), froyo multihead (three heads + covers,
  three barrels when open, three swirls when working), granita (three tapered
  bowls, granita speckles, augers on the existing CSS spin classes + a new
  `--center` rule with phase offset), ice dispenser (louvred bin, dark
  alcove + push paddle, tumbling cubes when working, melt puddle on fault).
- **Three interaction states per machine** for the future tests-as-touches
  diagnosis UI (NOT yet wired into gameplay): `'probe'` (lid off, thermometer
  in product), `'leads'` (access cover off, red/black meter clips), `'ajar'`
  (panel cracked open, screwdriver out). All build on the fault presentation
  and keep the fault code/amber language.
- machine-css-preview.html now renders the full 5 machines × 6 states grid.
- Tests: +1 (interaction states render for every machine, differ from fault,
  carry `machine-state-<state>` class, leads shows the red clip). Existing
  content pins kept: E-04 on open slushie, amber on open soft serve, no
  COOL/34°F leakage into open.
- GDD §7 decision of record added.

### Verified

- All 30 (5×6) states render as valid SVG in node; 311 tests green.
- Live at 380px in the real job screen (vector mode forced on a seeded save):
  fault → run test → open transition works, E-04 + blinking warn triangle
  retained, teardown story (lids set aside, augers lifted) reads. Preview-tool
  grid checked at multiple sizes. **Iteration gotcha:** python http.server
  sends no cache headers, so the browser HTTP cache + SW serve stale modules —
  verify with `import('./js/machine-art.js?dev='+Date.now())` or
  `fetch(f, {cache:'reload'})` before trusting what you see.

### Next

- The interactive-machine session (tap the panel/beater/terminals to run
  tests) now has all its art states ready. The diagnosis information-design
  pass (inspect-beater dominance: 42/52 faults author it, 40/42 uniquely
  identifying — measured session 25 follow-up) and the symptoms-above-the-fold
  layout fix remain open from the "honest thoughts" review.
- **NOT pushed** — awaiting Tom's say-so.

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. Session 26 rebuilt all SVG machine
> art (independent stylized look, 5 machines × 6 states incl. probe/leads/ajar
> interaction states for a future tests-as-touches UI) — 311 tests green,
> sw.js v23, schema v14. Open candidates, roughly in leverage order: (1) the
> symptoms-first job-screen layout fix (desktop buries symptoms below art);
> (2) the diagnosis information-design pass — inspect-beater names the culprit
> on 40/52 faults, rewrite results as evidence not verdicts + machine-specific
> tests + an information-design invariant test; (3) wire the interaction art
> states into a tap-the-machine diagnosis UI; (4) Burgertown narrative arc.
> Don't push without Tom's say-so.

---

## Status (Session 25 done — prestige-vs-ladder playtest; sell moment made legible; pushed to main 2026-07-04)

**Session 25 worked item (1) from session 24's list: the prestige-vs-ladder
tension.** `node tests/run.js` → **307 passing, 0 failed**. sw.js cache is
**v21**. Schema stays **v14** (the fix is transient UI state only).

### The verdict (GDD §3.4 decision of record, 2026-07-04)

**The economy is a good decision point, not a trap — no numbers changed.**
Simulated full playthroughs through the real engine (scratchpad script driving
pickTicket → startJob → runTest → commitFix → buyLadderItem, 3 seeds,
ladder-follower player, 60s/job wall-clock conversion):

- The $30k gate lands at ~182 jobs ≈ 3 focused hours (GDD's 2–4h target ✓),
  with 7 of 9 ladder rungs owned ($22k spent), ~$8.5k cash, rep ~182 — so the
  card offers **+~180%** while the player stares at the $9k van and $12k meter.
- Sell at the gate → founderBonus ~2.8×, run 2 reaches $30k in ~70 min.
  Finish the $43k ladder first (~90 more minutes, done at ~$43k lifetime with
  ~$500 cash) → sell at ~4.5×, run 2 takes ~45 min.
- Bonus grows ~linearly with continued play (~+0.6×/hour, since rep ≈ jobs)
  while each sale shortens the next run — **neither strategy dominates**; sell
  timing is a genuine taste call. Because founderBonus multiplies rep gain too,
  rep-at-$30k is ~constant across runs (~200), so each cycle adds ~+2× in
  ever-shorter wall time. Healthy accelerating loop; rule 5 intact throughout.

**The trap was the UX, and that's what shipped:** "Sell the Business" was a
single un-confirmed tap on a card that never said what a sale wipes — while
the game confirms a mere first fix commit. Now: the card lists **You keep**
(Founder Bonus, Codex, MotD streak, stats) and **The new owners keep** (cash →
$500, rep/tier, tools, van, techs+training, routes, workshop, callbacks), the
detail line says the bonus multiplies job pay *and* rep gain, and the button is
**two-step** — first tap arms a transient `prestigeConfirm` (same pattern as
`pendingFirstFixId`, never saved), showing a warn-bordered confirm ("Sell for
+182% Founder Bonus? … can't be undone") with a "Keep the business" cancel.

### Verified

- 307 tests green (new markup test: keep/lose copy present, no one-tap sell,
  armed card shows confirm/cancel and restates the bonus).
- Live in the preview browser (port 8124 — Tom's own server holds 8123; a
  `static-alt` entry was added to .claude/launch.json): seeded v14 save at the
  exact simulated decision point ($8,526 cash, rep 182, T3, 2 trained techs,
  froyo route), 380px and 1280px. Arm → cancel leaves the save untouched;
  arm → confirm resets to $500/rep 0/T1/meter 1/van 4/no techs-routes with
  founderBonus 2.82, prestigeCount 1, codex+motd kept, home reads "Founder
  Bonus: 282%". Zero console errors.

### Loose ends

- ~~Flagged as a background-task chip: `prestige()` leaves `state.contract`
  untouched~~ **RESOLVED same day (session 25b, spawned from the chip):**
  `prestige()` now clears an **unpaid** contract (the business's work goes
  with the sale; boot/next-ticket regenerates the new region's contract for
  the same day, deterministically at the new tier) and keeps a **paid** one
  (the day's done deal — keeping it is what blocks a double payout from a
  fast second run). Decision of record in GDD §5. Tests: prestige clears
  unpaid / keeps paid (economy.test.js) + the full same-day regen round trip
  (contract.test.js). `node tests/run.js` → **310 passing**. sw.js cache
  **v22**. Verified live at 380px: unpaid Tier-3 contract disappears the
  moment the sale confirms, reload issues "Fix 3 × Polar Twister · +$120 ·
  0/3" at Tier 1, zero console errors. Schema stays v14.
- Session 24's remaining candidates are untouched: (2) the symptom-variant
  memorisation playtest needs ~2h of REAL human play — that one is Tom's;
  (3) the dedicated visual session (hero ticket card, Codex grouping,
  diegetic surfaces) per DESIGN.md.
- Pushed to main with the 25b commit on Tom's say-so (2026-07-04).

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. Session 25 verified the
> prestige-vs-ladder tension (numbers stand; sim data in the §3.4 decision of
> record) and shipped keep/lose copy + a two-step confirm on the sell moment;
> session 25b made prestige clear an unpaid Today's-contract (paid ones stay —
> GDD §5 decision of record). `node tests/run.js` should be 310 green, schema
> v14, sw.js cache v22. Both commits may still be unpushed — ask Tom. Next
> candidates: (a) the visual session Tom prefers (home hero ticket card, Codex
> grouping by machine, diegetic surfaces — DESIGN.md is the style guide);
> (b) Tom's own 2h symptom-variant playtest debrief if he's done it. Don't
> push without Tom's say-so.

---

## Status (Session 24 done — Phase 5 daily comeback hooks; retention brief complete; pushed to main)

**Session 24 shipped the retention brief's cut Phase 5, completing all five
phases.** `node tests/run.js` → **306 passing, 0 failed**. sw.js cache is
**v20**. Schema stays **v14** — Today's contract fills the `contract: null`
slot the v13→v14 migration reserved, so no new migration was needed.

### What session 24 shipped (all GDD §5, decisions of record dated 2026-07-04)

- **MotD countdown:** the played-state button shows "New puzzle in 5h 12m"
  (to UTC midnight, computed at render, never ticked — `nextPuzzleCountdown`
  in js/motd.js).
- **At-risk streak:** the unplayed button shows a warn badge ("4-day streak
  at risk") only when yesterday's puzzle was played *and solved* and today's
  is unplayed (`streakAtRisk`). A lapsed/failed streak shows nothing — no
  guilt mechanics (pillar 4).
- **Today's contract** (new `js/contract.js`): one seeded-by-date bonus
  objective a day ("Fix 3 × Polar Twister · +$120"), generated from
  date + tierUnlocked (rule 6) and pinned into `state.contract` at generation
  so a mid-day tier unlock can't reroll it. Progress counts correct ACTIVE
  client fixes only (fresh + callbacks; workshop/MotD excluded), reward =
  `CONTRACT.rewardPerFix[tier] × count` from balance.js, paid exactly once,
  surfaced on the home panel and the receipt. `validateState` type-checks all
  interpolated contract fields; regeneration happens at action boundaries
  (boot + next ticket), never in render.
- Verified headless (system Chrome via Playwright) at 380px and 1280px, fresh
  save + seeded v14 mid-game save, full contract completion loop and MotD
  played/unplayed states — zero console errors.

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. The 5-phase retention brief is
> COMPLETE (sessions 23–24): symptom variants, purchase ladder, Fault Codex,
> loop/home tightening, daily comeback hooks. `node tests/run.js` should be
> 306 green, schema v14, sw.js cache v20. Candidate next work, in the order
> Fable recommended (session 24): (1) a 30-minute playtest of the
> prestige-vs-ladder tension — the ladder now totals ~$43k of purchases but
> prestige at $30k lifetime wipes tools/van/techs; decide whether that's a
> good decision point or a feel-bad trap; (2) playtest whether symptom-variant
> rotation actually kills memorisation after ~2h of play; (3) a dedicated
> visual session — home-screen hero ticket card, Codex grouping by machine,
> diegetic surfaces — using DESIGN.md as the style guide (optionally with
> Claude Design generating directions to hand-port). Don't push without Tom's
> say-so.

---

## Status (Session 23 done — retention pass, Phases 1–4 of 5; pushed to main)

**Session 23 worked a 5-phase retention brief in strict order and shipped four
of five phases before hitting its usage limit; Phase 5 was cut clean per the
brief's own scope-cut rule (cut from the end of the list, never from
verification).** `node tests/run.js` → **290 passing, 0 failed**. sw.js cache
is **v19**. Schema version is now **14** (v12→v13 added symptom variants,
v13→v14 added the Fault Codex + an inert `contract` slot).

### What session 23 shipped

**Phase 1 — killed the memorization cliff.** Faults can carry 2–3
`symptomVariants` (alternative symptom sets + optional per-test result
overrides), drawn per-job from the seeded PRNG so MotD stays identical for
every player and callbacks replay their original presentation. The 15
most-common Tier 1–2 faults ship 2 variants each. The speed bonus now
requires running at least one test (`DIAGNOSIS.minTestsForBonus`) — a
zero-test blind commit no longer earns it, closing the "memorise the
fix, commit blind" exploit. Economy invariant tests updated to prove
informed diagnosis still beats both blind guessing and exhaustive testing.

**Phase 2 — extended the wanting engine.** The shop is now a single
`purchaseLadder()` showing every buyable cheapest-first, locked rungs
included with their unlock conditions: Multimeter T2 → tech hires → van
6-slot → tech training (skill 2, 90% idle success) → a new Tier-3 **Froyo
Strip** contract route ($6k, promoted from v1.x) → van 8-slot → Multimeter
T3 (deterministically rules out one wrong fix per job, disabled on MotD for
tool fairness). Rule 5 (active > idle) re-proved with both techs trained on
the best route.

**Phase 3 — the Fault Codex.** A new home-screen "Codex" entry lists every
fault; an entry fills in on the first correct diagnosis (fresh, callback,
workshop, or MotD) showing name, machine, lesson text, and times fixed,
under a "N/M faults mastered" header. One-time cash bonuses at 25/50/75/100%
completion. Minimal persisted state (`codex.fixes` counts + `milestonesPaid`);
survives prestige on purpose.

**Phase 4 — tightened the loop and home screen.** Invoice's primary button
is now "Next ticket" (chains straight into the next job), status bar shows
rep progress to the next tier, receipt shows the rep delta and clean streak.
Home reordered loop-first with the prestige/workshop panels collapsed to
one-line `<details>` summaries, brand block shrinks after the first job,
offline report per-tech lines now arithmetically reconcile with the total,
not-yet-due callbacks collapse to one line, desktop non-job screens hold a
centered 480px column, and emoji were removed from UI chrome (badges/dots
instead) — emoji remain only in flavour text and the MotD share card.

**Cut: Phase 5 — daily comeback hooks.** Not started; no scaffolding, no
half-built code. Candidate next items (unchanged from the original brief):
MotD played-state countdown to the next puzzle, an at-risk-streak cue on the
unplayed MotD button, and "Today's contract" (a seeded-by-date bonus
objective, e.g. "Fix 2 froyo machines · +$150"). Schema v14 left an unused,
harmless `contract: null` slot from the Codex migration that Phase 5 can
either fill or supersede with its own bump — see GDD.md §5's "Not yet
shipped" note for detail.

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. Session 23 shipped Phases 1–4 of a
> 5-phase retention brief: symptom variants (kill the memorization cliff), the
> purchase ladder (extend the wanting engine to ~$30k), the Fault Codex
> (long-horizon goal), and loop/home-screen tightening. `node tests/run.js`
> should be 290 green, schema v14, sw.js cache v19. **Phase 5 (daily comeback
> hooks) is the natural next session**: MotD countdown/at-risk-streak cues and
> "Today's contract" — see GDD.md §5's cut-scope note and CLAUDE.md's working
> agreements. Also worth playtesting fresh: does the symptom-variant rotation
> actually feel less memorisable after a couple hours of real play (only
> measurable by playing, not by the tests)? Don't push without Tom's say-so
> beyond what's already landed on main.

---

## Status (Session 22 done — the finishing session; pushed to main)

**Session 22 worked the full ship list: correctness/save-safety, the first real
balance-and-fun pass, presentation, and release housekeeping.** `node tests/run.js`
→ **247 passing, 0 failed**. sw.js cache is **v18**. Schema version is still **12**
(no state-shape changes were needed).

### What session 22 shipped

**A — correctness and save safety**
- `migrate()` now refuses a *versionless modern-shape* save (has `player`/`jobs`/
  `motd` containers but no `schemaVersion`) instead of rebuilding it from defaults
  as v0. Invalid versions (string/null/fractional/negative) were already rejected
  since session 13. Fractional offline carry (A2) and MotD tool-ungating (A5) were
  verified already done — no code needed.
- MotD midnight pinning was already implemented end-to-end; added the missing
  end-to-end test (startJob before UTC midnight → commitFix after → pinned date
  wins, next day's puzzle stays playable).
- Import hardening: `validateState` now type-checks every save field the UI
  interpolates as a number (`motd.streak`, `motd.lastResult.testsUsed/solved`, van
  stock counts, tech `name`/`skill`); workshop machine ids are escaped in
  attributes; `testsUsed` is clamped before `String.repeat`; unknown workshop
  machineType renders a $0 sale instead of crashing homeView.
- Save-import decode failures now show "That doesn't look like a Cold Call save…"
  instead of "URI malformed". migrate/validate errors pass through (already
  player-worded).

**B — balance and fun pass (GDD §10, first ever; measured by playing)**
- Measured focused active pace: T1 ~$105–120/job, T2 ~$140–160/job → ~$7–10k/hour.
  Tier 2 in 10 clean jobs ≈ 10–14 focused minutes — inside the 15-min target, no
  tuning needed.
- **Prestige gate $250k → $30k** (GDD §3.4 wants the first sale at 2–4h; $250k was
  25+ hours at measured pace).
- **Workshop margins cut to $60/$90/$150** (T1/T2/T3) — below each tier's average
  fresh-ticket net — and **sales are no longer founderBonus-scaled** (fresh payouts
  are, so tickets pull further ahead with every prestige). Previously a T3 flip
  paid $500/repair vs ~$210 for a fresh T3 ticket — a rule-5 violation. New
  economy test pins the margin invariant.
- Workshop prices + prestige knobs moved into `config/balance.js` (rule 3 — they
  were hardcoded in economy.js/job.js); workshop buy/sell mutations moved from
  main.js into economy.js with tests.
- Home screen: workshop panel hidden until Tier 2 (fresh-save noise / $100 trap at
  $500 start); status-bar cash gets thousands separators; prestige card reads its
  numbers from config and the Sell button no longer renders amber-on-cyan.

**C — presentation**
- **Graphics default is now `'rendered'`** for new games (all 5 machines have all
  3 webp states). Existing saves keep their stored mode — the v11→v12 migration
  is never re-run and a player's choice is never overridden. The square raster
  stage is capped at 300px so symptoms stay above the fold at 380px. The
  GRAPHICS_REVIEW open items are all resolved.
- Removed a 226-line byte-identical duplicated CSS block (columns/modal/desktop
  sections appeared twice after the Antigravity recovery). Desktop two-column
  diagnosis verified working at 1280px; 380px unchanged.
- **Caller lines rotate**: `contact.flavourLines` in clients.json — a `default`
  pool plus optional machineType-keyed pools, picked deterministically per job
  (seeded fault+client). Machine-specific quips (Sanjay's ice-dispenser line) can
  no longer caption the wrong machine.
- **Outfit is self-hosted** (2 variable woff2s, 47KB, OFL 1.1) — the game now
  makes zero runtime external requests. Files in APP_SHELL.
- **Audio exists**: js/audio.js generates a button blip, correct-fix jingle, and
  wrong-fix thunk via WebAudio (no assets). Gated on the existing Settings
  toggle; context created lazily inside a user gesture; node-safe no-op.

**D — housekeeping**
- Deleted the untracked preview-*.html/svg scratch files, the unused placeholder
  PNGs (`assets/machine-{broken,working}.png`, `tech-avatar.png`), the one-off
  `tools/recover_workspace.py`, and the obsolete `tools/generate-raster-assets.py`
  (the real art pipeline is documented in `assets/generated/PROMPTS.md`).
- REVIEW_FINDINGS.md folded into the ledger below and deleted.

### REVIEW_FINDINGS.md resolution ledger (post-session-10 review, now retired)

1. Malformed schemaVersion resets progress — **fixed** (session 13 + session 22
   flat-shape check).
2. Fractional offline work discarded — **fixed** (session 13/14, `offlineJobCarry`).
3. Tech daily wage not charged — **resolved as design decision**: GDD §6 says no
   running wage at v1.0; `dailyWage` stays a reserved v1.x knob.
4. Imported saves can inject markup — **fixed** (session 13 escapeHtml + session 22
   validateState type checks and attribute escaping).
5. MotD across UTC midnight — **fixed** (pinned `puzzleDateStr`, end-to-end test).
6. Repair interaction absent — **fixed** (session 18 repair beat).
7. MotD scoring depends on tool tier — **fixed** (tests ungated on MotD runs).
8. Callbacks all attributed to Dave — **fixed** (session 15 techId/techName).

### Cold-start prompt for the next session

> Read CLAUDE.md and the top of NOTES.md. Cold Call v1.0 shipped in session 22:
> the loop, MotD, PWA, prestige, workshop, rendered graphics, audio, and offline
> font are all live and pushed to main. `node tests/run.js` should be 247 green.
> There is no scheduled work. Candidate next items: a second contract route /
> tech specialisation (GDD v1.x), the Answering Service offline-cap upgrade
> (OFFLINE.answeringServiceCapHours exists, unused), per-client portraits for the
> two placeholder-shared tier-3 clients, or community fault-pack tooling. Pick
> with Tom. Don't push without his say-so.
---

## Parallel session (2026-06-15, merged during session 22) — verify & reconcile the v1.x systems

> **Merge note (session 22):** this session ran on another machine and pushed
> after session 22 branched. It did an earlier version of the same refactor
> (workshop prices + prestige knob into balance.js, buy/sell into economy.js,
> tierRequired enforcement) with the pre-playtest numbers. Session 22's
> playtested versions won the merge: threshold $30k (not $250k), spreads
> $60/$90/$150 (not 100/250/500), sales NOT founderBonus-scaled, knob named
> `bonusPerRep`, and `buyWorkshopMachine(state, machineType, faultId, id)`
> keeps the random fault pick in main.js. Its doc contributions (Tier 3 folded
> into v1.0 in GDD §9 + CLAUDE.md, the §3.3/§3.4 decisions of record) were
> kept and updated to the playtested numbers. Its "flagged for the playtest
> pass" items are all closed. Original entry below, as written:

Closed the un-handover'd-work gap flagged above. Read all the design docs + the
prestige/workshop/Tier 3 code, verified each against `GDD.md`, and (with Tom's two
calls this session) folded Tier 3 into v1.0 and fixed the safe code issues.

**Tom's two decisions this session:**
1. **Tier 3 → folded into v1.0.** It was wired into the main progression already
   (`REPUTATION.tierThresholds[3] = 25`, `pickTicket` gated to the unlocked tier),
   contradicting GDD §9's "Tiers 1–2" scope. Promoted to v1.0: GDD §9 now lists
   Tiers 1–3 + a dated scope note, and CLAUDE.md's Definition of Done matches.
2. **Fix the safe issues now** (not just log them).

**Verification result — all three systems work; rule 5 (active>idle) is intact.**
- `founderBonus` multiplies active earnings + reputation gain but **not** idle tech
  income (`idle.js` adds `TECHS.earningsPerJob` flat), so post-prestige runs get
  stronger active play without ever lifting idle income above it. Documented as a
  decision of record in GDD §3.4.
- The workshop is an **active** converter, not idle (you play the diagnosis minigame
  to repair, profit is the buy→sell spread, $0 + no rep on the repair job). Now a
  decision of record in GDD §3.3.

**Code fixes (all numbers now obey CLAUDE rule 3; one real bug closed):**
- `config/balance.js`: added `PRESTIGE.bonusPerReputation` (0.01) and a `WORKSHOP`
  block (buy/sell/tierRequired per machine). The duplicated `0.01` and `250000`
  literals in `economy.js` and `js/ui/job.js` now read from the knobs.
- **Bug fixed:** `tierRequired` was defined but never enforced — a Tier 1 player
  could buy the Tier 3 froyo machine. Workshop buy/sell money math moved out of
  `main.js` into `economy.js` as exported, testable `buyWorkshopMachine(state,
  machineType, faults, rand?)` / `sellWorkshopMachine(state, machineId)` (the right
  home — "all earning/spending math in economy.js"). Buy now enforces the tier gate
  and affordability; `main.js` actions just delegate.
- `WORKSHOP_MACHINES` in `economy.js` keeps display names (shop copy) but spreads
  its prices/tiers from `balance.WORKSHOP`.

**Tests.** `node tests/run.js` → **228 passing, 0 failed** (+6): tier-3 unlock at
threshold, tierRequired refusal (no mutation), buy deducts + queues a matching-fault
broken machine, buy refused when unaffordable, sell pays `sellPrice × founderBonus`
and removes the machine, sell refused while still broken, plus the prestige bonus and
WORKSHOP_MACHINES tests rewired to the balance knobs. Fixed the stale
`economy.test.js` comment ("no tier 3 threshold exists yet").

**sw.js** cache bumped **v16 → v17** (economy.js / job.js / main.js / balance.js
changed).

**Flagged for the playtest pass (NOT changed — needs Tom / a real tuning session):**
- Workshop tier-2 spread (buy 250 / sell 500 → +250) edges past a fresh tier-2
  ticket's best net (~235). Noted in `balance.js` and GDD §3.3. It never touches idle
  income so the §3.1 rule holds, but it's a candidate for the GDD §10 "fun with all
  numbers set to 1" balance pass that still hasn't happened.
- Graphics default (vector vs rendered) — see `GRAPHICS_REVIEW.md`; coverage gap is
  now closed (all 5 machines have renders) but the slot reshape + default flip remain.

Not done: did not read `walkthrough.md` (untracked, in Downloads, not on this
machine). Verification was done against the committed code + tests, which is the
source of truth anyway.

### Graphics: raster art for all 5 machines (Codex, post-Session-20)

- **All five machines now have generated raster renders** (`assets/generated/
  <machineId>-{fault,open,working}.webp`, 640×640). Tier 1/2 were made earlier; the
  Tier 3 trio (`froyo-multihead`, `granita-slushie`, `commercial-ice-dispenser`) was
  added with **Codex's built-in image tool in VS Code**. Provenance, the exact prompt
  template, visual-direction block, and the Pillow split/normalise pipeline are
  documented in **`assets/generated/PROMPTS.md`** — read that before generating any new
  machine/portrait art so the set stays consistent. The image gen is non-deterministic;
  only the spec is reproducible.
- **Wiring:** all three Tier 3 ids added to `GENERATED_MACHINES` in `js/machine-art.js`;
  `machineImageSrc()` still honours `state.settings.graphicsMode` (raster only when not
  `'vector'`, SVG otherwise). `sw.js` cache → **v16** with every machine + portrait
  webp added to `APP_SHELL` (all paths verified present on disk, so SW install won't
  fail). `tests/machine-art.test.js` has a catalogue test asserting every machine in
  `data/machines.json` has all three webp states.
- **Verified this turn:** `node tests/run.js` → **222 passing, 0 failed**. All 9 Tier 3
  renders load (640×640, no broken images, no slot overflow with the `.machine-art`
  containment rule). Default graphics mode is still `'vector'` (animated SVG); raster is
  opt-in via Settings — see `GRAPHICS_REVIEW.md` for the still-open square-render-in-
  16:7-slot issue and the "make rendered the default" path.
- **Fixed a pre-existing determinism regression (not Codex's):** `callbacksView` in
  `js/ui/job.js` read `new Date()` (real wall clock) instead of `new Date(Date.now())`,
  bypassing the test clock pin and making the two session-19 callback-timing tests
  date-flaky — they had drifted to failing as the real date advanced. Now injectable
  again (CLAUDE.md rule 6). This is why the suite was red before this turn.

### What session 21 verified (Antigravity Tier 3 / prestige / workshop / settings audit)

Session 21 was documentation-only: no new code, no test changes. It read
`walkthrough.md` (in Downloads), audited every feature Antigravity added, and
compared each against `GDD.md`. The tree is healthy; 222 tests pass.

**Tier 3 SVG illustrations (GDD §4, §7 — ✓ aligned)**
- Three new inline SVG machines added to `js/machine-art.js`: `froyo-multihead`
  (YogurtMaster 3000 Multihead Froyo — 3 nozzles, star tips, individual handles,
  digital status screen), `granita-slushie` (GlacierGlide Triple-Bowl Granita —
  3 bowls, spiral helix augers, 3 dispense taps), `commercial-ice-dispenser`
  (IceO-Matic 9000 — cube cabinet, ventilation grille, push-lever chute).
- All three have `fault` / `open` / `working` states with the same LED + screen
  state-language as Tiers 1–2; granita's working state animates augers (CSS spin).
- All three IDs are in `GENERATED_MACHINES` in `machine-art.js`; raster renders
  are in `assets/generated/<id>-{fault,open,working}.webp`; `sw.js` cache is
  **v16** with every webp in APP_SHELL; `machine-art.test.js` catalogue test
  asserts all five machines have all three webp variants.
- GDD §4 puts froyo chains / pubs / servos at Tier 3; the fictional names stay
  parody, no real branding anywhere. ✓

**Prestige — "Sell the Business" (GDD §3.4 — ✓ aligned, one balance note)**
- New state fields: `player.prestigeCount` (int) and `player.founderBonus`
  (float, starts at 1.0). Schema v10→v11 migration (also adds workshop).
- `prestige(state)` in `economy.js`: gate = `player.lifetimeEarnings ≥ $250,000`;
  founderBonus increases by `reputation × 0.01` at the moment of sell; resets
  cash, tier, tools, van, techs, routes, active job, callbacks, workshop, and
  offlineJobCarry; keeps `prestigeCount`, `founderBonus`, and all stats.
- `founderBonus` is applied as a cash multiplier in `settleJob()` — it scales
  every correct-fix payout going forward, which matches GDD "permanent multiplier
  from lifetime reputation." ✓
- UI: home screen shows a prestige card once the threshold is reached (in
  `homeView` inside `js/ui/job.js`), displaying the bonus that would be gained and
  a "Sell the Business" button wired to `actions.sellBusiness`.
- **Balance note:** GDD §3.4 says "unlocks at first ~2–4 hours of play." $250k
  lifetime earnings has not been play-tested against that target. Flag for the
  next balance pass.

**Workshop — refurb machines (GDD §3.3 — ✓ aligned)**
- New state field: `workshop: { machines: [] }` added in schema v10→v11.
  Each entry: `{ id, machineType, faultId, status }` where status is `'broken'`,
  `'in-repair'`, or `'repaired'`.
- `WORKSHOP_MACHINES` constant in `economy.js` lists buyable types with
  `buyPrice` / `sellPrice` / `tierRequired`: slushie-machine ($100/$200, T1),
  soft-serve-commercial ($250/$500, T2), froyo-multihead ($500/$1000, T3).
- Flow: **Buy** (random fault assigned, status=broken) → **Repair** (starts a
  normal diagnosis job via `startJob`; clientId is `'workshop-' + machine.id` so
  `commitFix` in `diagnosis.js` intercepts it, marks the machine repaired, updates
  status) → **Sell** (removes from list, credits `sellPrice × founderBonus`).
- UI in `homeView` (`js/ui/job.js`): shows available machines to buy and a list of
  owned machines with Repair / Sell buttons. Workshop jobs run through the normal
  diagnosis flow — active play, not idle — consistent with GDD "idle money sink/
  converter" intent and CLAUDE.md rule 5 (active > idle).
- **Balance note:** 2× margin (buy/sell) with founderBonus applied on top. Should
  verify this can't make workshop a better $/min than fresh diagnosis tickets after
  a high-rep prestige (CLAUDE.md rule 5 invariant).

**Settings modal (GDD §9 "not-yet-scheduled" item — ✓ implements it)**
- New `js/ui/settings.js`: modal overlay rendered above any screen via
  `settingsOpen` flag in `main.js`. Contains: audio toggle, graphics mode toggle
  (vector animated / rendered static), save export + copy, save import, reset
  progress.
- Save transfer has moved out of the shop screen (where it was awkwardly placed)
  into this modal — this directly addresses the "Settings/save information
  architecture" item that was listed as not-yet-scheduled. Mark that item done.
- New state field: `settings.graphicsMode` ('vector' | 'rendered'). Schema
  v11→v12 migration (adds the field, defaults to 'vector').
- `machineImageSrc()` in `machine-art.js` returns an SVG string in vector mode
  and a webp path in rendered mode. The default is 'vector' (animated SVGs);
  raster is opt-in. Node test environment gets SVG regardless (no file-system
  webp paths in test assertions).
- Tests: v11→v12 migration test (settings.graphicsMode added at 'vector') present.

**CSS animations and Outfit font**
- `index.html` loads the Outfit web font from Google Fonts (note: this is a
  runtime network request — it won't load offline; the fallback stack is fine but
  this is the one runtime external call in an otherwise fully offline PWA. Acceptable
  as a polish item; could be self-hosted if offline font fidelity matters).
- `css/main.css` gained keyframe animations: `led-pulse-working` (green LED glow),
  `led-blink-fault` (amber LED blink), `fluid-slosh-left/right` (liquid in slushie
  bowls), `agitator-spin` (bowl augers), `rattle` (repair-beat bolt), and
  `success-pulse` (repair beat completion). These are applied directly in the SVG
  markup via CSS class names — no new JS.

**Tests and schema summary**
- `node tests/run.js` → **222 passing, 0 failed**.
- Coverage confirmed for: prestige gating and founderBonus calculation, prestige
  reset (keeps persistents, clears progress), workshop machine commitFix path
  (status update + part consumption), v11→v12 migration.
- Schema version is now **12** (v10→v11: prestige + workshop; v11→v12: settings
  settings.graphicsMode).
- `sw.js` cache: **v16**.

**Not-yet-scheduled item now done**
- "Settings/save information architecture" (listed as not-yet-scheduled before this
  work) is now implemented: settings modal with audio, graphics, and save transfer.

---

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
- **Settings/save information architecture:** ✓ DONE (Antigravity) — modal overlay
  with audio, graphics mode, save export/import, and reset. Outstanding: replace
  any remaining "URI malformed" implementation errors with player-facing copy.
- **Character variation:** rotate or contextually select caller lines so recurring
  personalities stay charming instead of repeating one quote every ticket.
- **Audio** (GDD §7): satisfying clicks, perfect-job jingle, one chiptune loop;
  CC0/generated; GDD says polish-phase, not a launch blocker. Sonnet.
- **A balance/fun playtest pass** (GDD §10: "fun with all numbers set to 1"). No
  evidence this has happened. Two specific items flagged in session 21: (1) verify
  $250k prestige threshold matches GDD's "2–4 hours" target; (2) verify workshop
  sell price (founderBonus × 2×) can't beat fresh diagnosis $/min (CLAUDE.md rule 5).
- **v1.x systems** (Tiers 3–4, prestige, workshop, tech specialisation, tech wages
  if deferred in session 13 — GDD §9): Tier 3 SVGs, prestige, and workshop are
  now in the codebase (Antigravity, documented session 21); Tiers 4+, tech
  specialisation, and wages remain out of scope.

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
