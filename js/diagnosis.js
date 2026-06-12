/** @file Fault-tree diagnosis minigame engine: symptoms, tests, commit-to-fix resolution.
 * Pure functions over state.jobs.active — no DOM here. Settlement maths lives in economy.js.
 */

import { settleJob } from './economy.js';
import { settleMotd } from './motd.js';

/**
 * The test catalogue (GDD §2.1, SCHEMA.md "Test ids"). Faults may only reference
 * these ids. `generic` is what the player sees when a fault has nothing to say
 * for that test. `requiresMultimeterTier` gates the test behind a tool upgrade.
 * @type {Object<string, {label: string, generic: string, requiresMultimeterTier?: number}>}
 */
export const TESTS = {
  'error-log': {
    label: 'Check error log',
    generic: 'No active errors. Nothing unusual in the log.',
  },
  'temp-probe': {
    label: 'Temp probe readings',
    generic: 'All temperatures read in spec. Nothing unusual.',
  },
  'inspect-beater': {
    label: 'Pull and inspect beater assembly',
    generic: 'Beater, blades and seals all look healthy. Nothing unusual.',
  },
  'continuity-test': {
    label: 'Continuity test on motor and sensors',
    generic: 'Windings and sensors all read in spec. Nothing unusual.',
    requiresMultimeterTier: 2,
  },
};

/**
 * Fisher-Yates shuffle (copy, not in place) driven by an injected PRNG,
 * so job fix-button order is reproducible in tests.
 * @param {Array} arr
 * @param {function(): number} next PRNG in [0,1)
 * @returns {Array} new shuffled array
 */
export function shuffled(arr, next) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Start a job from a fault: the fault is the hidden answer, fix options are
 * shuffled once here and persisted so a refresh doesn't reshuffle the buttons.
 * @param {object} state game state (mutated: state.jobs.active)
 * @param {object} fault validated fault from the library
 * @param {string} clientId client this ticket came from
 * @param {function(): number} next PRNG in [0,1) for the option shuffle
 * @param {{misses: number}|null} [callback] set when replaying a claimed
 *   callback — carries the miss count so settlement can dampen repeat penalties
 * @param {boolean} [motd] true when this is a Machine of the Day run
 * @returns {object} the new active job
 */
export function startJob(state, fault, clientId, next, callback = null, motd = false) {
  if (state.jobs.active) throw new Error('A job is already active');
  state.jobs.active = {
    faultId: fault.id,
    clientId,
    machineType: fault.machineType,
    startedAt: Date.now(),
    testsRun: [],
    fixOptions: shuffled([fault.correctFix, ...fault.wrongFixes], next),
    callback,
    motd,
  };
  return state.jobs.active;
}

/**
 * Is a test available with the player's current tools?
 * @param {object} state
 * @param {string} testId
 * @returns {{available: boolean, reason: string|null}} reason is player-facing when locked
 */
export function testAvailability(state, testId) {
  const t = TESTS[testId];
  if (!t) throw new Error(`Unknown test id "${testId}"`);
  if (t.requiresMultimeterTier && state.tools.multimeterTier < t.requiresMultimeterTier) {
    return { available: false, reason: `Requires Multimeter Tier ${t.requiresMultimeterTier}` };
  }
  return { available: true, reason: null };
}

/**
 * Result string the player sees for a test on the active job's fault:
 * the fault's own result if it lists this test, else the generic "nothing unusual".
 * Pure lookup — used both by runTest and to re-render already-run tests.
 * @param {object} job state.jobs.active
 * @param {string} testId
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {string}
 */
export function testResult(job, testId, faults) {
  const fault = faults[job.faultId];
  return fault.tests[testId] ?? TESTS[testId].generic;
}

/**
 * Run a test on the active job. Records it in testsRun and returns the result.
 * Throws if no job is active, the test is unknown, or it's tool-gated.
 * @param {object} state game state (mutated: testsRun)
 * @param {string} testId
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {string} player-facing result line
 */
export function runTest(state, testId, faults) {
  const job = state.jobs.active;
  if (!job) throw new Error('No active job');
  const { available, reason } = testAvailability(state, testId);
  if (!available) throw new Error(reason);
  if (!job.testsRun.includes(testId)) job.testsRun.push(testId);
  return testResult(job, testId, faults);
}

/**
 * Commit to a fix, ending the job. Correct -> full payout; wrong -> callback
 * per GDD §2.1, with all money/reputation maths delegated to economy.js.
 * @param {object} state game state (mutated: job cleared, economy applied)
 * @param {string} fixId one of the job's fixOptions
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {{correct: boolean, fault: object, earned: number, callback: boolean, unlockedTier: number|null}}
 *   for the invoice screen
 */
export function commitFix(state, fixId, faults) {
  const job = state.jobs.active;
  if (!job) throw new Error('No active job');
  if (!job.fixOptions.includes(fixId)) throw new Error(`Fix "${fixId}" is not an option on this job`);
  const fault = faults[job.faultId];
  const correct = fixId === fault.correctFix;

  if (job.motd) {
    const result = settleMotd(state, fault, correct, job.testsRun, job.startedAt);
    state.jobs.active = null;
    return { motd: true, ...result };
  }

  // Old saves' active jobs predate the callback field; undefined means fresh job.
  const callback = job.callback ?? null;
  const { earned, unlockedTier } = settleJob(state, fault, correct, job.clientId, { callback });
  state.jobs.active = null;
  return { correct, fault, earned, callback: callback !== null, unlockedTier };
}

/**
 * Human label for a fix id ("replace-scraper-blades" -> "Replace scraper blades").
 * Keeps fix ids self-describing instead of needing a parallel label table.
 * @param {string} fixId
 * @returns {string}
 */
export function fixLabel(fixId) {
  const words = fixId.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
