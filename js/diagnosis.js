/** @file Fault-tree diagnosis minigame engine: symptoms, tests, commit-to-fix resolution.
 * Pure functions over state.jobs.active — no DOM here. Settlement maths lives in economy.js.
 */

import { settleJob, recordCodexFix } from './economy.js';
import { settleMotd } from './motd.js';
import { mulberry32 } from './rng.js';
import { DIAGNOSIS } from '../config/balance.js';

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
 * @param {function(): number} next PRNG in [0,1) for the variant draw and option shuffle
 * @param {{misses: number, source?: string, techId?: string|null, techName?: string|null, evidence?: string[]|null, variant?: number}|null} [callback] set when replaying a claimed
 *   callback — carries the miss count so settlement can dampen repeat penalties,
 *   any `evidence` (tests run before the wrong fix) to restore so the return
 *   visit continues the investigation rather than starting from a blank panel,
 *   and the `variant` the original job presented so the machine comes back in
 *   the same state instead of a rerolled presentation.
 * @param {boolean} [motd] true when this is a Machine of the Day run
 * @param {string|null} [puzzleDateStr] UTC date "YYYY-MM-DD" the MotD puzzle was
 *   started on; stored so settlement uses the start-day date even across UTC midnight.
 * @returns {object} the new active job
 */
export function startJob(state, fault, clientId, next, callback = null, motd = false, puzzleDateStr = null) {
  if (state.jobs.active) throw new Error('A job is already active');
  // Restore preserved evidence from a player-worked callback (GDD §2.1). Filter
  // to known test ids — the array is save-derived — and recompute the clock from
  // them, since each test only costs simulated minutes on its first run.
  const restored = Array.isArray(callback?.evidence)
    ? callback.evidence.filter((id) => id in TESTS)
    : [];
  // Symptom-variant draw (2026-07-04, GDD §2.1): 0 is the fault's base
  // presentation, 1..n index into symptomVariants. The draw comes off the same
  // seeded PRNG as the option shuffle — and MUST stay before it, in this order —
  // so a given seed (e.g. the MotD date) reproduces the exact same job for every
  // player (rule 6). A callback replays the variant its original job presented.
  const variantCount = 1 + (Array.isArray(fault.symptomVariants) ? fault.symptomVariants.length : 0);
  const variant = callback ? (callback.variant ?? 0) : Math.floor(next() * variantCount);
  state.jobs.active = {
    faultId: fault.id,
    clientId,
    machineType: fault.machineType,
    startedAt: Date.now(),
    variant,
    testsRun: restored.slice(),
    minutesSpent: restored.reduce((m, id) => m + (DIAGNOSIS.testMinutes[id] ?? 0), 0),
    fixOptions: shuffled([fault.correctFix, ...fault.wrongFixes], next),
    callback,
    motd,
    puzzleDateStr: motd ? puzzleDateStr : null,
  };
  return state.jobs.active;
}

/**
 * A fault's symptom variant by presentation index: null for 0 (the base
 * presentation) or an out-of-range index (a save can reference a variant the
 * library no longer has — fall back to base rather than break the job).
 * @param {object} fault validated fault from the library
 * @param {number|undefined} variantIndex 0 = base, 1..n = symptomVariants[n-1]
 * @returns {{symptoms: string[], tests?: Object<string, string>}|null}
 */
export function faultVariant(fault, variantIndex) {
  if (!variantIndex) return null;
  return fault.symptomVariants?.[variantIndex - 1] ?? null;
}

/**
 * The symptom lines the active job presents: its variant's set when one was
 * drawn, else the fault's base symptoms.
 * @param {object} job state.jobs.active
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {string[]}
 */
export function jobSymptoms(job, faults) {
  const fault = faults[job.faultId];
  return faultVariant(fault, job.variant)?.symptoms ?? fault.symptoms;
}

/**
 * Is a test available with the player's current tools?
 * MotD runs are ungated — the shared puzzle must be equally solvable by every
 * player, so all tests are available regardless of tool tier (GDD §5).
 * @param {object} state
 * @param {string} testId
 * @returns {{available: boolean, reason: string|null}} reason is player-facing when locked
 */
export function testAvailability(state, testId) {
  const t = TESTS[testId];
  if (!t) throw new Error(`Unknown test id "${testId}"`);
  const isMotd = !!state.jobs.active?.motd;
  if (t.requiresMultimeterTier && !isMotd && state.tools.multimeterTier < t.requiresMultimeterTier) {
    return { available: false, reason: `Requires Multimeter Tier ${t.requiresMultimeterTier}` };
  }
  return { available: true, reason: null };
}

/**
 * Result string the player sees for a test on the active job's fault: the
 * job's variant override if it has one, else the fault's own result, else the
 * generic "nothing unusual". Pure lookup — used both by runTest and to
 * re-render already-run tests.
 * @param {object} job state.jobs.active
 * @param {string} testId
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {string}
 */
export function testResult(job, testId, faults) {
  const fault = faults[job.faultId];
  const variant = faultVariant(fault, job.variant);
  return variant?.tests?.[testId] ?? fault.tests[testId] ?? TESTS[testId].generic;
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
  // Only the first run of a test costs time — re-reading a result is free.
  if (!job.testsRun.includes(testId)) {
    job.testsRun.push(testId);
    job.minutesSpent = (job.minutesSpent ?? 0) + (DIAGNOSIS.testMinutes[testId] ?? 0);
  }
  return testResult(job, testId, faults);
}

/**
 * Commit to a fix, ending the job. Correct -> full payout; wrong -> callback
 * per GDD §2.1, with all money/reputation maths delegated to economy.js.
 * @param {object} state game state (mutated: job cleared, economy applied)
 * @param {string} fixId one of the job's fixOptions
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {{correct: boolean, fault: object, earned: number, repDelta: number, chosenFix: string, callback: boolean, callbackSource: string|null, unlockedTier: number|null, minutesSpent: number, testsUsed: number, cleanStreak: number}}
 *   for the invoice screen (minutesSpent + testsUsed let it show the speed bonus
 *   actually earned; repDelta and cleanStreak drive the receipt's reputation and
 *   streak lines; callbackSource lets it show the right callback rate; chosenFix
 *   lets a failure receipt contrast the player's pick with the correct fix, GDD §2.1)
 */
export function commitFix(state, fixId, faults) {
  const job = state.jobs.active;
  if (!job) throw new Error('No active job');
  if (!job.fixOptions.includes(fixId)) throw new Error(`Fix "${fixId}" is not an option on this job`);
  const fault = faults[job.faultId];
  const correct = fixId === fault.correctFix;

  // Every correct diagnosis fills the Codex — fresh, callback, workshop and
  // MotD alike (GDD §5): the deduction is the same whoever pays for it. Always
  // recorded AFTER settlement, which can refuse (out of parts) by throwing.
  const codexAfterSettle = () => (correct ? recordCodexFix(state, fault.id, faults) : null);

  if (job.motd) {
    // Score by simulated diagnostic minutes, not wall-clock time: only the player's
    // own test choices advance the clock, so interruptions can't worsen a shared
    // result (GDD §5). `now` is passed only to derive the puzzle date when none is pinned.
    const now = Date.now();
    const simMinutes = job.minutesSpent ?? 0;
    const result = settleMotd(state, fault, correct, job.testsRun, simMinutes, now, job.puzzleDateStr ?? null);
    const codex = codexAfterSettle();
    state.jobs.active = null;
    return { motd: true, codex, ...result };
  }

  // Intercept workshop jobs
  if (job.clientId && job.clientId.startsWith('workshop-')) {
    const machineId = job.clientId.substring('workshop-'.length);
    const wMachine = state.workshop && state.workshop.machines
      ? state.workshop.machines.find(m => m.id === machineId)
      : null;
    if (correct) {
      if (fault.partsCost > 0) {
        const inStock = state.van.stock['generic-parts'] ?? 0;
        if (inStock < 1) throw new Error('Van is out of parts — restock before committing');
        state.van.stock['generic-parts'] = inStock - 1;
      }
      if (wMachine) {
        wMachine.status = 'repaired';
      }
    }
    const minutesSpent = job.minutesSpent ?? 0;
    const testsUsed = job.testsRun.length;
    const codex = codexAfterSettle();
    state.jobs.active = null;
    return {
      correct,
      fault,
      earned: 0,
      repDelta: 0,
      chosenFix: fixId,
      callback: false,
      callbackSource: null,
      unlockedTier: null,
      minutesSpent,
      testsUsed,
      cleanStreak: state.stats.cleanStreak,
      codex,
      isWorkshop: true,
      wMachineId: machineId,
    };
  }

  // Old saves' active jobs predate the callback field; undefined means fresh job.
  const callback = job.callback ?? null;
  const minutesSpent = job.minutesSpent ?? 0;
  const testsUsed = job.testsRun.length;
  const { earned, repDelta, unlockedTier, contract } = settleJob(state, fault, correct, job.clientId, {
    callback,
    minutesSpent,
    testsRun: job.testsRun,
    variant: job.variant ?? 0,
  });
  const codex = codexAfterSettle();
  state.jobs.active = null;
  return {
    correct,
    fault,
    earned,
    repDelta,
    chosenFix: fixId,
    callback: callback !== null,
    callbackSource: callback ? callback.source ?? 'player' : null,
    unlockedTier,
    minutesSpent,
    testsUsed,
    cleanStreak: state.stats.cleanStreak,
    codex,
    contract,
  };
}

/**
 * The wrong fix Multimeter Tier 3 rules out on the active job, or null when it
 * doesn't apply (below tier 3, MotD — the shared puzzle must stay tool-fair per
 * GDD §5 — or a fault with no wrong fixes). Deterministic per job (rule 6):
 * seeded on the job's identity, so a refresh never re-rolls which option the
 * meter eliminated. Buying the meter mid-job reveals the same option it would
 * have shown at the start.
 * @param {object} state game state
 * @param {object} job state.jobs.active
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {string|null} the eliminated fix id
 */
export function eliminatedFix(state, job, faults) {
  if ((state.tools.multimeterTier ?? 1) < 3) return null;
  if (job.motd) return null;
  const wrong = faults[job.faultId]?.wrongFixes;
  if (!Array.isArray(wrong) || wrong.length === 0) return null;
  const rng = mulberry32(`mm3:${job.faultId}:${job.clientId}:${job.startedAt ?? 0}`);
  return wrong[Math.floor(rng() * wrong.length)];
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
