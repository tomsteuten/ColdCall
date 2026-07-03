/** @file Economy invariants: settlement maths exactly matches config/balance.js, stats, callbacks and tier unlocks update correctly. */

import { defaultState } from '../js/state.js';
import { JOBS, REPUTATION, TOOLS, TECHS, DIAGNOSIS, PRESTIGE } from '../config/balance.js';
import { STARTING } from '../config/balance.js';
import {
  settleJob,
  speedBonus,
  earnedSpeedBonus,
  buyTool,
  restockVan,
  utcDateStringAfter,
  dueCallbacks,
  claimCallback,
  expireCallbacks,
  prestige,
  WORKSHOP_MACHINES,
  buyWorkshopMachine,
  sellWorkshopMachine,
} from '../js/economy.js';

function makeFault() {
  return {
    id: 'econ-fault',
    machineType: 'soft-serve-commercial',
    tier: 1,
    symptoms: ['Broken.'],
    tests: {},
    correctFix: 'fix-it',
    wrongFixes: ['break-it-more'],
    payout: 120,
    partsCost: 30,
    flavour: 'Done.',
  };
}

test('correct fix: cash and lifetimeEarnings rise by payout minus partsCost (bonus aside)', () => {
  const state = defaultState();
  const cash = state.player.cash;
  // Exhaust the speed bonus so this isolates the base net; the bonus is covered
  // by its own tests below.
  const { earned } = settleJob(state, makeFault(), true, 'client-1', { minutesSpent: 1e6 });
  assertEqual(earned, 120 - 30);
  assertEqual(state.player.cash, cash + 90);
  assertEqual(state.player.lifetimeEarnings, 90);
});

test('correct fix: stats and reputation update, no callback queued', () => {
  const state = defaultState();
  settleJob(state, makeFault(), true, 'client-1');
  assertEqual(state.stats.jobsCompleted, 1);
  assertEqual(state.stats.cleanStreak, 1);
  assertEqual(state.stats.callbacksCaused, 0);
  assertEqual(state.player.reputation, REPUTATION.correctFix);
  assertEqual(state.jobs.callbacks, []);
});

test('wrong fix: pays exactly payout times wrongFixPayoutMult from balance.js', () => {
  const state = defaultState();
  const cash = state.player.cash;
  const { earned } = settleJob(state, makeFault(), false, 'client-1');
  assertEqual(earned, Math.round(120 * JOBS.wrongFixPayoutMult));
  assertEqual(state.player.cash, cash + earned);
  assertEqual(state.player.lifetimeEarnings, earned);
});

test('wrong fix: callback queued as a player obligation with due day, expiry and misses', () => {
  const state = defaultState();
  const now = Date.UTC(2026, 5, 12, 10, 0, 0); // 2026-06-12
  settleJob(state, makeFault(), false, 'client-1', { now });
  assertEqual(state.jobs.callbacks.length, 1);
  const cb = state.jobs.callbacks[0];
  assertEqual(cb.faultId, 'econ-fault');
  assertEqual(cb.clientId, 'client-1');
  assertEqual(cb.misses, 1);
  assertEqual(cb.source, 'player', 'a fresh miss is the player\'s obligation');
  assertEqual(cb.dueDay, utcDateStringAfter(JOBS.callbackDueDays, now));
  assertEqual(cb.expiryDay, utcDateStringAfter(JOBS.callbackDueDays + JOBS.callbackExpiryDays, now));
});

test('wrong fix on a tech rescue re-queues it still tagged tech-caused', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1', {
    callback: { misses: 1, source: 'tech', techId: 'tech-2', techName: 'Mike' },
  });
  assertEqual(state.jobs.callbacks.length, 1);
  assertEqual(state.jobs.callbacks[0].source, 'tech', 'a botched rescue stays a rescue');
  assertEqual(state.jobs.callbacks[0].misses, 2);
  assertEqual(state.jobs.callbacks[0].techId, 'tech-2');
  assertEqual(state.jobs.callbacks[0].techName, 'Mike');
});

test('wrong fix saves the tests run as callback evidence (player obligation)', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1', { testsRun: ['error-log', 'temp-probe'] });
  assertEqual(state.jobs.callbacks[0].evidence, ['error-log', 'temp-probe'],
    'the gathered evidence is preserved for the return visit');
});

test('a blind wrong fix saves no evidence (null, a clean return)', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1', { testsRun: [] });
  assertEqual(state.jobs.callbacks[0].evidence, null);
});

test('a re-botched tech rescue also captures the player-gathered evidence', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1', {
    callback: { misses: 1, source: 'tech', techId: 'tech-2', techName: 'Mike' },
    testsRun: ['inspect-beater'],
  });
  assertEqual(state.jobs.callbacks[0].source, 'tech');
  assertEqual(state.jobs.callbacks[0].evidence, ['inspect-beater'],
    'evidence the player gathered survives onto the re-queued callback');
});

test('stored evidence is a copy, not a live reference to the active testsRun', () => {
  const state = defaultState();
  const testsRun = ['error-log'];
  settleJob(state, makeFault(), false, 'client-1', { testsRun });
  testsRun.push('temp-probe'); // mutating the source must not leak into the save
  assertEqual(state.jobs.callbacks[0].evidence, ['error-log']);
});

test('wrong fix: reputation drops, clean streak resets, callbacksCaused counts', () => {
  const state = defaultState();
  settleJob(state, makeFault(), true, 'client-1');
  settleJob(state, makeFault(), true, 'client-1');
  assertEqual(state.stats.cleanStreak, 2);
  settleJob(state, makeFault(), false, 'client-1');
  assertEqual(state.stats.cleanStreak, 0);
  assertEqual(state.stats.callbacksCaused, 1);
  assertEqual(state.stats.jobsCompleted, 2, 'a callback is not a completed job');
  assertEqual(state.player.reputation, 2 * REPUTATION.correctFix - REPUTATION.callbackPenalty);
});

test('a wrong fix always pays less than a correct fix (callback rate sanity)', () => {
  // Guards the GDD §2.1 incentive: guessing must never beat diagnosing.
  const f = makeFault();
  const correctPay = f.payout - f.partsCost;
  const wrongPay = Math.round(f.payout * JOBS.wrongFixPayoutMult);
  assert(wrongPay < correctPay, `callback pay ${wrongPay} should be < correct pay ${correctPay}`);
});

// --- diagnosis speed bonus (GDD §2.1: base payout + a decaying speed bonus) ---

test('speedBonus is full at zero minutes and decays per balance.js', () => {
  assertEqual(speedBonus(0), DIAGNOSIS.speedBonusMax);
  assertEqual(speedBonus(3), Math.round(DIAGNOSIS.speedBonusMax - 3 * DIAGNOSIS.bonusDecayPerMin));
});

test('speedBonus floors at zero — exhaustive testing never drops pay below base', () => {
  const minutesToZero = DIAGNOSIS.speedBonusMax / DIAGNOSIS.bonusDecayPerMin;
  assertEqual(speedBonus(minutesToZero + 100), 0);
  assertEqual(speedBonus(1e6), 0, 'bonus must floor at 0 so thoroughness is never punished');
});

test('correct fresh fix adds the speed bonus on top of net (once a test was run)', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', {
    minutesSpent: 5,
    testsRun: ['temp-probe'],
  });
  assertEqual(earned, 120 - 30 + speedBonus(5));
});

test('a zero-test blind commit earns NO speed bonus (2026-07-04, GDD §2.1)', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', {
    minutesSpent: 0,
    testsRun: [],
  });
  assertEqual(earned, 120 - 30, 'blind commit must forfeit the bonus');
  assertEqual(earnedSpeedBonus(0, 0), 0, 'the gate lives in earnedSpeedBonus');
  assert(
    DIAGNOSIS.minTestsForBonus >= 1,
    'balance.js must require at least one test for the bonus'
  );
});

test('one test at zero extra minutes earns the full bonus — the gate is tests, not time', () => {
  assertEqual(earnedSpeedBonus(0, 1), DIAGNOSIS.speedBonusMax);
});

test('missing minutesSpent with evidence run defaults to the full bonus (back-compat)', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', {
    testsRun: ['error-log'],
  }); // no minutesSpent — the generous reading for an old in-flight job
  assertEqual(earned, 120 - 30 + DIAGNOSIS.speedBonusMax);
});

test('the speed bonus never applies to a callback rescue', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', {
    callback: { misses: 1 },
    minutesSpent: 0, // would be the maximum bonus on a fresh job
  });
  assertEqual(
    earned,
    Math.round((120 - 30) * JOBS.callbackJobPayoutMult),
    'a discounted rescue earns no speed bonus'
  );
});

test('invariant: informed diagnosis beats both blind guessing and exhaustive testing (EV)', () => {
  // GDD §2.1: a few targeted tests then the correct fix must out-earn committing
  // blind AND running every test. Modelled on the most guess-friendly real fault
  // (3 fix options -> 1/3 chance of a lucky blind guess; most faults have 4).
  const f = makeFault(); // payout 120, parts 30 -> net 90
  const net = f.payout - f.partsCost;
  const p = 1 / 3; // probability a blind guess lands the correct fix

  // Informed: two targeted tests, then the correct fix.
  const informedMinutes =
    DIAGNOSIS.testMinutes['error-log'] + DIAGNOSIS.testMinutes['temp-probe'];
  const informed = net + earnedSpeedBonus(informedMinutes, 2);

  // Blind guess: correct-rate-weighted mix of (net, NO bonus — a zero-test
  // commit forfeits it since 2026-07-04) and (callback outcome). The miss value
  // is generous to guessing — the immediate partial PLUS the eventual rescue at
  // the callback rate. Even so, informed must win.
  const guessRight = net + earnedSpeedBonus(0, 0);
  const missPartial = Math.round(f.payout * JOBS.wrongFixPayoutMult);
  const rescue = Math.round(net * JOBS.callbackJobPayoutMult);
  const guessEV = p * guessRight + (1 - p) * (missPartial + rescue);

  // Exhaustive: run every test, then the correct fix (bonus decayed to nothing).
  const allTests = Object.keys(DIAGNOSIS.testMinutes);
  const allMinutes = Object.values(DIAGNOSIS.testMinutes).reduce((a, b) => a + b, 0);
  const exhaustive = net + earnedSpeedBonus(allMinutes, allTests.length);

  assert(informed > guessEV, `informed ${informed} must beat blind-guess EV ${guessEV.toFixed(1)}`);
  assert(informed > exhaustive, `informed ${informed} must beat exhaustive ${exhaustive}`);

  // And a LUCKY blind guess (best case, not just EV) must still lose to informed
  // play on the same fault — the bonus gate is what guarantees it.
  assert(
    informed > guessRight,
    `informed ${informed} must beat even a lucky blind guess ${guessRight}`
  );
});

test('invariant: the speed bonus never lets a callback rescue out-earn a fresh fix', () => {
  // A fresh fix earns net + bonus; a rescue earns the discounted rate with NO
  // bonus. Even a blind fresh commit (max bonus) and an exhaustive fresh commit
  // (zero bonus) must both beat the best a callback can pay on the same fault.
  const f = makeFault();
  const freshMax = settleJob(defaultState(), f, true, 'c', {
    minutesSpent: 0,
    testsRun: ['error-log'], // bonus unlocked: the best a fresh fix can pay
  }).earned;
  const freshMin = settleJob(defaultState(), f, true, 'c', { minutesSpent: 1e6 }).earned;
  const callbackBest = settleJob(defaultState(), f, true, 'c', {
    callback: { misses: 1 },
    minutesSpent: 0,
  }).earned;
  assert(callbackBest < freshMin, `callback ${callbackBest} must be < worst fresh ${freshMin}`);
  assert(callbackBest < freshMax, `callback ${callbackBest} must be < best fresh ${freshMax}`);
});

test('invariant: the speed bonus is purely additive, so active > idle still holds', () => {
  // The bonus only ever ADDS to a fresh correct fix (>= 0), so every active job
  // still pays at least its net — the change cannot weaken the active>idle
  // guarantee idle.test.js pins on payoutMin - partsCostMax.
  for (const m of [0, 5, 30, 999]) {
    assert(speedBonus(m) >= 0, `bonus must be >= 0 (was ${speedBonus(m)} at ${m} min)`);
  }
  const worstActive = JOBS.tier1.payoutMin - JOBS.tier1.partsCostMax; // bonus floored at 0
  const idlePerMin = (TECHS.earningsPerJob * TECHS.jobsPerHour) / 60;
  assert(
    worstActive > idlePerMin,
    `worst active job ${worstActive} must beat idle $/min ${idlePerMin.toFixed(2)}`
  );
});

// --- callback jobs (GDD §2.1: the job returns tomorrow at reduced rate) ---

test('correct fix on a player-caused callback pays the GDD §6 40% rate on the job net', () => {
  const state = defaultState();
  const cash = state.player.cash;
  const { earned } = settleJob(state, makeFault(), true, 'client-1', {
    callback: { misses: 1, source: 'player' },
  });
  assertEqual(earned, Math.round((120 - 30) * JOBS.callbackJobPayoutMult));
  assertEqual(state.player.cash, cash + earned);
});

test('correct fix on a tech-caused rescue pays the higher rescue rate on the job net', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', {
    callback: { misses: 1, source: 'tech' },
  });
  assertEqual(earned, Math.round((120 - 30) * JOBS.rescueCallbackPayoutMult));
});

test('a callback with no source defaults to the conservative player rate', () => {
  // Back-compat: an in-flight callback job saved before the split has no source.
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', { callback: { misses: 1 } });
  assertEqual(earned, Math.round((120 - 30) * JOBS.callbackJobPayoutMult), 'no source => player rate');
});

test('invariant: the rescue rate must stay below 1.0 so it never beats a fresh ticket', () => {
  // GDD §3.1: farming rescues must never out-earn taking new tickets.
  assert(JOBS.rescueCallbackPayoutMult < 1.0, 'rescue rate must be < 1.0');
  const f = makeFault();
  const freshMin = settleJob(defaultState(), f, true, 'c', { minutesSpent: 1e6 }).earned; // net, no bonus
  const rescueBest = settleJob(defaultState(), f, true, 'c', {
    callback: { misses: 1, source: 'tech' },
  }).earned;
  assert(rescueBest < freshMin, `tech rescue ${rescueBest} must be < worst fresh ${freshMin}`);
});

test('a correct callback fix never loses money, even with expensive parts', () => {
  // Guards the regression where mult applied to gross payout minus full parts
  // went negative for high-partsCost faults.
  const state = defaultState();
  const pricey = { ...makeFault(), payout: 80, partsCost: 60 };
  const { earned } = settleJob(state, pricey, true, 'client-1', { callback: { misses: 1 } });
  assert(earned > 0, `correct callback fix must earn > $0, got $${earned}`);
});

test('correct fix on a callback earns rep and counts the job, but not the clean streak', () => {
  const state = defaultState();
  state.stats.cleanStreak = 0; // it was reset by the miss that caused the callback
  settleJob(state, makeFault(), true, 'client-1', { callback: { misses: 1 } });
  assertEqual(state.player.reputation, REPUTATION.correctFix);
  assertEqual(state.stats.jobsCompleted, 1);
  assertEqual(state.stats.cleanStreak, 0, 'a rescued callback is not a clean job');
  assertEqual(state.jobs.callbacks, [], 'fixing a callback must not re-queue it');
});

test('wrong fix on a callback pays $0 and re-queues for tomorrow with misses+1', () => {
  const state = defaultState();
  const cash = state.player.cash;
  const now = Date.UTC(2026, 5, 12, 10, 0, 0); // 2026-06-12
  const { earned } = settleJob(state, makeFault(), false, 'client-1', {
    callback: { misses: 1 },
    now,
  });
  assertEqual(earned, 0, 'the partial payout was already paid on the first miss');
  assertEqual(state.player.cash, cash);
  assertEqual(state.jobs.callbacks.length, 1);
  assertEqual(state.jobs.callbacks[0].misses, 2);
  assertEqual(state.jobs.callbacks[0].dueDay, utcDateStringAfter(JOBS.callbackDueDays, now));
});

test('repeat misses use the dampened reputation penalty', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1', { callback: { misses: 1 } });
  assertEqual(state.player.reputation, -REPUTATION.repeatCallbackPenalty);
  assert(
    REPUTATION.repeatCallbackPenalty < REPUTATION.callbackPenalty,
    'repeat penalty must be dampened, not repeated in full'
  );
});

test('a callback job never out-earns a fresh job (active > idle, per minute)', () => {
  // Same fault, same job length: the callback rate must pay strictly less,
  // so being forced onto callbacks is always worse $/min than fresh tickets.
  const f = makeFault();
  const fresh = f.payout - f.partsCost;
  const callbackPay = Math.round((f.payout - f.partsCost) * JOBS.callbackJobPayoutMult);
  assert(callbackPay < fresh, `callback job pay ${callbackPay} should be < fresh pay ${fresh}`);
});

// --- callback due dates and claiming ---

const NOON = Date.UTC(2026, 5, 12, 12, 0, 0); // 2026-06-12

function stateWithCallbacks(...dueDays) {
  const state = defaultState();
  for (const [i, dueDay] of dueDays.entries()) {
    state.jobs.callbacks.push({ faultId: `f-${i}`, clientId: 'client-1', dueDay, misses: 1, source: 'player' });
  }
  return state;
}

test('dueCallbacks: due yesterday and today count, tomorrow does not', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-12', '2026-06-13');
  const due = dueCallbacks(state, NOON);
  assertEqual(due.length, 2);
  assertEqual(due.map((cb) => cb.dueDay), ['2026-06-11', '2026-06-12']);
});

test('claimCallback returns the chosen due entry by index and removes it', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-12', '2026-06-13');
  const faults = { 'f-0': {}, 'f-1': {}, 'f-2': {} };
  const cb = claimCallback(state, faults, 1, NOON); // the player picked the second one
  assertEqual(cb.faultId, 'f-1');
  assertEqual(state.jobs.callbacks.length, 2);
  assertEqual(state.jobs.callbacks.map((c) => c.faultId), ['f-0', 'f-2'], 'only the chosen one is removed');
});

test('claimCallback refuses a not-yet-due index without mutating', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-13');
  assertEqual(claimCallback(state, { 'f-0': {}, 'f-1': {} }, 1, NOON), null, 'index 1 is due tomorrow');
  assertEqual(state.jobs.callbacks.length, 2, 'a not-yet-due callback stays queued');
});

test('claimCallback refuses an out-of-range index', () => {
  const state = stateWithCallbacks('2026-06-11');
  assertEqual(claimCallback(state, { 'f-0': {} }, 5, NOON), null);
  assertEqual(state.jobs.callbacks.length, 1);
});

test('claimCallback drops an entry whose fault left the library and returns null', () => {
  const state = stateWithCallbacks('2026-06-11');
  const cb = claimCallback(state, {}, 0, NOON); // f-0 no longer exists
  assertEqual(cb, null);
  assertEqual(state.jobs.callbacks, [], 'the stale entry is removed, not stuck');
});

// --- callback expiry (GDD §3.1: stale callbacks fall off the board on load) ---

function callbackWith(source, expiryDay) {
  return { faultId: 'f', clientId: 'client-1', dueDay: '2026-06-10', expiryDay, misses: 1, source };
}

test('expireCallbacks removes callbacks past their expiry day and reports the count', () => {
  const state = defaultState();
  state.jobs.callbacks = [
    callbackWith('player', '2026-06-11'), // expired (before today)
    callbackWith('tech', '2026-06-13'),   // still claimable
  ];
  const report = expireCallbacks(state, NOON); // today = 2026-06-12
  assertEqual(report.count, 1);
  assertEqual(state.jobs.callbacks.length, 1, 'the live callback stays');
  assertEqual(state.jobs.callbacks[0].source, 'tech');
});

test('expireCallbacks docks reputation for player obligations only, not tech rescues', () => {
  const state = defaultState();
  state.player.reputation = 10;
  state.jobs.callbacks = [
    callbackWith('player', '2026-06-11'),
    callbackWith('player', '2026-06-10'),
    callbackWith('tech', '2026-06-09'), // expires silently
  ];
  const report = expireCallbacks(state, NOON);
  assertEqual(report.count, 3);
  assertEqual(report.playerExpired, 2);
  assertEqual(report.techExpired, 1);
  assertEqual(report.repPenalty, 2 * REPUTATION.expiredCallbackRepPenalty);
  assertEqual(state.player.reputation, 10 - 2 * REPUTATION.expiredCallbackRepPenalty);
  assertEqual(state.jobs.callbacks, [], 'all three were past expiry');
});

test('expireCallbacks returns null and changes nothing when none are expired', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-12'); // no expiryDay set
  state.jobs.callbacks[0].expiryDay = '2026-06-13';
  state.jobs.callbacks[1].expiryDay = '2026-06-14';
  const rep = state.player.reputation;
  assertEqual(expireCallbacks(state, NOON), null);
  assertEqual(state.jobs.callbacks.length, 2);
  assertEqual(state.player.reputation, rep);
});

test('expireCallbacks keeps a callback due today — expiry is strictly past', () => {
  const state = defaultState();
  state.jobs.callbacks = [callbackWith('player', '2026-06-12')]; // expiryDay === today
  assertEqual(expireCallbacks(state, NOON), null, 'expiry day itself is still claimable');
  assertEqual(state.jobs.callbacks.length, 1);
});

// --- tier unlocks ---

test('reaching the balance.js reputation threshold unlocks tier 2', () => {
  const state = defaultState();
  state.player.reputation = REPUTATION.tierThresholds[2] - REPUTATION.correctFix;
  const { unlockedTier } = settleJob(state, makeFault(), true, 'client-1');
  assertEqual(unlockedTier, 2);
  assertEqual(state.player.tierUnlocked, 2);
});

test('below the threshold nothing unlocks; an unlocked tier is not re-announced', () => {
  const state = defaultState();
  assertEqual(settleJob(state, makeFault(), true, 'client-1').unlockedTier, null);
  assertEqual(state.player.tierUnlocked, 1);

  state.player.reputation = REPUTATION.tierThresholds[2] + 5;
  state.player.tierUnlocked = 2;
  assertEqual(settleJob(state, makeFault(), true, 'client-1').unlockedTier, null);
  assertEqual(state.player.tierUnlocked, 2, 'no tier 3 threshold exists yet');
});

// --- tools shop ---

test('buyTool deducts exactly the balance.js price and upgrades the multimeter', () => {
  const state = defaultState();
  state.player.cash = TOOLS.multimeterTier2Cost + 100;
  const result = buyTool(state, 'multimeter-tier-2');
  assertEqual(result, { ok: true, reason: null });
  assertEqual(state.player.cash, 100);
  assertEqual(state.tools.multimeterTier, 2);
});

test('buyTool refuses when unaffordable and mutates nothing', () => {
  const state = defaultState();
  state.player.cash = TOOLS.multimeterTier2Cost - 1;
  const result = buyTool(state, 'multimeter-tier-2');
  assertEqual(result.ok, false);
  assert(result.reason, 'refusal should carry a player-facing reason');
  assertEqual(state.player.cash, TOOLS.multimeterTier2Cost - 1);
  assertEqual(state.tools.multimeterTier, 1);
});

test('buyTool refuses a double-buy and takes no more money', () => {
  const state = defaultState();
  state.player.cash = TOOLS.multimeterTier2Cost * 2;
  buyTool(state, 'multimeter-tier-2');
  const cashAfterFirst = state.player.cash;
  const result = buyTool(state, 'multimeter-tier-2');
  assertEqual(result.ok, false);
  assertEqual(state.player.cash, cashAfterFirst);
  assertEqual(state.tools.multimeterTier, 2);
});

test('buyTool throws on an unknown tool id (programmer error, not player state)', () => {
  let threw = false;
  try {
    buyTool(defaultState(), 'sonic-screwdriver');
  } catch {
    threw = true;
  }
  assert(threw, 'expected buyTool to throw for an unknown tool id');
});

test('utcDateStringAfter is deterministic given a now', () => {
  const now = Date.UTC(2026, 5, 12, 10, 0, 0); // 2026-06-12
  assertEqual(utcDateStringAfter(JOBS.callbackDueDays, now), '2026-06-13');
});

// --- van stock ---

test('van: correct fix with partsCost > 0 consumes one generic-parts', () => {
  const state = defaultState();
  assertEqual(state.van.stock['generic-parts'], STARTING.vanSlots);
  settleJob(state, makeFault(), true, 'client-1');
  assertEqual(state.van.stock['generic-parts'], STARTING.vanSlots - 1);
});

test('van: wrong fix does not consume parts', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1');
  assertEqual(state.van.stock['generic-parts'], STARTING.vanSlots);
});

test('van: procedure-only fix (partsCost 0) does not consume parts', () => {
  const state = defaultState();
  const procedureFault = { ...makeFault(), partsCost: 0 };
  settleJob(state, procedureFault, true, 'client-1');
  assertEqual(state.van.stock['generic-parts'], STARTING.vanSlots);
});

test('van: settleJob throws when out of parts for a parts-needing correct fix', () => {
  const state = defaultState();
  state.van.stock['generic-parts'] = 0;
  let threw = false;
  try { settleJob(state, makeFault(), true, 'client-1'); } catch { threw = true; }
  assert(threw, 'should throw when van is empty and fix needs parts');
  assertEqual(state.van.stock['generic-parts'], 0, 'stock should be unchanged on throw');
});

test('restockVan: fills to capacity for free — parts are billed per job, not twice', () => {
  const state = defaultState();
  state.van.stock['generic-parts'] = 1;
  state.player.cash = 0; // even broke, a supplier run restores availability
  const result = restockVan(state);
  assert(result.ok, 'restock should succeed');
  assertEqual(state.van.stock['generic-parts'], state.van.slots);
  assertEqual(state.player.cash, 0, 'restocking must not charge — partsCost is charged at settlement');
});

test('restockVan: refuses when van already full', () => {
  const state = defaultState();
  const result = restockVan(state); // starts full
  assert(!result.ok, 'should refuse when already full');
  assertEqual(state.van.stock['generic-parts'], STARTING.vanSlots);
});

test('prestige resets progress but keeps founder bonus and prestigeCount', () => {
  const state = defaultState();
  state.player.lifetimeEarnings = PRESTIGE.lifetimeEarningsThreshold;
  state.player.reputation = 100;
  state.player.cash = 50000;
  state.player.tierUnlocked = 3;
  state.tools.multimeterTier = 2;
  state.tools.thermalCamera = true;
  state.van.slots = 6;
  state.van.stock['generic-parts'] = 2;
  state.techs.push({ id: 'tech-1', name: 'Dave', skill: 1, routeId: 'burgertown-south', hiredAt: 0 });
  state.routes.push({ id: 'burgertown-south', clientId: 'burgertown-high-st' });

  prestige(state);

  assertEqual(state.player.prestigeCount, 1);
  assertEqual(state.player.founderBonus, 2.0, '1.0 + 100 * 0.01 = 2.0');
  assertEqual(state.player.cash, STARTING.cash);
  assertEqual(state.player.reputation, 0);
  assertEqual(state.player.lifetimeEarnings, 0);
  assertEqual(state.player.tierUnlocked, STARTING.tierUnlocked);
  assertEqual(state.tools.multimeterTier, STARTING.multimeterTier);
  assertEqual(state.tools.thermalCamera, false);
  assertEqual(state.van.slots, STARTING.vanSlots);
  assertEqual(state.van.stock['generic-parts'], STARTING.vanSlots);
  assertEqual(state.techs, []);
  assertEqual(state.routes, []);
});

test('prestige throws error if below threshold', () => {
  const state = defaultState();
  state.player.lifetimeEarnings = PRESTIGE.lifetimeEarningsThreshold - 1;
  let threw = false;
  try {
    prestige(state);
  } catch {
    threw = true;
  }
  assert(threw, 'should throw error when lifetime earnings are below the threshold');
});

test('founder bonus multiplies correct fix cash and reputation gains', () => {
  const state = defaultState();
  state.player.founderBonus = 2.0;
  const cashBefore = state.player.cash;
  const { earned } = settleJob(state, makeFault(), true, 'client-1', { minutesSpent: 1e6 });
  
  // payout: 120, parts: 30 -> net 90. Multiplied by 2.0 -> 180.
  assertEqual(earned, 180);
  assertEqual(state.player.cash, cashBefore + 180);
  assertEqual(state.player.reputation, Math.round(REPUTATION.correctFix * 2.0));
});

test('WORKSHOP_MACHINES entries are well-formed and profitable to flip', () => {
  for (const [id, m] of Object.entries(WORKSHOP_MACHINES)) {
    assert(typeof m.buyPrice === 'number' && m.buyPrice > 0, `${id} needs a buyPrice`);
    assert(m.sellPrice > m.buyPrice, `${id} must sell above buy or the workshop is a pure loss`);
    assert(typeof m.tierRequired === 'number', `${id} needs a tierRequired`);
  }
});

test('rule 5: workshop flip margin never beats the same tier\'s average fresh-ticket net', () => {
  // A workshop repair costs the same active diagnosis time as a fresh ticket
  // but pays no reputation and no speed bonus, so its cash margin must sit
  // below the tier's average fresh net (payout − parts midpoints). Sales are
  // not founderBonus-scaled while fresh nets are, so holding at bonus 1.0 here
  // proves the invariant for every bonus level.
  const tierNets = {
    1: (JOBS.tier1.payoutMin + JOBS.tier1.payoutMax) / 2 - (JOBS.tier1.partsCostMin + JOBS.tier1.partsCostMax) / 2,
    2: (JOBS.tier2.payoutMin + JOBS.tier2.payoutMax) / 2 - (JOBS.tier2.partsCostMin + JOBS.tier2.partsCostMax) / 2,
    3: (JOBS.tier3.payoutMin + JOBS.tier3.payoutMax) / 2 - (JOBS.tier3.partsCostMin + JOBS.tier3.partsCostMax) / 2,
  };
  for (const [id, m] of Object.entries(WORKSHOP_MACHINES)) {
    const margin = m.sellPrice - m.buyPrice;
    const freshNet = tierNets[m.tierRequired];
    assert(
      margin < freshNet,
      `${id}: flip margin $${margin} must stay below tier ${m.tierRequired} avg fresh net $${freshNet}`
    );
  }
});

test('sellWorkshopMachine pays the flat sellPrice, never scaled by founderBonus', () => {
  const state = defaultState();
  state.player.founderBonus = 3.0; // a heavily-prestiged save
  state.workshop.machines.push({ id: 'm1', machineType: 'slushie-machine', faultId: 'f', status: 'repaired' });
  const cashBefore = state.player.cash;
  const { ok, earned } = sellWorkshopMachine(state, 'm1');
  assert(ok, 'repaired machine should sell');
  assertEqual(earned, WORKSHOP_MACHINES['slushie-machine'].sellPrice, 'sale must ignore founderBonus');
  assertEqual(state.player.cash, cashBefore + earned);
  assertEqual(state.workshop.machines.length, 0, 'sold machine leaves the workshop');
});

test('sellWorkshopMachine refuses broken machines and unknown ids without mutating', () => {
  const state = defaultState();
  state.workshop.machines.push({ id: 'm1', machineType: 'slushie-machine', faultId: 'f', status: 'broken' });
  const cashBefore = state.player.cash;
  assert(!sellWorkshopMachine(state, 'm1').ok, 'broken machine must not sell');
  assert(!sellWorkshopMachine(state, 'nope').ok, 'unknown id must not sell');
  assertEqual(state.player.cash, cashBefore, 'refusals must not move cash');
  assertEqual(state.workshop.machines.length, 1, 'refusals must not remove machines');
});

test('buyWorkshopMachine deducts cash, respects tier locks and affordability', () => {
  const state = defaultState(); // tier 1, $500
  const t1 = buyWorkshopMachine(state, 'slushie-machine', 'some-fault', 'm1');
  assert(t1.ok, 'tier 1 machine should be buyable at tier 1');
  assertEqual(state.player.cash, STARTING.cash - WORKSHOP_MACHINES['slushie-machine'].buyPrice);
  assertEqual(state.workshop.machines[0].status, 'broken');

  const locked = buyWorkshopMachine(state, 'soft-serve-commercial', 'f', 'm2');
  assert(!locked.ok, 'tier 2 machine must be locked at tier 1');

  state.player.cash = 0;
  const broke = buyWorkshopMachine(state, 'slushie-machine', 'f', 'm3');
  assert(!broke.ok, 'must refuse when unaffordable');
  assertEqual(state.workshop.machines.length, 1, 'refusals must not add machines');
});


