# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 11)

Session 10 (callback choice + rescue split) has landed and is pushed. State is at
schema v6 — all GDD §9 v1.0 scope plus every queued pre-launch design decision is
implemented. The game is now feature-complete but visually a programmer-art
prototype; the next arc is a **UI/graphics polish track** (Tom's stated
preference, and it serves the GDD §5 screenshot-based growth hook). The planned
sessions 11–15 are laid out under "Roadmap" below — to begin one, just say
"proceed with session N from notes.md" (decision-dependencies, where they exist,
are flagged per session).

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

## Roadmap — UI/graphics polish track + hardening (sessions 11–16)

This is a plan, not a contract — reorder or drop items as taste dictates. Each
session is sized to one branch. "Model" is the recommendation per CLAUDE.md's
guidance (CSS/wiring/flavour → mid model; state/economy/engine → strongest).
"Start with" tells you whether the session is fully specified here (just say
"proceed with session N from notes.md") or needs a decision/prompt from you first.

Findings from `REVIEW_FINDINGS.md` (Codex's post-session-10 read-only review,
2026-06-13) have been folded in below where warranted: MotD bugs → session 12;
the save/offline/security cluster → a new session 13 (hardening); tech callback
attribution → session 15; the repair interaction was already session 16. Items I
judged real but low-likelihood still get fixed because the fix is cheap and the
downside (silent save reset) is severe.

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

### Session 13 — Save & idle hardening (REVIEW_FINDINGS #1, #2, #4; decide #3)
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

### Session 14 — Machine sprites (GDD §7's stated art priority)
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

### Session 15 — Character portraits + correct tech attribution (REVIEW_FINDINGS #8)
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

### Session 16 — The light repair interaction (GDD §2.3; REVIEW_FINDINGS #6)
- **Model:** Opus (strongest) — it touches the active-job → invoice flow and may
  add a transient repair step to state; anything near the commit/settle path and
  a possible migration is strongest-model work (CLAUDE.md rule 1 + engine).
- **Start with:** "proceed with session 16 from notes.md" — specified, but read
  GDD §2.3 carefully; if it needs a state-shape change, ship a migration + test.
- **Scope:** After a correct diagnosis, a quick satisfying repair beat
  (hold-to-tighten / sequence-tap) before the invoice — "light, not a second
  minigame" (GDD §2.3). Must not alter $/min balance or the active>idle invariant;
  keep it skippable/instant-safe so it never punishes a mobile interruption.
- **REVIEW_FINDINGS #6 (this IS that finding — agree it's a real design gap):**
  the key correctness constraint is refresh safety — an in-progress repair must
  either survive a refresh on state.jobs.active, or settlement must be structured
  so a refresh can neither duplicate nor lose the reward. Decide which and test it.
- **Done when:** repair beat plays between commit and invoice, refresh can't dupe
  or drop rewards, economy invariants untouched, tests green.

### Not-yet-scheduled (deliberately after the above)
- **Audio** (GDD §7): satisfying clicks, perfect-job jingle, one chiptune loop;
  CC0/generated; GDD says polish-phase, not a launch blocker. Sonnet.
- **A balance/fun playtest pass** (GDD §10: "fun with all numbers set to 1"). No
  evidence this has happened. Not a UI task, but don't let it slip indefinitely —
  the visual work above also makes a playtest read more clearly. Strongest model
  if it turns into economy retuning.
- **v1.x systems** (Tiers 3–4, prestige, workshop, tech specialisation, tech wages
  if deferred in session 13 — GDD §9): strongest model; out of scope for now.

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
