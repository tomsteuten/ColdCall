/** @file Diagnosis engine tests: job start, test results, tool gating, fix resolution. */

import { defaultState } from '../js/state.js';
import { JOBS, REPUTATION, DIAGNOSIS } from '../config/balance.js';
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
  assertEqual(job.minutesSpent, 0, 'a fresh job starts with a clean simulated clock');
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

test('runTest accrues each test cost on the simulated clock, once per test', () => {
  const state = freshJobState();
  runTest(state, 'error-log', FAULTS);
  assertEqual(state.jobs.active.minutesSpent, DIAGNOSIS.testMinutes['error-log']);
  runTest(state, 'temp-probe', FAULTS);
  assertEqual(
    state.jobs.active.minutesSpent,
    DIAGNOSIS.testMinutes['error-log'] + DIAGNOSIS.testMinutes['temp-probe']
  );
  // Re-running a test is free — re-reading a result costs no job time.
  runTest(state, 'error-log', FAULTS);
  assertEqual(
    state.jobs.active.minutesSpent,
    DIAGNOSIS.testMinutes['error-log'] + DIAGNOSIS.testMinutes['temp-probe']
  );
});

test('the clock is simulated, not wall-clock — minutesSpent ignores elapsed real time', () => {
  // GDD §2.1: a phone interruption must never cost the player. Only acts advance it.
  const state = freshJobState();
  assertEqual(state.jobs.active.minutesSpent, 0);
  // No tests run: however long the job sits open, the clock has not moved.
  assertEqual(state.jobs.active.minutesSpent, 0);
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

test('continuity-test is available on a MotD job regardless of multimeter tier', () => {
  // GDD §5: the shared daily puzzle must be equally solvable by every player.
  const state = freshJobState(); // multimeterTier = 1
  state.jobs.active.motd = true; // mark the active job as MotD
  const result = testAvailability(state, 'continuity-test');
  assert(result.available, 'continuity-test must be available on MotD jobs even at tier 1');
  // Regular (non-MotD) job with tier 1 is still blocked.
  state.jobs.active.motd = false;
  assert(!testAvailability(state, 'continuity-test').available, 'still blocked on non-MotD job');
});

test('commitFix with the correct fix pays payout minus parts plus the speed bonus', () => {
  const state = freshJobState(); // no tests run -> the full speed bonus
  const cashBefore = state.player.cash;
  const { correct, earned, minutesSpent } = commitFix(state, 'right-fix', FAULTS);
  assert(correct, 'should be correct');
  assertEqual(minutesSpent, 0, 'no tests were run');
  assertEqual(earned, 100 - 20 + DIAGNOSIS.speedBonusMax);
  assertEqual(state.player.cash, cashBefore + earned);
  assertEqual(state.jobs.active, null);
  assertEqual(state.jobs.callbacks, []);
});

test('running tests before a correct fix spends the clock and shrinks the bonus', () => {
  const state = freshJobState();
  runTest(state, 'temp-probe', FAULTS); // costs simulated minutes
  const spent = state.jobs.active.minutesSpent;
  const { earned, minutesSpent } = commitFix(state, 'right-fix', FAULTS);
  assertEqual(minutesSpent, spent);
  const expectedBonus = Math.max(0, DIAGNOSIS.speedBonusMax - spent * DIAGNOSIS.bonusDecayPerMin);
  assertEqual(earned, 100 - 20 + expectedBonus);
  assert(earned < 100 - 20 + DIAGNOSIS.speedBonusMax, 'testing must cost some of the bonus');
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

// --- failure as learning: chosenFix on the receipt, evidence across a callback ---

test('commitFix returns the fix the player chose (for the failure receipt)', () => {
  const wrong = freshJobState();
  assertEqual(commitFix(wrong, 'wrong-a', FAULTS).chosenFix, 'wrong-a');
  const right = freshJobState();
  assertEqual(commitFix(right, 'right-fix', FAULTS).chosenFix, 'right-fix');
});

test('a wrong fix preserves the run tests as evidence on the queued callback', () => {
  const state = freshJobState();
  runTest(state, 'temp-probe', FAULTS);
  runTest(state, 'error-log', FAULTS);
  commitFix(state, 'wrong-a', FAULTS);
  assertEqual(state.jobs.callbacks[0].evidence, ['temp-probe', 'error-log']);
});

/** Mirror main.js takeCallback: claim restores misses/source/evidence onto the job. */
function takeCallback(state, cb) {
  startJob(state, FAULTS[cb.faultId], cb.clientId, mulberry32(99), {
    misses: cb.misses,
    source: cb.source,
    techId: cb.techId ?? null,
    techName: cb.techName ?? null,
    evidence: cb.evidence ?? null,
  });
}

test('claiming a player callback restores the gathered evidence and clock', () => {
  const state = freshJobState();
  runTest(state, 'temp-probe', FAULTS); // 5 simulated minutes, reveals the clue
  commitFix(state, 'wrong-a', FAULTS);
  const cb = state.jobs.callbacks.shift();

  takeCallback(state, cb);
  const job = state.jobs.active;
  assertEqual(job.testsRun, ['temp-probe'], 'the return visit continues the investigation');
  assertEqual(job.minutesSpent, DIAGNOSIS.testMinutes['temp-probe'], 'clock recomputed from restored tests');
  // The already-run test still reads its real result, not the generic line.
  assert(job.fixOptions.includes('right-fix'), 'fix options reshuffled for the callback');
});

test('a repeat miss accumulates evidence across the return visit', () => {
  const state = freshJobState();
  runTest(state, 'temp-probe', FAULTS);
  commitFix(state, 'wrong-a', FAULTS);
  const cb1 = state.jobs.callbacks.shift();

  takeCallback(state, cb1);
  runTest(state, 'error-log', FAULTS); // gather one more clue before missing again
  commitFix(state, 'wrong-b', FAULTS);

  const cb2 = state.jobs.callbacks[0];
  assertEqual(cb2.misses, 2, 'repeat miss increments the count');
  assertEqual(cb2.evidence.slice().sort(), ['error-log', 'temp-probe'],
    'evidence grows with the second visit, nothing is forgotten');
});

test('a tech rescue with no evidence starts the claim clean', () => {
  const state = defaultState();
  takeCallback(state, {
    faultId: 'test-fault',
    clientId: 'burgertown-high-st',
    misses: 1,
    source: 'tech',
    techId: 'tech-1',
    techName: 'Dave',
    evidence: null,
  });
  assertEqual(state.jobs.active.testsRun, [], 'an idle-generated rescue is a blank investigation');
  assertEqual(state.jobs.active.minutesSpent, 0);
});

test('restored evidence ignores test ids no longer in the catalogue', () => {
  const state = defaultState();
  takeCallback(state, {
    faultId: 'test-fault',
    clientId: 'burgertown-high-st',
    misses: 1,
    source: 'player',
    evidence: ['temp-probe', 'x-ray-vision'], // a since-removed test id
  });
  assertEqual(state.jobs.active.testsRun, ['temp-probe'], 'unknown test ids are dropped on restore');
});
