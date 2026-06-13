# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 9)

See the queued prompt below — session 9 implements the simulated job clock and
speed bonus (STRONGEST model recommended; touches economy + state shape).

Sessions 1–8 are done and committed (not pushed). State is at schema v4.
Everything from session 7, plus session 8 additions:

- PWA: manifest.json + sw.js (cache-first, pre-caches all ~60 app shell files
  incl. 40 faults). BASE URL derived from self.registration.scope so it works
  on both localhost and GitHub Pages (/ColdCall/). assets/icon.svg (soft-serve
  cone, maskable-safe). index.html: manifest link, theme-color, apple-touch-icon,
  SW registration script.
- Save export/import UI in shop "Save data" section: Export copies base64 blob
  to clipboard (prompt fallback); Import textarea + button validates, migrates,
  and reloads — bad blobs show inline error without touching the current save.
  rawSave() (state.js save()) is used directly for import so it bypasses the
  session persist gate (intentional: explicit import should replace).
- Corrupt-save recovery: home screen banner when boot detects a corrupt save,
  with "Copy raw save blob" button for the preserved localStorage blob.

Tests: `node tests/run.js` — 114 passing.

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

## v1.0 scope — all items shipped after session 8

Session 8 closed the last two GDD §9 items (PWA + save export/import).
Sessions 9 and 10 are pre-launch polish/design items (test costs, callback
choice split) — prompts queued above.
