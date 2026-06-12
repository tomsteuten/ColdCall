/** @file Tiny test runner: imports every *.test.js in this folder, reports pass/fail, exits non-zero on failure. */

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith('.test.js')).sort();

let passed = 0;
let failed = 0;

/** Tests are queued at import time and run after, so async tests can be awaited. */
const queue = [];
globalThis.test = function test(name, fn) {
  queue.push({ name, fn });
};

/** Run one named assertion block (sync or async); catches throws/rejections and reports them. */
async function runOne({ name, fn }) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${e && e.message ? e.message : e}`);
  }
}

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
  for (const t of queue) await runOne(t);
  queue.length = 0;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
