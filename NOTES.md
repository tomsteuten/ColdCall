# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 11)

Session 10 (callback choice + rescue split) has landed. State is now at schema
v6. All v1.0 GDD §9 scope items plus every queued pre-launch design decision are
now implemented — there is no queued session-11 prompt. Next steps are Tom's
call: playtesting/balance tuning, art/audio polish (GDD §7), or starting v1.x
(Tiers 3–4, prestige, workshop, tech specialisation — GDD §9). Pick one and
write its prompt here at the end of that session.

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

## Archived session 9–10 starting context

Sessions 1–10 are done and committed (not pushed). Everything from session 8,
plus session 9 additions:

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

None. Every queued pre-launch design decision is implemented (session 10 closed
the last one — callback choice + rescue split). The next session's direction is
Tom's call; see the session-11 note at the top.

## v1.0 scope — all items shipped

Session 8 closed the last two GDD §9 items (PWA + save export/import). Session 9
landed the diagnosis test costs / speed bonus. Session 10 landed the callback
choice + rescue split — the last queued pre-launch design item. The full GDD §9
v1.0 scope is now implemented at schema v6.
