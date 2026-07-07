/** @file Diagnosis information-design invariants over the real fault library (GDD §2.1, 2026-07-07).
 *
 * The failure mode these guard against: one test's result strings become de
 * facto verdicts, so running that single test names the culprit and the
 * deduction collapses (measured pre-fix: inspect-beater named it on 40 of 51
 * faults). The design counter is SHARED evidence strings — two faults on the
 * same machine that would genuinely present the same observation use the exact
 * same result string, so a result read in isolation stays ambiguous and the
 * discriminating information lives in the *combination* of tests and symptoms.
 *
 * A fault counts as "uniquely identified" by a test when any of its
 * presentations (base or symptom variant) produces a result string for that
 * test that no other fault on the same machine ever produces. Generic
 * "nothing unusual" fallbacks are shared by construction and never count.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TESTS, testLabel, testGeneric } from '../js/diagnosis.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'data/faults/index.json'), 'utf8'));
const files = index.files ?? index;
const faults = files.map((f) => JSON.parse(readFileSync(join(root, 'data/faults', f), 'utf8')));
const machines = JSON.parse(readFileSync(join(root, 'data/machines.json'), 'utf8')).machines;

const byMachine = {};
for (const f of faults) (byMachine[f.machineType] ??= []).push(f);

// Caps as a fraction of the machine's fault pool, rounded up. Ungated tests
// must stay ambiguous (~30%). The tier-2-gated continuity test is the paid-for
// decisive instrument — its dominance is bounded by the tool gate and its time
// cost, not by ambiguity — so it gets a looser cap (60%) purely to stop it
// drifting into a 100% one-test-answers-everything verdict table.
const UNGATED_CAP = 0.3;
const GATED_CAP = 0.6;

/** Every presentation's effective test-result table (base tests + variant overrides). */
function presentations(fault) {
  return [fault.tests, ...(fault.symptomVariants ?? []).map((v) => ({ ...fault.tests, ...(v.tests ?? {}) }))];
}

/** Fault ids in the pool uniquely identified by a single test's result strings. */
function uniquelyIdentified(pool, testId) {
  const owners = new Map(); // result string -> Set of fault ids that can show it
  for (const f of pool) {
    for (const p of presentations(f)) {
      const s = p[testId];
      if (s === undefined) continue; // generic fallback: shared by construction
      (owners.get(s) ?? owners.set(s, new Set()).get(s)).add(f.id);
    }
  }
  const unique = new Set();
  for (const who of owners.values()) if (who.size === 1) unique.add([...who][0]);
  return unique;
}

for (const [machineType, pool] of Object.entries(byMachine)) {
  for (const testId of Object.keys(TESTS)) {
    const gated = !!TESTS[testId].requiresMultimeterTier;
    const cap = Math.ceil((gated ? GATED_CAP : UNGATED_CAP) * pool.length);
    test(`${machineType}: ${testId} alone identifies at most ${cap} of ${pool.length} faults`, () => {
      const unique = uniquelyIdentified(pool, testId);
      assert(
        unique.size <= cap,
        `${testId} uniquely identifies ${unique.size} faults (cap ${cap}): ${[...unique].join(', ')}. ` +
          `Share the result string with another ${machineType} fault that would genuinely show the same evidence, ` +
          `or drop the entry so it falls back to the generic result.`
      );
    });
  }
}

test('no two faults on a machine present identical symptoms and identical evidence', () => {
  // Fairness guard: shared evidence is the point, but if EVERY test result AND
  // the symptom list match between two faults, the job is unsolvable — the
  // player has no information left that separates the two fixes.
  for (const [machineType, pool] of Object.entries(byMachine)) {
    const seen = new Map(); // full evidence vector -> fault id
    for (const f of pool) {
      const variants = [null, ...(f.symptomVariants ?? [])];
      for (const v of variants) {
        const tests = { ...f.tests, ...(v?.tests ?? {}) };
        const vector = JSON.stringify([
          v?.symptoms ?? f.symptoms,
          Object.keys(TESTS).map((t) => tests[t] ?? ''),
        ]);
        const prior = seen.get(vector);
        assert(
          !prior || prior === f.id,
          `${machineType}: "${f.id}" and "${prior}" present identical symptoms and test results — the player cannot tell them apart`
        );
        seen.set(vector, f.id);
      }
    }
  }
});

test('every machine has a physically sensible inspect label and generic', () => {
  // "Pull and inspect beater assembly" on an ice dispenser was how scope creep
  // started — the label defines what the test is allowed to see.
  for (const m of machines) {
    const label = testLabel('inspect-beater', m.id);
    const generic = testGeneric('inspect-beater', m.id);
    assert(label && generic, `${m.id}: inspect-beater needs a label and a generic`);
    if (m.id !== 'soft-serve-commercial') {
      assert(
        label !== testLabel('inspect-beater', 'soft-serve-commercial'),
        `${m.id}: inspect-beater label should be machine-specific, got the soft-serve default "${label}"`
      );
    }
  }
  assert(
    !testLabel('inspect-beater', 'commercial-ice-dispenser').toLowerCase().includes('beater'),
    'an ice dispenser has no beater to inspect'
  );
  // Default label/generic still apply to unknown machine types.
  assertEqual(testLabel('error-log', 'not-a-machine'), TESTS['error-log'].label);
  assertEqual(testGeneric('inspect-beater', 'not-a-machine'), TESTS['inspect-beater'].generic);
});

test('no fault result string leaks an instruction to fix ("replace the", "reset it")', () => {
  // Results are observations; the *player* concludes. A result that tells the
  // player what to do is a verdict regardless of how it's phrased.
  const verdictPhrases = [/that'll do it/i, /\breset it\b/i, /\breplace (the|it)\b/i, /\bn\/a\b/i];
  for (const f of faults) {
    for (const p of presentations(f)) {
      for (const [testId, result] of Object.entries(p)) {
        for (const phrase of verdictPhrases) {
          assert(
            !phrase.test(result),
            `${f.id} ${testId}: "${result}" reads as a verdict/instruction (${phrase})`
          );
        }
      }
    }
  }
});
