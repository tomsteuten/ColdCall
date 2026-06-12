/** @file Tiny test runner: imports every *.test.js in this folder, reports pass/fail, exits non-zero on failure. */

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith('.test.js')).sort();

let passed = 0;
let failed = 0;

/** Run one named assertion block; catches throws and reports them. */
globalThis.test = function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${e && e.message ? e.message : e}`);
  }
};

/** Minimal assert: throws with a useful message when condition is falsy. */
globalThis.assert = function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
};

/** Deep-equal via JSON — fine for plain serialisable game state. */
globalThis.assertEqual = function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || 'not equal'}\n       actual:   ${a}\n       expected: ${b}`);
};

for (const file of files) {
  console.log(`\n${file}`);
  await import(pathToFileURL(join(here, file)).href);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
