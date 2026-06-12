/** @file Seedable PRNG (mulberry32). Use for anything that must reproduce, e.g. Machine of the Day. */

/**
 * Hash a string to a 32-bit unsigned seed (xmur3 finaliser, one round).
 * Lets a UTC date string like "2026-06-12" seed the daily puzzle.
 * @param {string} str
 * @returns {number} 32-bit unsigned int
 */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * mulberry32: tiny, fast, good-enough PRNG. Same seed -> same sequence, everywhere.
 * @param {number|string} seed number, or string (hashed via hashSeed)
 * @returns {function(): number} next() in [0, 1)
 */
export function mulberry32(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random integer in [min, max] inclusive, from a mulberry32 next() function.
 * @param {function(): number} next
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randInt(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}
