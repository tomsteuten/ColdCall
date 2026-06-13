/** @file Economy invariants: settlement maths exactly matches config/balance.js, stats, callbacks and tier unlocks update correctly. */

import { defaultState } from '../js/state.js';
import { JOBS, REPUTATION, TOOLS, TECHS, DIAGNOSIS } from '../config/balance.js';
import { STARTING } from '../config/balance.js';
import {
  settleJob,
  speedBonus,
  buyTool,
  restockVan,
  utcDateStringAfter,
  dueCallbacks,
  claimCallback,
  expireCallbacks,
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

test('correct fresh fix adds the speed bonus on top of net', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', { minutesSpent: 5 });
  assertEqual(earned, 120 - 30 + speedBonus(5));
});

test('a blind commit (zero minutes) earns the maximum speed bonus', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1', { minutesSpent: 0 });
  assertEqual(earned, 120 - 30 + DIAGNOSIS.speedBonusMax);
});

test('missing minutesSpent defaults to the full bonus (back-compat with old jobs)', () => {
  const state = defaultState();
  const { earned } = settleJob(state, makeFault(), true, 'client-1'); // no minutesSpent
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
  const informed = net + speedBonus(informedMinutes);

  // Blind guess: correct-rate-weighted mix of (full bonus) and (callback outcome).
  // The miss value is generous to guessing — the immediate partial PLUS the
  // eventual rescue at the callback rate. Even so, informed must win.
  const guessRight = net + speedBonus(0);
  const missPartial = Math.round(f.payout * JOBS.wrongFixPayoutMult);
  const rescue = Math.round(net * JOBS.callbackJobPayoutMult);
  const guessEV = p * guessRight + (1 - p) * (missPartial + rescue);

  // Exhaustive: run every test, then the correct fix (bonus forfeited).
  const allMinutes = Object.values(DIAGNOSIS.testMinutes).reduce((a, b) => a + b, 0);
  const exhaustive = net + speedBonus(allMinutes);

  assert(informed > guessEV, `informed ${informed} must beat blind-guess EV ${guessEV.toFixed(1)}`);
  assert(informed > exhaustive, `informed ${informed} must beat exhaustive ${exhaustive}`);
});

test('invariant: the speed bonus never lets a callback rescue out-earn a fresh fix', () => {
  // A fresh fix earns net + bonus; a rescue earns the discounted rate with NO
  // bonus. Even a blind fresh commit (max bonus) and an exhaustive fresh commit
  // (zero bonus) must both beat the best a callback can pay on the same fault.
  const f = makeFault();
  const freshMax = settleJob(defaultState(), f, true, 'c', { minutesSpent: 0 }).earned;
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
