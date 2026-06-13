/** @file Fault library loader + validator (CLAUDE.md rule 4). Faults are data; bad data gets a clear console error naming file and field. */

import { TESTS } from './diagnosis.js';

/**
 * Validate one parsed fault object against data/faults/SCHEMA.md.
 * Pure: returns an array of human-readable error strings, each naming the
 * offending field. Empty array means the fault is valid.
 * @param {object} fault parsed fault JSON
 * @param {string} fileName e.g. "worn-scraper-blades.json"
 * @param {string[]|null} [machineTypeIds] known machine ids; skip the check when null
 * @returns {string[]} errors
 */
export function validateFault(fault, fileName, machineTypeIds = null) {
  const errors = [];
  if (typeof fault !== 'object' || fault === null || Array.isArray(fault)) {
    return [`file does not contain a fault object`];
  }

  // Rule 1: required fields present and of the right type.
  if (typeof fault.id !== 'string' || fault.id === '') {
    errors.push(`field "id" must be a non-empty string`);
  }
  if (typeof fault.machineType !== 'string' || fault.machineType === '') {
    errors.push(`field "machineType" must be a non-empty string`);
  } else if (machineTypeIds && !machineTypeIds.includes(fault.machineType)) {
    errors.push(`field "machineType" is "${fault.machineType}", not a machine id in data/machines.json`);
  }
  if (typeof fault.tier !== 'number' || fault.tier < 1 || fault.tier > 5) {
    errors.push(`field "tier" must be a number 1-5`);
  }
  if (
    !Array.isArray(fault.symptoms) ||
    fault.symptoms.length < 1 ||
    fault.symptoms.length > 4 ||
    !fault.symptoms.every((s) => typeof s === 'string' && s !== '')
  ) {
    errors.push(`field "symptoms" must be an array of 1-4 non-empty strings`);
  }
  if (typeof fault.tests !== 'object' || fault.tests === null || Array.isArray(fault.tests)) {
    errors.push(`field "tests" must be an object mapping test id to result string`);
  } else {
    // Rule 4: every key in tests is a known test id.
    for (const [testId, result] of Object.entries(fault.tests)) {
      if (!(testId in TESTS)) {
        errors.push(`field "tests" has unknown test id "${testId}" (known: ${Object.keys(TESTS).join(', ')})`);
      }
      if (typeof result !== 'string' || result === '') {
        errors.push(`field "tests.${testId}" must be a non-empty string`);
      }
    }
  }
  if (typeof fault.correctFix !== 'string' || fault.correctFix === '') {
    errors.push(`field "correctFix" must be a non-empty string`);
  }
  // Rule 3: wrongFixes non-empty, no correctFix among them.
  if (
    !Array.isArray(fault.wrongFixes) ||
    fault.wrongFixes.length < 1 ||
    fault.wrongFixes.length > 4 ||
    !fault.wrongFixes.every((f) => typeof f === 'string' && f !== '')
  ) {
    errors.push(`field "wrongFixes" must be an array of 1-4 non-empty strings`);
  } else if (fault.wrongFixes.includes(fault.correctFix)) {
    errors.push(`field "wrongFixes" must not contain the correctFix ("${fault.correctFix}")`);
  }
  // Rule 5: payout positive, partsCost >= 0.
  if (typeof fault.payout !== 'number' || fault.payout <= 0) {
    errors.push(`field "payout" must be a positive number`);
  }
  if (typeof fault.partsCost !== 'number' || fault.partsCost < 0) {
    errors.push(`field "partsCost" must be a number >= 0`);
  }
  if (typeof fault.flavour !== 'string' || fault.flavour === '') {
    errors.push(`field "flavour" must be a non-empty string`);
  }
  // Player-facing diagnostic reasoning shown on a failure receipt (GDD §2.1).
  if (typeof fault.lesson !== 'string' || fault.lesson === '') {
    errors.push(`field "lesson" must be a non-empty string`);
  }
  if ('authenticityNote' in fault && typeof fault.authenticityNote !== 'string') {
    errors.push(`field "authenticityNote" must be a string when present`);
  }

  // Rule 2: id matches filename.
  const expectedId = fileName.replace(/\.json$/, '');
  if (typeof fault.id === 'string' && fault.id !== expectedId) {
    errors.push(`field "id" is "${fault.id}" but filename says "${expectedId}"`);
  }

  return errors;
}

/**
 * Load and validate the whole fault library plus machines and clients.
 * Static hosting can't list directories, so data/faults/index.json is the
 * manifest of fault filenames — new faults must be added there.
 * Invalid faults are reported via console.error and excluded, never fatal.
 * @param {string} [base] base URL for data files
 * @param {typeof fetch} [fetchFn] injectable for tests
 * @returns {Promise<{faults: Object<string, object>, machines: object[], clients: object[]}>}
 */
export async function loadGameData(base = 'data/', fetchFn = fetch) {
  const getJson = async (path) => (await fetchFn(base + path)).json();

  const [index, machinesDoc, clientsDoc] = await Promise.all([
    getJson('faults/index.json'),
    getJson('machines.json'),
    getJson('clients.json'),
  ]);
  const machines = machinesDoc.machines;
  const clients = clientsDoc.clients;
  const machineTypeIds = machines.map((m) => m.id);

  const faults = {};
  for (const fileName of index) {
    let fault;
    try {
      fault = await getJson(`faults/${fileName}`);
    } catch (e) {
      console.error(`Cold Call: data/faults/${fileName}: could not load or parse (${e.message})`);
      continue;
    }
    const errors = validateFault(fault, fileName, machineTypeIds);
    if (errors.length > 0) {
      for (const err of errors) console.error(`Cold Call: data/faults/${fileName}: ${err}`);
      continue;
    }
    faults[fault.id] = fault;
  }
  return { faults, machines, clients };
}
