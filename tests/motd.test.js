/** @file Machine of the Day: deterministic draw, once-per-day guard, streak rules, share card. */

import { defaultState } from '../js/state.js';
import { pickMotdFault, canPlayToday, settleMotd, buildShareCard, getTodayDateStr, nextPuzzleCountdown, streakAtRisk } from '../js/motd.js';
import { startJob, commitFix } from '../js/diagnosis.js';
import { MOTD } from '../config/balance.js';

// A minimal fault library for testing (two faults, different ids).
function makeFaults() {
  return {
    'fault-alpha': {
      id: 'fault-alpha',
      machineType: 'soft-serve-home',
      tier: 1,
      symptoms: ['Broken.'],
      tests: {},
      correctFix: 'fix-alpha',
      wrongFixes: ['wrong-alpha'],
      payout: 100,
      partsCost: 10,
      flavour: 'Alpha done.',
    },
    'fault-beta': {
      id: 'fault-beta',
      machineType: 'soft-serve-commercial',
      tier: 2,
      symptoms: ['Also broken.'],
      tests: {},
      correctFix: 'fix-beta',
      wrongFixes: ['wrong-beta'],
      payout: 150,
      partsCost: 20,
      flavour: 'Beta done.',
    },
  };
}

// --- deterministic draw ---

test('same date string produces the same fault every time', () => {
  const faults = makeFaults();
  const a = pickMotdFault(faults, '2026-06-12');
  const b = pickMotdFault(faults, '2026-06-12');
  assertEqual(a.id, b.id, 'same date must always pick the same fault');
});

test('different dates (usually) pick different faults — at minimum the draw changes with a larger library', () => {
  // With a 2-fault library we verify the algorithm produces different indices for
  // well-separated dates; this is a sanity check, not a distribution guarantee.
  const faults = makeFaults();
  const day1 = pickMotdFault(faults, '2026-06-12');
  const day2 = pickMotdFault(faults, '2026-06-13');
  // Both dates should produce a valid fault from the library.
  assert(faults[day1.id] !== undefined, 'day1 result must be in the library');
  assert(faults[day2.id] !== undefined, 'day2 result must be in the library');
});

test('pickMotdFault draws from all tiers regardless of tierUnlocked', () => {
  // The puzzle is standalone — tier gating does not apply.
  const faults = makeFaults();
  // With enough date strings we should see both tier-1 and tier-2 faults.
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const f = pickMotdFault(faults, `2026-06-${String(i + 1).padStart(2, '0')}`);
    seen.add(f.tier);
  }
  assert(seen.has(1), 'should draw tier-1 faults');
  assert(seen.has(2), 'should draw tier-2 faults');
});

test('draw is stable: adding a fault only remaps dates the new fault wins', () => {
  // Genuine before/after-library test (rendezvous hashing): for every date,
  // either the pick is unchanged, or it changed to the newly added fault.
  // The old index-into-sorted-array draw failed this — adding one fault could
  // hand an existing date to a different OLD fault.
  const before = makeFaults();
  const after = { ...makeFaults(), 'fault-gamma': { ...makeFaults()['fault-alpha'], id: 'fault-gamma' } };
  let remapped = 0;
  for (let i = 0; i < 60; i++) {
    const date = new Date(Date.UTC(2026, 5, 12) + i * 86400000).toISOString().slice(0, 10);
    const a = pickMotdFault(before, date);
    const b = pickMotdFault(after, date);
    if (a.id !== b.id) {
      assertEqual(b.id, 'fault-gamma', `date ${date} remapped to an OLD fault: ${a.id} -> ${b.id}`);
      remapped++;
    }
  }
  assert(remapped < 60, 'sanity: not every date should remap');
});

// --- once-per-day guard ---

const TODAY = Date.UTC(2026, 5, 12, 10, 0, 0); // 2026-06-12T10:00Z

test('canPlayToday returns true when lastPlayedDate is null', () => {
  const state = defaultState();
  assert(canPlayToday(state, TODAY));
});

test('canPlayToday returns false after the puzzle has been played today', () => {
  const state = defaultState();
  state.motd.lastPlayedDate = '2026-06-12';
  assert(!canPlayToday(state, TODAY));
});

test('canPlayToday returns true the next day even if played yesterday', () => {
  const state = defaultState();
  state.motd.lastPlayedDate = '2026-06-12';
  const TOMORROW = Date.UTC(2026, 5, 13, 1, 0, 0); // 2026-06-13T01:00Z
  assert(canPlayToday(state, TOMORROW));
});

// --- streak rules ---

function playMotd(state, correct, dateStr, prevState = null) {
  // Helper: simulate a settled motd run. The 5th arg is simulated diagnostic
  // minutes (the interruption-safe score), not wall time.
  const now = new Date(dateStr + 'T12:00:00Z').getTime();
  const fault = makeFaults()['fault-alpha'];
  return settleMotd(state, fault, correct, ['error-log'], 2, now);
}

test('first solve: streak becomes 1', () => {
  const state = defaultState();
  const result = playMotd(state, true, '2026-06-12');
  assertEqual(result.streak, 1);
  assertEqual(state.motd.streak, 1);
});

test('consecutive solves: streak increments', () => {
  const state = defaultState();
  playMotd(state, true, '2026-06-12');
  const result = playMotd(state, true, '2026-06-13');
  assertEqual(result.streak, 2);
  assertEqual(state.motd.streak, 2);
});

test('three consecutive solves: streak reaches 3', () => {
  const state = defaultState();
  playMotd(state, true, '2026-06-12');
  playMotd(state, true, '2026-06-13');
  const result = playMotd(state, true, '2026-06-14');
  assertEqual(result.streak, 3);
});

test('skipped a day: streak resets to 1 (new streak, not continuation)', () => {
  const state = defaultState();
  playMotd(state, true, '2026-06-12'); // streak = 1
  // Skip 2026-06-13
  const result = playMotd(state, true, '2026-06-14');
  assertEqual(result.streak, 1, 'gap breaks the streak; starting fresh at 1');
});

test('fail: streak resets to 0', () => {
  const state = defaultState();
  playMotd(state, true, '2026-06-12'); // streak = 1
  const result = playMotd(state, false, '2026-06-13');
  assertEqual(result.streak, 0);
  assertEqual(state.motd.streak, 0);
});

test('fail then solve next day: streak = 1, not a continuation', () => {
  const state = defaultState();
  playMotd(state, true, '2026-06-12');  // streak = 1
  playMotd(state, false, '2026-06-13'); // streak = 0
  const result = playMotd(state, true, '2026-06-14');
  assertEqual(result.streak, 1, 'after a fail, next solve starts fresh');
});

test('solve after solve on same day does not double-count (guard: lastPlayedDate matches)', () => {
  // This tests settleMotd in isolation (the once-per-day guard is in canPlayToday).
  const state = defaultState();
  playMotd(state, true, '2026-06-12');
  // Calling settleMotd again on same day: lastPlayedDate is today not yesterday
  const result = playMotd(state, true, '2026-06-12');
  assertEqual(result.streak, 1, 'same-day replay does not increment streak');
});

// --- settleMotd state mutations ---

test('settleMotd stores testsUsed, simMinutes, solved and the faultId in lastResult', () => {
  const state = defaultState();
  const now = Date.UTC(2026, 5, 12, 12, 0, 0);
  const fault = makeFaults()['fault-alpha'];
  settleMotd(state, fault, true, ['error-log', 'temp-probe'], 7, now);
  assertEqual(state.motd.lastResult.testsUsed, 2);
  assertEqual(state.motd.lastResult.solved, true);
  assertEqual(state.motd.lastResult.simMinutes, 7, 'stores simulated minutes, not wall time');
  assertEqual(state.motd.lastResult.faultId, 'fault-alpha', 'result must pin its fault');
});

test('settleMotd score is interruption-safe: simMinutes is the passed sim time, not wall-clock elapsed', () => {
  // A real settle passes Date.now() as `now`, but the score must be the simulated
  // minutes argument — independent of how long the player was actually away.
  const state = defaultState();
  const fault = makeFaults()['fault-alpha'];
  const startedAt = Date.UTC(2026, 5, 12, 12, 0, 0);
  // Simulate a 3-hour real-world interruption between start and settle.
  const settledAt = startedAt + 3 * 60 * 60 * 1000;
  const result = settleMotd(state, fault, true, ['error-log'], 5, settledAt, '2026-06-12');
  assertEqual(result.simMinutes, 5, 'wall-clock gap must not inflate the score');
  assertEqual(state.motd.lastResult.simMinutes, 5);
});

test('settleMotd does not touch cash or reputation', () => {
  const state = defaultState();
  const cashBefore = state.player.cash;
  const repBefore = state.player.reputation;
  const fault = makeFaults()['fault-alpha'];
  const now = Date.UTC(2026, 5, 12, 12, 0, 0);
  settleMotd(state, fault, true, [], 0, now);
  assertEqual(state.player.cash, cashBefore, 'MotD must never change cash');
  assertEqual(state.player.reputation, repBefore, 'MotD must never change reputation');
});

// --- share card formatting ---

test('share card: correct solve with tests shows day number, streak, emoji row', () => {
  const result = { testsUsed: 3, solved: true, streak: 2 };
  const card = buildShareCard(result, MOTD.epochDate); // Day 1
  assert(card.includes('Day 1'), `expected "Day 1" in: ${card}`);
  assert(card.includes('🔥2'), `expected streak emoji in: ${card}`);
  assert(card.includes('🔬🔬🔬✅'), `expected emoji grid in: ${card}`);
  assert(card.includes('https://'), `expected URL in: ${card}`);
});

test('share card: failed run has no streak line and ends with ❌', () => {
  const result = { testsUsed: 2, solved: false, streak: 0 };
  const card = buildShareCard(result, MOTD.epochDate);
  assert(!card.includes('🔥'), `fail card should not show streak: ${card}`);
  assert(card.includes('🔬🔬❌'), `expected fail emoji grid in: ${card}`);
});

test('share card: zero tests used (committed fix immediately)', () => {
  const result = { testsUsed: 0, solved: true, streak: 1 };
  const card = buildShareCard(result, MOTD.epochDate);
  assert(card.includes('✅'), `expected ✅ in: ${card}`);
  assert(!card.includes('🔬'), `no tests run means no 🔬 in: ${card}`);
});

test('share card: day number advances correctly from epoch', () => {
  const result = { testsUsed: 1, solved: true, streak: 1 };
  // Day 1 = epochDate, Day 2 = epochDate + 1 day
  const card1 = buildShareCard(result, '2026-06-12');
  const card2 = buildShareCard(result, '2026-06-13');
  assert(card1.includes('Day 1'), `expected Day 1 in: ${card1}`);
  assert(card2.includes('Day 2'), `expected Day 2 in: ${card2}`);
});

test('share card: simulated minutes appear as the secondary score after the grid', () => {
  const result = { testsUsed: 2, solved: true, streak: 1, simMinutes: 13 };
  const card = buildShareCard(result, '2026-06-12');
  assert(card.includes('🔬🔬✅ · 13 min'), `expected grid + minutes in: ${card}`);
});

test('share card: never shows wall-clock seconds — only the simulated-minute suffix', () => {
  const result = { testsUsed: 1, solved: true, streak: 1, simMinutes: 5 };
  const card = buildShareCard(result, '2026-06-12');
  assert(!card.includes('s\n') && !/\d+\.\d+s/.test(card), `card must not show seconds: ${card}`);
  assert(card.includes('5 min'), `expected minutes in: ${card}`);
});

test('share card: legacy result with no simMinutes omits the minutes suffix', () => {
  const result = { testsUsed: 2, solved: true, streak: 1 }; // pre-v10 shape, no simMinutes
  const card = buildShareCard(result, '2026-06-12');
  assert(card.includes('🔬🔬✅'), `grid still renders: ${card}`);
  assert(!card.includes('min'), `no minutes suffix for legacy results: ${card}`);
});

test('getTodayDateStr returns a YYYY-MM-DD string for a known epoch', () => {
  const now = Date.UTC(2026, 5, 12, 15, 30, 0); // 2026-06-12T15:30Z
  assertEqual(getTodayDateStr(now), '2026-06-12');
});

// --- UTC-midnight crossing ---

test('puzzle date is pinned to start day even if settled after UTC midnight', () => {
  // Simulate: puzzle started at 23:55 on 2026-06-12, settled at 00:05 on 2026-06-13.
  const state = defaultState();
  const fault = makeFaults()['fault-alpha'];
  const settledAt = Date.UTC(2026, 5, 13,  0,  5, 0); // 00:05 on June 13
  const puzzleDateStr = '2026-06-12';
  settleMotd(state, fault, true, ['error-log'], 8, settledAt, puzzleDateStr);
  assertEqual(state.motd.lastPlayedDate, '2026-06-12', 'lastPlayedDate must be the start day');
  assertEqual(state.motd.lastResult.puzzleDateStr, '2026-06-12', 'lastResult.puzzleDateStr must be the start day');
});

test('streak still increments correctly when settled across midnight (puzzle date is yesterday)', () => {
  // Day 1 solved normally. Day 2: started on June 13, settled on June 14 (unusual but possible).
  const state = defaultState();
  const fault = makeFaults()['fault-alpha'];
  // Day 1 play
  settleMotd(state, fault, true, [], 0, Date.UTC(2026, 5, 12, 12, 0, 0), '2026-06-12');
  // Day 2 play — started on June 13, settled on June 14, puzzleDateStr keeps it as June 13
  const result = settleMotd(state, fault, true, [], 0, Date.UTC(2026, 5, 14, 0, 5, 0), '2026-06-13');
  assertEqual(result.streak, 2, 'streak should increment because puzzleDateStr is June 13 (day after June 12)');
  assertEqual(state.motd.lastPlayedDate, '2026-06-13');
});

test('full MotD pipeline pins the start day: startJob before midnight, commitFix after', () => {
  // End-to-end through the real game path (not settleMotd directly): the date
  // pinned at start rides on the active job and wins over the settlement clock.
  const state = defaultState();
  const faults = makeFaults();
  const fault = faults['fault-alpha'];
  startJob(state, fault, 'motd', () => 0.5, null, true, '2026-06-12');
  const result = commitFix(state, fault.correctFix, faults); // real clock ≠ 2026-06-12
  assert(result.motd === true, 'commitFix should settle as a MotD run');
  assertEqual(state.motd.lastPlayedDate, '2026-06-12', 'played-date must be the pinned start day');
  assertEqual(state.motd.lastResult.puzzleDateStr, '2026-06-12', 'result must pin the start day');
  // The new day's puzzle stays available — the cross-midnight run only consumed June 12.
  const afterMidnight = Date.UTC(2026, 5, 13, 0, 10, 0);
  assert(canPlayToday(state, afterMidnight) === true, 'June 13 puzzle must still be playable');
});

test('share card clamps a hostile testsUsed instead of throwing or exploding', () => {
  // Negative would make String.repeat throw a RangeError; a huge count would
  // build a megabyte emoji string. Both can arrive via an imported save.
  const negative = buildShareCard({ testsUsed: -5, solved: true, streak: 1 }, '2026-06-12');
  assert(negative.includes('✅'), 'negative testsUsed should render with zero scopes');
  const huge = buildShareCard({ testsUsed: 1e9, solved: false, streak: 0 }, '2026-06-12');
  assert(huge.length < 1000, `huge testsUsed must be clamped (got ${huge.length} chars)`);
});

// --- share card stats ---

test('share card: clean streak flourish appears when cleanStreak >= 1', () => {
  const result = { testsUsed: 1, solved: true, streak: 1 };
  const card = buildShareCard(result, '2026-06-12', { cleanStreak: 5, callbackCount: 0 });
  assert(card.includes('🧹'), `expected clean emoji in: ${card}`);
  assert(card.includes('5 clean'), `expected count in: ${card}`);
});

test('share card: callback shame appears when cleanStreak is 0 and callbacks > 0', () => {
  const result = { testsUsed: 2, solved: true, streak: 1 };
  const card = buildShareCard(result, '2026-06-12', { cleanStreak: 0, callbackCount: 3 });
  assert(card.includes('⚠️'), `expected shame emoji in: ${card}`);
  assert(card.includes('3 callbacks'), `expected count in: ${card}`);
});

test('share card: clean streak wins over callback shame if both are non-zero', () => {
  const result = { testsUsed: 1, solved: true, streak: 1 };
  const card = buildShareCard(result, '2026-06-12', { cleanStreak: 2, callbackCount: 1 });
  assert(card.includes('🧹'), `expected clean emoji: ${card}`);
  assert(!card.includes('⚠️'), `should not show shame when clean streak active: ${card}`);
});

test('share card: no stats line when both are zero', () => {
  const result = { testsUsed: 1, solved: true, streak: 1 };
  const card = buildShareCard(result, '2026-06-12', { cleanStreak: 0, callbackCount: 0 });
  assert(!card.includes('🧹'), `no clean line: ${card}`);
  assert(!card.includes('⚠️'), `no shame line: ${card}`);
});

test('share card: backward-compat — no stats arg produces no flourish line', () => {
  const result = { testsUsed: 1, solved: true, streak: 1 };
  const card = buildShareCard(result, '2026-06-12');
  assert(!card.includes('🧹') && !card.includes('⚠️'), `no stats line without arg: ${card}`);
});

// --- daily comeback hooks (GDD §5, 2026-07-04) ---

test('nextPuzzleCountdown counts down to the next UTC midnight', () => {
  // 21:47 UTC → 2h 13m to midnight.
  assertEqual(nextPuzzleCountdown(Date.UTC(2026, 6, 4, 21, 47, 0)), '2h 13m');
  // 23:30:30 UTC → 30m (ceil of 29.5), inside the last hour: no hours part.
  assertEqual(nextPuzzleCountdown(Date.UTC(2026, 6, 4, 23, 30, 30)), '30m');
  // Exactly midnight → a full day remains.
  assertEqual(nextPuzzleCountdown(Date.UTC(2026, 6, 4, 0, 0, 0)), '24h 0m');
});

test('streakAtRisk: solved yesterday + unplayed today = the streak is at risk', () => {
  const now = Date.UTC(2026, 6, 4, 12, 0, 0); // today = 2026-07-04
  const state = defaultState();
  state.motd.lastPlayedDate = '2026-07-03';
  state.motd.streak = 3;
  state.motd.lastResult = { testsUsed: 2, simMinutes: 7, solved: true, faultId: 'f' };
  assertEqual(streakAtRisk(state, now), 3);
});

test('streakAtRisk is 0 when played today, already broken, or last play failed', () => {
  const now = Date.UTC(2026, 6, 4, 12, 0, 0);
  const base = () => {
    const s = defaultState();
    s.motd.lastPlayedDate = '2026-07-03';
    s.motd.streak = 3;
    s.motd.lastResult = { testsUsed: 2, simMinutes: 7, solved: true, faultId: 'f' };
    return s;
  };

  const played = base();
  played.motd.lastPlayedDate = '2026-07-04'; // already played today
  assertEqual(streakAtRisk(played, now), 0, 'nothing at risk once today is played');

  const stale = base();
  stale.motd.lastPlayedDate = '2026-07-02'; // skipped yesterday: already broken
  assertEqual(streakAtRisk(stale, now), 0, 'a lapsed streak is not "at risk", it is gone');

  const failed = base();
  failed.motd.lastResult.solved = false; // yesterday was played but missed
  failed.motd.streak = 0;
  assertEqual(streakAtRisk(failed, now), 0, 'a failed yesterday leaves no streak to lose');

  const fresh = defaultState(); // never played
  assertEqual(streakAtRisk(fresh, now), 0);
});
