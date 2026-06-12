/** @file Economy invariants: settlement maths exactly matches config/balance.js, stats and callbacks update correctly. */

import { defaultState } from '../js/state.js';
import { JOBS, REPUTATION } from '../config/balance.js';
import { settleJob, utcDateStringAfter } from '../js/economy.js';

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
  const earned = settleJob(state, makeFault(), true, 'client-1');
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

test('wrong fix: pays exactly payout times callbackPayoutMult from balance.js', () => {
  const state = defaultState();
  const cash = state.player.cash;
  const earned = settleJob(state, makeFault(), false, 'client-1');
  assertEqual(earned, Math.round(120 * JOBS.callbackPayoutMult));
  assertEqual(state.player.cash, cash + earned);
  assertEqual(state.player.lifetimeEarnings, earned);
});

test('wrong fix: callback queued with fault, client, and a due day', () => {
  const state = defaultState();
  settleJob(state, makeFault(), false, 'client-1');
  assertEqual(state.jobs.callbacks.length, 1);
  const cb = state.jobs.callbacks[0];
  assertEqual(cb.faultId, 'econ-fault');
  assertEqual(cb.clientId, 'client-1');
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
  const wrongPay = Math.round(f.payout * JOBS.callbackPayoutMult);
  assert(wrongPay < correctPay, `callback pay ${wrongPay} should be < correct pay ${correctPay}`);
});

test('utcDateStringAfter is deterministic given a now', () => {
  const now = Date.UTC(2026, 5, 12, 10, 0, 0); // 2026-06-12
  assertEqual(utcDateStringAfter(JOBS.callbackDueDays, now), '2026-06-13');
});
