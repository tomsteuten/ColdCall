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

## Roadmap — UI/graphics polish track (sessions 11–15)

This is a plan, not a contract — reorder or drop items as taste dictates. Each
session is sized to one branch. "Model" is the recommendation per CLAUDE.md's
guidance (CSS/wiring/flavour → mid model; state/economy/engine → strongest).
"Start with" tells you whether the session is fully specified here (just say
"proceed with session N from notes.md") or needs a decision/prompt from you first.

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

### Session 12 — Machine of the Day result & share card polish
- **Model:** Sonnet (presentation + a small string-builder tweak in motd.js).
- **Start with:** "proceed with session 12 from notes.md" — fully specified.
- **Scope:** The MotD result screen is the growth engine (GDD §5) and is still an
  emoji-text grid. Make the result screen genuinely screenshot-worthy on top of
  the session-11 identity; refine buildShareCard() copy/layout (keep it
  copy-paste plain text — that's the Wordle-pattern hook); add clean-streak /
  callback-shame flourish per GDD §5. Keep it deterministic and tested.
- **Done when:** result screen looks share-worthy at 380px, share text still
  round-trips, motd tests green.

### Session 13 — Machine sprites (GDD §7's stated art priority)
- **Model:** Sonnet for the integration/state-variant wiring (the logic is
  trivial); the hard part is art production, not code.
- **Start with:** **a short prompt from Tom — this session is blocked on one
  decision:** where the machine art comes from. Options: (a) Tom draws/sources
  pixel art himself and drops files in /assets, (b) CC0/asset-pack sprites, (c) an
  AI-pixel-art workflow. Tell the next session which, and (if a/b) have at least
  one machine's sprite set committed first. Until that's answered, don't start.
- **Scope:** Add a sprite slot to the job screen, one sprite per machine type with
  working / fault / open-panel state variants (GDD §7), driven from machines.json.
  Graceful text fallback when a sprite is missing so the game never breaks on
  un-arted machines. Add sprite paths to the sw.js app-shell list.
- **Done when:** at least the tier-1/2 star machines show state-appropriate
  sprites, missing-art fallback verified, PWA still caches offline.

### Session 14 — Character portraits for tickets / Burgertown managers
- **Model:** Sonnet (wiring/CSS + flavour).
- **Start with:** shares session 13's art-source decision — once that's settled,
  "proceed with session 14 from notes.md" works; otherwise supply it inline.
- **Scope:** Simple portraits in the ticket/job dialog (GDD §4/§7 — recurring
  Burgertown manager personalities, big personality-per-byte return). Portrait
  data lives in clients.json; text-only fallback. Lean into the comedy/flavour.
- **Done when:** clients show portraits + a line of character on the job screen,
  fallback verified.

### Session 15 — The light repair interaction (GDD §2.3)
- **Model:** Opus (strongest) — it touches the active-job → invoice flow and may
  add a transient repair step to state; anything near the commit/settle path and
  a possible migration is strongest-model work (CLAUDE.md rule 1 + engine).
- **Start with:** "proceed with session 15 from notes.md" — specified, but read
  GDD §2.3 carefully; if it needs a state-shape change, ship a migration + test.
- **Scope:** After a correct diagnosis, a quick satisfying repair beat
  (hold-to-tighten / sequence-tap) before the invoice — "light, not a second
  minigame" (GDD §2.3). Must not alter $/min balance or the active>idle invariant;
  keep it skippable/instant-safe so it never punishes a mobile interruption.
- **Done when:** repair beat plays between commit and invoice, economy invariants
  untouched, tests green.

### Not-yet-scheduled (deliberately after the visual track)
- **Audio** (GDD §7): satisfying clicks, perfect-job jingle, one chiptune loop;
  CC0/generated; GDD says polish-phase, not a launch blocker. Sonnet.
- **A balance/fun playtest pass** (GDD §10: "fun with all numbers set to 1"). No
  evidence this has happened. Not a UI task, but don't let it slip indefinitely —
  the visual work above also makes a playtest read more clearly. Strongest model
  if it turns into economy retuning.
- **v1.x systems** (Tiers 3–4, prestige, workshop, tech specialisation — GDD §9):
  strongest model; out of scope for the current visual track.

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
