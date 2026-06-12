/** @file Diagnosis engine tests: job start, test results, tool gating, fix resolution. */

import { defaultState } from '../js/state.js';
import { JOBS, REPUTATION } from '../config/balance.js';
import {
  TESTS,
  startJob,
  testAvailability,
  runTest,
  commitFix,
  shuffled,
  fixLabel,
} from '../js/diagnosis.js';
import { mulberry32 } from '../js/rng.js';

/** Minimal valid fault for engine tests. */
function makeFault() {
  return {
    id: 'test-fault',
    machineType: 'soft-serve-commercial',
    tier: 2,
    symptoms: ['It is broken.'],
    tests: { 'temp-probe': 'Probe says something revealing.' },
    correctFix: 'right-fix',
    wrongFixes: ['wrong-a', 'wrong-b'],
    payout: 100,
    partsCost: 20,
    flavour: 'Fixed.',
  };
}
const FAULTS = { 'test-fault': makeFault() };

function freshJobState() {
  const state = defaultState();
  startJob(state, FAULTS['test-fault'], 'burgertown-high-st', mulberry32(42));
  return state;
}

test('startJob sets active job with hidden fault and shuffled options', () => {
  const state = freshJobState();
  const job = state.jobs.active;
  assertEqual(job.faultId, 'test-fault');
  assertEqual(job.clientId, 'burgertown-high-st');
  assertEqual(job.testsRun, []);
  assertEqual(job.fixOptions.slice().sort(), ['right-fix', 'wrong-a', 'wrong-b'], 'options are correct + wrong fixes');
  assertEqual(job.fixOptions.filter((f) => f === 'right-fix').length, 1, 'correctFix appears exactly once');
});

test('startJob throws when a job is already active', () => {
  const state = freshJobState();
  let threw = false;
  try {
    startJob(state, FAULTS['test-fault'], 'x', mulberry32(1));
  } catch {
    threw = true;
  }
  assert(threw, 'second startJob should throw');
});

test('shuffled is deterministic per seed and preserves members', () => {
  const arr = ['a', 'b', 'c', 'd'];
  assertEqual(shuffled(arr, mulberry32(7)), shuffled(arr, mulberry32(7)), 'same seed, same order');
  assertEqual(shuffled(arr, mulberry32(7)).slice().sort(), arr, 'same members');
  assertEqual(arr, ['a', 'b', 'c', 'd'], 'input not mutated');
});

test('runTest returns the fault result for a listed test', () => {
  const state = freshJobState();
  const result = runTest(state, 'temp-probe', FAULTS);
  assertEqual(result, 'Probe says something revealing.');
  assertEqual(state.jobs.active.testsRun, ['temp-probe']);
});

test('runTest returns the generic result for an unlisted test', () => {
  const state = freshJobState();
  const result = runTest(state, 'error-log', FAULTS);
  assertEqual(result, TESTS['error-log'].generic);
});

test('running the same test twice records it once', () => {
  const state = freshJobState();
  runTest(state, 'error-log', FAULTS);
  runTest(state, 'error-log', FAULTS);
  assertEqual(state.jobs.active.testsRun, ['error-log']);
});

test('continuity-test is gated behind multimeter tier 2', () => {
  const state = freshJobState();
  assertEqual(state.tools.multimeterTier, 1, 'default state starts at tier 1');
  const locked = testAvailability(state, 'continuity-test');
  assert(!locked.available, 'should be locked at tier 1');
  assert(locked.reason.includes('Multimeter Tier 2'), locked.reason);
  let threw = false;
  try {
    runTest(state, 'continuity-test', FAULTS);
  } catch {
    threw = true;
  }
  assert(threw, 'runTest should throw when tool-gated');
  state.tools.multimeterTier = 2;
  assert(testAvailability(state, 'continuity-test').available, 'unlocked at tier 2');
  assertEqual(runTest(state, 'continuity-test', FAULTS), TESTS['continuity-test'].generic);
});

test('commitFix with the correct fix pays payout minus parts and clears the job', () => {
  const state = freshJobState();
  const cashBefore = state.player.cash;
  const { correct, earned } = commitFix(state, 'right-fix', FAULTS);
  assert(correct, 'should be correct');
  assertEqual(earned, 100 - 20);
  assertEqual(state.player.cash, cashBefore + 80);
  assertEqual(state.jobs.active, null);
  assertEqual(state.jobs.callbacks, []);
});

test('commitFix with a wrong fix pays the callback rate and queues a callback', () => {
  const state = freshJobState();
  const cashBefore = state.player.cash;
  const { correct, earned } = commitFix(state, 'wrong-a', FAULTS);
  assert(!correct, 'should be wrong');
  assertEqual(earned, Math.round(100 * JOBS.wrongFixPayoutMult));
  assertEqual(state.player.cash, cashBefore + earned);
  assertEqual(state.jobs.active, null);
  assertEqual(state.jobs.callbacks.length, 1);
  assertEqual(state.jobs.callbacks[0].faultId, 'test-fault');
  assertEqual(state.jobs.callbacks[0].clientId, 'burgertown-high-st');
});

test('commitFix rejects a fix that is not among the options', () => {
  const state = freshJobState();
  let threw = false;
  try {
    commitFix(state, 'replace-the-whole-shop', FAULTS);
  } catch {
    threw = true;
  }
  assert(threw, 'should throw on unknown fix');
  assert(state.jobs.active !== null, 'job should survive a rejected commit');
});

test('reputation moves by the configured amounts', () => {
  const state = freshJobState();
  commitFix(state, 'right-fix', FAULTS);
  assertEqual(state.player.reputation, REPUTATION.correctFix);
  startJob(state, FAULTS['test-fault'], 'burgertown-high-st', mulberry32(43));
  commitFix(state, 'wrong-a', FAULTS);
  assertEqual(state.player.reputation, REPUTATION.correctFix - REPUTATION.callbackPenalty);
});

test('fixLabel turns kebab ids into readable labels', () => {
  assertEqual(fixLabel('replace-scraper-blades'), 'Replace scraper blades');
});
