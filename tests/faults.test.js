/** @file Fault validator tests: good fixture passes, bad fixtures fail naming the right field, real library is clean. */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateFault, loadGameData } from '../js/faults.js';
import { JOBS } from '../config/balance.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A known-good fault; bad fixtures are made by breaking one field at a time. */
function goodFault() {
  return {
    id: 'door-o-ring-gone',
    machineType: 'soft-serve-commercial',
    tier: 2,
    symptoms: ['Mix leaking from the dispense door.'],
    tests: { 'inspect-beater': 'Door O-ring is flattened and cracked.' },
    correctFix: 'replace-door-o-ring',
    wrongFixes: ['replace-dispense-door', 'replace-barrel-seal'],
    payout: 90,
    partsCost: 10,
    flavour: 'Sealed the deal for the price of a rubber band.',
    lesson: 'A leak at the dispense door is almost always the O-ring, never the door or barrel seal.',
  };
}
const FILE = 'door-o-ring-gone.json';
const MACHINES = ['soft-serve-commercial'];

test('good fault passes validation', () => {
  assertEqual(validateFault(goodFault(), FILE, MACHINES), []);
});

test('missing required field is named', () => {
  const f = goodFault();
  delete f.payout;
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.length === 1, `expected 1 error, got: ${errors.join(' | ')}`);
  assert(errors[0].includes('"payout"'), `error should name "payout": ${errors[0]}`);
});

test('id not matching filename is named', () => {
  const errors = validateFault(goodFault(), 'something-else.json', MACHINES);
  assert(errors.some((e) => e.includes('"id"') && e.includes('something-else')), errors.join(' | '));
});

test('unknown machineType is named', () => {
  const f = goodFault();
  f.machineType = 'espresso-machine';
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.some((e) => e.includes('"machineType"') && e.includes('espresso-machine')), errors.join(' | '));
});

test('unknown test id is named', () => {
  const f = goodFault();
  f.tests['x-ray-vision'] = 'You see everything.';
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.some((e) => e.includes('"tests"') && e.includes('x-ray-vision')), errors.join(' | '));
});

test('correctFix appearing in wrongFixes is named', () => {
  const f = goodFault();
  f.wrongFixes.push(f.correctFix);
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.some((e) => e.includes('"wrongFixes"') && e.includes('correctFix')), errors.join(' | '));
});

test('empty wrongFixes is named', () => {
  const f = goodFault();
  f.wrongFixes = [];
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.some((e) => e.includes('"wrongFixes"')), errors.join(' | '));
});

test('non-positive payout and negative partsCost are named', () => {
  const f = goodFault();
  f.payout = 0;
  f.partsCost = -5;
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.some((e) => e.includes('"payout"')), errors.join(' | '));
  assert(errors.some((e) => e.includes('"partsCost"')), errors.join(' | '));
});

test('missing lesson is named (failure-receipt copy is required)', () => {
  const f = goodFault();
  delete f.lesson;
  const errors = validateFault(f, FILE, MACHINES);
  assert(errors.some((e) => e.includes('"lesson"')), errors.join(' | '));
});

test('non-object input fails without throwing', () => {
  assert(validateFault(null, FILE, MACHINES).length > 0, 'null should fail');
  assert(validateFault([], FILE, MACHINES).length > 0, 'array should fail');
});

test('every real fault file validates clean and is in the index', () => {
  const machineIds = JSON.parse(readFileSync(join(root, 'data/machines.json'), 'utf8')).machines.map((m) => m.id);
  const index = JSON.parse(readFileSync(join(root, 'data/faults/index.json'), 'utf8'));
  const files = readdirSync(join(root, 'data/faults')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  for (const file of files) {
    assert(index.includes(file), `${file} missing from data/faults/index.json`);
    const fault = JSON.parse(readFileSync(join(root, 'data/faults', file), 'utf8'));
    const errors = validateFault(fault, file, machineIds);
    assertEqual(errors, [], `${file} should validate clean`);
  }
  assertEqual(index.length, files.length, 'index lists a file that does not exist');
});

test('every real fault is profitable to fix, fresh and as a callback', () => {
  // Economy invariant (review finding): a correct fix must never lose money.
  // Fresh net = payout - partsCost; callback net = round(net * callbackJobPayoutMult).
  const index = JSON.parse(readFileSync(join(root, 'data/faults/index.json'), 'utf8'));
  for (const file of index) {
    const fault = JSON.parse(readFileSync(join(root, 'data/faults', file), 'utf8'));
    const net = fault.payout - fault.partsCost;
    assert(net > 0, `${file}: fresh net $${net} must be > 0 (payout ${fault.payout}, parts ${fault.partsCost})`);
    const callbackNet = Math.round(net * JOBS.callbackJobPayoutMult);
    assert(callbackNet > 0, `${file}: correct callback fix earns $${callbackNet}, must be > 0`);
  }
});

test('every fault payout and partsCost sits within its tier range in balance.js', () => {
  // SCHEMA.md: payout "stays within the tier's range in config/balance.js".
  // partsCost 0 is always allowed (procedure-only fixes); otherwise in range.
  const index = JSON.parse(readFileSync(join(root, 'data/faults/index.json'), 'utf8'));
  for (const file of index) {
    const fault = JSON.parse(readFileSync(join(root, 'data/faults', file), 'utf8'));
    const range = JOBS[`tier${fault.tier}`];
    assert(range, `${file}: no JOBS.tier${fault.tier} range in config/balance.js`);
    assert(
      fault.payout >= range.payoutMin && fault.payout <= range.payoutMax,
      `${file}: payout ${fault.payout} outside tier ${fault.tier} range ${range.payoutMin}-${range.payoutMax}`
    );
    assert(
      fault.partsCost === 0 ||
        (fault.partsCost >= range.partsCostMin && fault.partsCost <= range.partsCostMax),
      `${file}: partsCost ${fault.partsCost} outside tier ${fault.tier} range ${range.partsCostMin}-${range.partsCostMax} (or 0)`
    );
  }
});

test('loadGameData excludes a bad fault and console.errors the file and field', async () => {
  const badFault = goodFault();
  delete badFault.flavour;
  const responses = {
    'data/faults/index.json': ['door-o-ring-gone.json'],
    'data/machines.json': { machines: [{ id: 'soft-serve-commercial', name: 'X', tier: 2 }] },
    'data/clients.json': { clients: [] },
    'data/faults/door-o-ring-gone.json': badFault,
  };
  const fakeFetch = async (url) => ({ json: async () => responses[url] });
  const logged = [];
  const realError = console.error;
  console.error = (msg) => logged.push(String(msg));
  try {
    const { faults } = await loadGameData('data/', fakeFetch);
    assertEqual(Object.keys(faults), [], 'bad fault should be excluded');
  } finally {
    console.error = realError;
  }
  assert(
    logged.some((m) => m.includes('door-o-ring-gone.json') && m.includes('"flavour"')),
    `console.error should name file and field, got: ${logged.join(' | ')}`
  );
});

// --- symptomVariants validation (2026-07-04, SCHEMA.md rule 6) ---

function goodVariantFault() {
  const f = goodFault();
  f.symptomVariants = [
    {
      symptoms: ['Drip tray full of mix by lunchtime.'],
      tests: { 'inspect-beater': 'O-ring flattened to a ribbon.' },
    },
    { symptoms: ['Slow weep of mix from the door seam.'] },
  ];
  return f;
}

test('a fault with well-formed symptomVariants passes validation', () => {
  assertEqual(validateFault(goodVariantFault(), FILE, MACHINES), []);
});

test('symptomVariants must be an array of 1-3 objects', () => {
  const notArray = goodVariantFault();
  notArray.symptomVariants = { symptoms: ['x'] };
  assert(
    validateFault(notArray, FILE, MACHINES).some((e) => e.includes('"symptomVariants"')),
    'non-array should be named'
  );
  const tooMany = goodVariantFault();
  tooMany.symptomVariants = Array.from({ length: 4 }, () => ({ symptoms: ['x'] }));
  assert(
    validateFault(tooMany, FILE, MACHINES).some((e) => e.includes('"symptomVariants"')),
    'more than 3 variants should be named'
  );
});

test('a variant with bad symptoms is named with its index', () => {
  const f = goodVariantFault();
  f.symptomVariants[1].symptoms = [];
  const errors = validateFault(f, FILE, MACHINES);
  assert(
    errors.some((e) => e.includes('"symptomVariants[1].symptoms"')),
    `should name the variant index: ${errors.join(' | ')}`
  );
});

test('a variant test override with an unknown test id is named', () => {
  const f = goodVariantFault();
  f.symptomVariants[0].tests['x-ray-vision'] = 'You see everything.';
  const errors = validateFault(f, FILE, MACHINES);
  assert(
    errors.some((e) => e.includes('symptomVariants[0].tests') && e.includes('x-ray-vision')),
    `should name the variant tests path: ${errors.join(' | ')}`
  );
});

test('at least 15 tier 1-2 faults ship symptom variants (the memorisation fix)', () => {
  // Phase-1 content bar (2026-07-04): the deduction puzzle stays fresh only if
  // the common faults rotate presentations. Guards against variant regressions.
  const index = JSON.parse(readFileSync(join(root, 'data/faults/index.json'), 'utf8'));
  let withVariants = 0;
  for (const file of index) {
    const fault = JSON.parse(readFileSync(join(root, 'data/faults', file), 'utf8'));
    if (fault.tier <= 2 && Array.isArray(fault.symptomVariants) && fault.symptomVariants.length >= 2) {
      withVariants++;
    }
  }
  assert(withVariants >= 15, `expected >= 15 tier 1-2 faults with 2+ variants, found ${withVariants}`);
});

test('the Tier 2 variety pass keeps two alternate presentations on its frequent faults', () => {
  const ids = [
    'barrel-freeze-up', 'heat-treat-sensor-fault', 'mix-level-sensor-failed',
    'dispense-valve-weeping', 'condenser-fan-seized', 'draw-valve-microswitch-fault',
    'air-injector-blocked', 'rear-shaft-seal-leaking', 'compressor-start-relay-failed',
    'expansion-valve-iced', 'heat-exchanger-scaled', 'display-controller-failed',
  ];
  for (const id of ids) {
    const fault = JSON.parse(readFileSync(join(root, 'data/faults', `${id}.json`), 'utf8'));
    assertEqual(fault.symptomVariants?.length, 2, `${id} should retain two alternative presentations`);
  }
});
