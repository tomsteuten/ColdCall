# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 10)

See the queued session 10 prompt below — callback choice + rescue split
(STRONGEST model: economy + migration). It depends on session 9's settlement
math, which has now landed.

Sessions 1–9 are done and committed (not pushed). State is at schema v5.
Everything from session 8, plus session 9 additions:

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

## v1.0 scope — all items shipped after session 8

Session 8 closed the last two GDD §9 items (PWA + save export/import).
Session 9 landed the diagnosis test costs / speed bonus. Session 10 (the last
queued pre-launch design item — callback choice + rescue split) is prompted above.
