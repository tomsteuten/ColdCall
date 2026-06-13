# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 8)

Model: Claude Sonnet is fine — both remaining tasks (PWA wiring and save
export/import UI) are screen-building and config work. The economy/save-integrity
fixes from the Codex review were done in session 7 on the strongest model.

Read GDD.md and CLAUDE.md fully before doing anything. Sessions 1–7 are done and
committed (not pushed). State is at schema v4. Here's what's in:

- state/saves with migrations to schema v4; strict validation: future-version
  saves rejected, structural validation after every migrate (validateState in
  state.js, throws naming the bad field)
- corrupt-save protection: main.js builds its save fn via makePersist(error) —
  when load() failed, NO save this session writes, the corrupt blob is preserved
- seedable PRNG (mulberry32 in js/rng.js, accepts string seeds)
- all tunables in config/balance.js (JOBS, REPUTATION, TOOLS, STARTING, TECHS, OFFLINE)
- fault loader + validator (new faults go in data/faults/index.json)
- diagnosis engine, playable ticket → diagnose → fix → invoice loop
- 40 faults across Tiers 1–2 (GDD §9 launch target met)
- tools shop (Multimeter Tier 2 unlocks continuity test)
- economy model of record (GDD §6, decided session 7): partsCost is charged once
  at settlement; van restock is FREE (stock = availability, not a second bill);
  correct callback fix pays callbackJobPayoutMult × net (payout − parts), so it
  can never go negative — there's an all-faults profitability invariant test
- Machine of the Day: rendezvous-hash daily draw (adding faults only remaps
  dates the new fault wins), results pin their faultId, streak, share card
- Parts/van stock, techs + routes + offline progress (8h cap, deterministic)

Tests: `node tests/run.js` — 114 passing.

This is session 8. Two v1.0 items remain (GDD §9):

1. PWA — manifest.json + sw.js. Cache-first for app shell (index.html, css/, js/,
   config/), pre-cache data/faults/*.json (~40 files + index.json), machines.json,
   clients.json. Versioned cache name, bumped on release. Must be installable on
   Android Chrome and iOS Safari. No runtime network calls exist, so cache-first
   over the whole repo is fine.
2. Save export/import UI — state.js has exportSave()/importSave() (importSave
   validates and throws with a player-readable message — surface it in the UI).
   Small settings panel or shop addition: "Export save" (clipboard, with prompt()
   fallback like shareMotd), "Import save" textarea + button. Bonus: when boot
   detects a corrupt save (main.js `error` is set), offer the raw localStorage
   blob for copy before any reset — that's the recovery story the persist gate
   left open.

Suggested order: PWA first, then export/import.

Rules that bind everything: mutations only via state.js/economy.js; every number in
config/balance.js; saves are sacred (migrations for any state shape change); no
network calls at runtime; active play must always beat idle $/min.

When done: run tests, verify installable at ~380px mobile width, update this file
for session 9, commit in small logical commits, don't push until Tom says so.

---

## Queued session prompts (decisions confirmed by Tom, recorded in GDD)

### Session 9 prompt — diagnosis test costs (STRONGEST model: economy + state shape)

Read GDD.md §2.1 (including the v1.0 decisions of record) and CLAUDE.md fully
before doing anything. Tests: `node tests/run.js` must pass before and after.

Implement the simulated job clock and speed bonus:

- Each test in js/diagnosis.js TESTS gets a time cost in fictional minutes, in a
  new DIAGNOSIS section of config/balance.js. Suggested starts: error log 2,
  temp probe 5, inspect beater 15, continuity test 8. Tune freely.
- The active job accumulates minutesSpent when a test runs. jobs.active persists
  in saves, so this is a state-shape change: ship a schema migration (current
  schema is v4; missing minutesSpent on an in-flight job defaults to 0) and a
  migration test per CLAUDE.md rule 1.
- settleJob: on a correct FRESH fix, payout = fault.payout + speed bonus, where
  bonus = max(0, speedBonusMax − minutesSpent × bonusDecayPerMin), both knobs in
  balance.js (suggested: bonus up to ~30% of tier payout). No bonus on callbacks
  (already discounted) and none on MotD (pays nothing). Parts stay as-is.
- The clock NEVER uses wall time — interruptions must not punish (GDD §2.1).
- Job screen: show minutes spent and the remaining bonus so the trade-off is
  visible before each test.
- New invariant tests: (a) informed diagnosis (few targeted tests, correct fix)
  beats both zero-test guessing in EXPECTED value (guess = correct-rate-weighted
  mix of full bonus and callback outcomes) and exhaustive testing; (b) bonus
  never makes a callback fix beat a fresh fix; (c) active > idle still holds.
- Update the GDD if any decision shifts during implementation; note it in the
  commit. Verify at ~380px. Don't push until Tom says so.

### Session 10 prompt — callback choice + rescue split (STRONGEST model: economy + migration)

Read GDD.md §2.1/§3.1 (v1.0 decisions of record) and CLAUDE.md fully before
doing anything. Depends on session 9 landing first (shares settlement math).

Split callbacks into obligations and rescues, and make claiming a choice:

- Schema migration (+1 from current): each state.jobs.callbacks entry gains
  source: 'player' | 'tech' and an expiry day. Existing entries migrate to
  source 'player' (conservative: the lower rate) with expiry = dueDay +
  callbackExpiryDays. Migration test with a previous-version fixture.
- economy.js: settleJob's callback rate becomes source-dependent —
  player-caused stays callbackJobPayoutMult (0.4 of net); tech-caused pays
  rescueCallbackPayoutMult of net (suggested 0.9, MUST stay < 1.0 so rescues
  never beat fresh tickets — add the invariant test). idle.js sets
  source: 'tech' on the callbacks it queues.
- Expiry is computed on load, deterministically, like offline progress: due
  callbacks past their expiry day are removed with a reputation penalty
  (knobs: callbackExpiryDays, expiredCallbackRepPenalty in balance.js) and the
  loss is reported in the welcome-back/home banner.
- UI: home gets a separate "Callbacks (n)" button listing due callbacks with
  their rate and source ("your miss" vs "Dave's miss"); "Next ticket" never
  auto-claims a callback. main.js actions.nextTicket loses the claimDueCallback
  call; a new action claims a chosen callback.
- All numbers in config/balance.js. Run tests, verify at ~380px, update this
  file for the next session, small commits, don't push until Tom says so.

## v1.0 scope still open after session 7

- PWA: manifest.json + sw.js, installable
- Save export/import UI (functions exist in state.js, no screen yet)
- (pre-launch, post-v1.0-build) session 9: diagnosis test costs; session 10:
  callback choice/rescue split — prompts above
