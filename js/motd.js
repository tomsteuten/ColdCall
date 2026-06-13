/** @file Machine of the Day: deterministic daily puzzle, streak tracking, share card.
 * MotD pays no cash and moves no reputation — it cannot compete with the active loop
 * (CLAUDE.md rule 5 is trivially satisfied).
 */

import { mulberry32 } from './rng.js';
import { utcDateStringAfter } from './economy.js';
import { MOTD } from '../config/balance.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * UTC date string "YYYY-MM-DD" for a given ms epoch (injectable for tests).
 * @param {number} [now] ms epoch; defaults to Date.now()
 * @returns {string}
 */
export function getTodayDateStr(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Pick the fault for a given UTC date string, deterministically.
 * Rendezvous hashing: every fault gets a score seeded on date + fault id, and
 * the highest score wins. Same date → same fault on every device, and adding
 * a fault to the library only changes the dates the NEW fault wins — it never
 * reshuffles puzzles between existing faults the way index-into-array did.
 * Draws from ALL faults (MotD is a standalone puzzle, not gated by tierUnlocked).
 * @param {Object<string, object>} faults fault library keyed by id
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {object} the selected fault
 */
export function pickMotdFault(faults, dateStr) {
  let best = null;
  let bestScore = -1;
  for (const fault of Object.values(faults)) {
    const score = mulberry32(`${dateStr}:${fault.id}`)();
    // Tie-break on id so the winner is deterministic even on equal scores.
    if (score > bestScore || (score === bestScore && fault.id < best.id)) {
      best = fault;
      bestScore = score;
    }
  }
  if (!best) throw new Error('Fault library is empty');
  return best;
}

/**
 * Whether the player can start today's MotD (hasn't played it yet today).
 * @param {object} state
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {boolean}
 */
export function canPlayToday(state, now = Date.now()) {
  return state.motd.lastPlayedDate !== getTodayDateStr(now);
}

/**
 * Settle a completed MotD run: update state.motd.* (no cash or rep touched).
 * Returns the result object for the UI.
 *
 * Streak rule:
 *   - Solved + yesterday was the last play AND that play was also solved → streak + 1
 *   - Solved + any other condition (skipped a day, or previous play failed) → 1
 *   - Failed → 0
 *
 * @param {object} state game state (mutated: state.motd)
 * @param {object} fault the MotD fault
 * @param {boolean} correct whether the committed fix was right
 * @param {string[]} testsRun test ids that were run
 * @param {number} startedAt ms epoch when the run began
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{ testsUsed: number, timeMs: number, solved: boolean, streak: number, fault: object }}
 */
export function settleMotd(state, fault, correct, testsRun, startedAt, now = Date.now()) {
  const todayStr = getTodayDateStr(now);
  const yesterdayStr = utcDateStringAfter(-1, now);

  const prevSolved =
    state.motd.lastPlayedDate === yesterdayStr && state.motd.lastResult?.solved === true;

  let streak;
  if (correct) {
    streak = prevSolved ? state.motd.streak + 1 : 1;
  } else {
    streak = 0;
  }

  const timeMs = now - startedAt;
  const testsUsed = testsRun.length;

  state.motd.lastPlayedDate = todayStr;
  state.motd.streak = streak;
  // faultId pins which puzzle this result belongs to — the result screen must
  // not change if a library update remaps the date's draw.
  state.motd.lastResult = { testsUsed, timeMs, solved: correct, faultId: fault.id };

  return { testsUsed, timeMs, solved: correct, streak, fault };
}

/**
 * Build the Wordle-style share card text blob (no external calls).
 * Format:
 *   Cold Call ☎️ Day <N> 🔥<streak>        (streak line omitted on failure)
 *   🔬🔬🔬✅  (one 🔬 per test run, then ✅ or ❌)
 *   https://tomsteuten.github.io/ColdCall
 *
 * @param {{ testsUsed: number, solved: boolean, streak: number }} result
 * @param {string} dateStr "YYYY-MM-DD" of the puzzle
 * @returns {string} the text blob
 */
export function buildShareCard(result, dateStr) {
  const epochMs = new Date(MOTD.epochDate).getTime();
  const dayMs = new Date(dateStr).getTime();
  const dayNumber = Math.floor((dayMs - epochMs) / DAY_MS) + 1;

  const header =
    result.solved
      ? `Cold Call ☎️ Day ${dayNumber} 🔥${result.streak}`
      : `Cold Call ☎️ Day ${dayNumber}`;

  const grid = '🔬'.repeat(result.testsUsed) + (result.solved ? '✅' : '❌');

  return `${header}\n${grid}\nhttps://tomsteuten.github.io/ColdCall`;
}
