/** @file Economy invariants: settlement maths exactly matches config/balance.js, stats, callbacks and tier unlocks update correctly. */

import { defaultState } from '../js/state.js';
import { JOBS, REPUTATION, TOOLS } from '../config/balance.js';
import {
  settleJob,
  buyTool,
  utcDateStringAfter,
  dueCallbacks,
  claimDueCallback,
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

test('correct fix: cash and lifetimeEarnings rise by payout minus partsCost', () => {
  const state = defaultState();
  const cash = state.player.cash;
  const { earned } = settleJob(state, makeFault(), true, 'client-1');
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

test('wrong fix: callback queued with fault, client, due day and a misses count', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1');
  assertEqual(state.jobs.callbacks.length, 1);
  const cb = state.jobs.callbacks[0];
  assertEqual(cb.faultId, 'econ-fault');
  assertEqual(cb.clientId, 'client-1');
  assertEqual(cb.misses, 1);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(cb.dueDay), `dueDay should be a UTC date string, got ${cb.dueDay}`);
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

// --- callback jobs (GDD §2.1: the job returns tomorrow at reduced rate) ---

test('correct fix on a callback pays the GDD §6 40% rate minus parts', () => {
  const state = defaultState();
  const cash = state.player.cash;
  const { earned } = settleJob(state, makeFault(), true, 'client-1', { callback: { misses: 1 } });
  assertEqual(earned, Math.round(120 * JOBS.callbackJobPayoutMult) - 30);
  assertEqual(state.player.cash, cash + earned);
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
  const callbackPay = Math.round(f.payout * JOBS.callbackJobPayoutMult) - f.partsCost;
  assert(callbackPay < fresh, `callback job pay ${callbackPay} should be < fresh pay ${fresh}`);
});

// --- callback due dates and claiming ---

const NOON = Date.UTC(2026, 5, 12, 12, 0, 0); // 2026-06-12

function stateWithCallbacks(...dueDays) {
  const state = defaultState();
  for (const [i, dueDay] of dueDays.entries()) {
    state.jobs.callbacks.push({ faultId: `f-${i}`, clientId: 'client-1', dueDay, misses: 1 });
  }
  return state;
}

test('dueCallbacks: due yesterday and today count, tomorrow does not', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-12', '2026-06-13');
  const due = dueCallbacks(state, NOON);
  assertEqual(due.length, 2);
  assertEqual(due.map((cb) => cb.dueDay), ['2026-06-11', '2026-06-12']);
});

test('claimDueCallback returns the oldest due entry and removes it from the queue', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-12', '2026-06-13');
  const faults = { 'f-0': {}, 'f-1': {}, 'f-2': {} };
  const cb = claimDueCallback(state, faults, NOON);
  assertEqual(cb.faultId, 'f-0');
  assertEqual(state.jobs.callbacks.length, 2);
});

test('claimDueCallback returns null when nothing is due', () => {
  const state = stateWithCallbacks('2026-06-13');
  assertEqual(claimDueCallback(state, { 'f-0': {} }, NOON), null);
  assertEqual(state.jobs.callbacks.length, 1, 'a not-yet-due callback stays queued');
});

test('claimDueCallback drops entries whose fault left the library and serves the next', () => {
  const state = stateWithCallbacks('2026-06-11', '2026-06-12');
  const cb = claimDueCallback(state, { 'f-1': {} }, NOON); // f-0 no longer exists
  assertEqual(cb.faultId, 'f-1');
  assertEqual(state.jobs.callbacks, [], 'the stale entry is gone, not stuck');
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
