/** @file Tests for rng.js: determinism, seed independence, string seeding, randInt bounds. */

import { mulberry32, hashSeed, randInt } from '../js/rng.js';

test('same numeric seed produces identical sequences', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 100; i++) {
    const x = a();
    const y = b();
    assert(x === y, `sequences diverged at draw ${i}: ${x} vs ${y}`);
  }
});

test('different seeds produce different sequences', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let allSame = true;
  for (let i = 0; i < 10; i++) {
    if (a() !== b()) allSame = false;
  }
  assert(!allSame, 'seeds 1 and 2 should not produce identical first 10 draws');
});

test('string seeds (UTC date) are deterministic and distinct per day', () => {
  const a = mulberry32('2026-06-12');
  const b = mulberry32('2026-06-12');
  assert(a() === b() && a() === b(), 'same date string must reproduce');

  assert(hashSeed('2026-06-12') !== hashSeed('2026-06-13'), 'adjacent dates should hash differently');
});

test('output stays in [0, 1)', () => {
  const next = mulberry32(987654321);
  for (let i = 0; i < 1000; i++) {
    const v = next();
    assert(v >= 0 && v < 1, `draw ${i} out of range: ${v}`);
  }
});

test('randInt respects inclusive bounds and is deterministic', () => {
  const next = mulberry32('bounds-test');
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = randInt(next, 3, 7);
    assert(v >= 3 && v <= 7 && Number.isInteger(v), `randInt out of bounds: ${v}`);
    seen.add(v);
  }
  assert(seen.size === 5, `expected all of 3..7 to appear over 500 draws, saw ${[...seen]}`);

  const again = mulberry32('bounds-test');
  assert(randInt(again, 3, 7) === randInt(mulberry32('bounds-test'), 3, 7), 'randInt must reproduce from same seed');
});
