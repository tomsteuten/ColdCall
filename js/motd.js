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
 * Human countdown to the next puzzle (UTC midnight): "5h 12m", or "43m" inside
 * the last hour. Computed at render, never ticked — a stale label re-renders on
 * the next interaction, which is exactly the fidelity a daily puzzle needs.
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {string}
 */
export function nextPuzzleCountdown(now = Date.now()) {
  const nextMidnight = Date.parse(getTodayDateStr(now) + 'T00:00:00Z') + DAY_MS;
  const mins = Math.max(1, Math.ceil((nextMidnight - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The streak that dies at UTC midnight if the player skips today's puzzle:
 * non-zero only when there IS a live streak (yesterday's puzzle was played and
 * solved) and today's is still unplayed. Played-today or an already-broken
 * streak (last play before yesterday) returns 0 — nothing is at risk.
 * @param {object} state
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {number} the at-risk streak length, or 0
 */
export function streakAtRisk(state, now = Date.now()) {
  if (!canPlayToday(state, now)) return 0;
  if (!(state.motd.streak > 0)) return 0;
  const yesterdayStr = utcDateStringAfter(-1, now);
  if (state.motd.lastPlayedDate !== yesterdayStr) return 0;
  return state.motd.lastResult?.solved === true ? state.motd.streak : 0;
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
 * @param {number} simMinutes simulated diagnostic minutes the run accumulated (the
 *   tie-breaker score). This is the interruption-safe replacement for wall-clock time:
 *   only the player's own test choices advance it, so phone calls, sleep, refreshes,
 *   and accessibility pauses can never worsen a shared-puzzle result (GDD §5).
 * @param {number} [now] ms epoch, injectable for tests (used only to derive the
 *   puzzle date when none is pinned — never to score the run)
 * @param {string|null} [puzzleDateStr] UTC date the puzzle was started on ("YYYY-MM-DD");
 *   if provided, used as the canonical puzzle date instead of re-deriving from `now`.
 *   This prevents a UTC-midnight crossing between start and settle from attributing
 *   the result to the wrong day's puzzle.
 * @returns {{ testsUsed: number, simMinutes: number, solved: boolean, streak: number, fault: object, puzzleDateStr: string }}
 */
export function settleMotd(state, fault, correct, testsRun, simMinutes, now = Date.now(), puzzleDateStr = null) {
  // Use the stored puzzle date if provided (avoids UTC-midnight mismatch).
  const todayStr = puzzleDateStr ?? getTodayDateStr(now);
  const yesterdayStr = utcDateStringAfter(-1, new Date(todayStr + 'T12:00:00Z').getTime());

  const prevSolved =
    state.motd.lastPlayedDate === yesterdayStr && state.motd.lastResult?.solved === true;

  let streak;
  if (correct) {
    streak = prevSolved ? state.motd.streak + 1 : 1;
  } else {
    streak = 0;
  }

  const testsUsed = testsRun.length;

  state.motd.lastPlayedDate = todayStr;
  state.motd.streak = streak;
  // faultId pins which puzzle this result belongs to — the result screen must
  // not change if a library update remaps the date's draw.
  // puzzleDateStr is stored so share/result screens use the start-day date, not settlement time.
  // simMinutes (not wall time) is the stored secondary score — interruption-safe.
  state.motd.lastResult = { testsUsed, simMinutes, solved: correct, faultId: fault.id, puzzleDateStr: todayStr };

  return { testsUsed, simMinutes, solved: correct, streak, fault, puzzleDateStr: todayStr };
}

/**
 * Build the Wordle-style share card text blob (no external calls).
 * Format:
 *   Cold Call ☎️ Day <N> 🔥<streak>        (streak line omitted on failure)
 *   🔬🔬🔬✅ · 12 min  (one 🔬 per test run, then ✅ or ❌, then the simulated minutes)
 *   🧹 N clean  OR  ⚠️ N callbacks waiting   (optional stats line)
 *   https://tomsteuten.github.io/ColdCall
 *
 * The score is tests used (the emoji grid) first, simulated diagnostic minutes
 * second — never wall-clock time, so a shared result is fair across interruptions
 * (GDD §5). The " · N min" suffix is omitted for legacy results that predate
 * simMinutes (older saves only stored wall time, which is no longer shown).
 *
 * @param {{ testsUsed: number, solved: boolean, streak: number, simMinutes?: number }} result
 * @param {string} dateStr "YYYY-MM-DD" of the puzzle
 * @param {{ cleanStreak?: number, callbackCount?: number }} [stats] optional player stats for the shame/clean flourish
 * @returns {string} the text blob
 */
export function buildShareCard(result, dateStr, { cleanStreak = 0, callbackCount = 0 } = {}) {
  const epochMs = new Date(MOTD.epochDate).getTime();
  const dayMs = new Date(dateStr).getTime();
  const dayNumber = Math.floor((dayMs - epochMs) / DAY_MS) + 1;

  const header =
    result.solved
      ? `Cold Call ☎️ Day ${dayNumber} 🔥${result.streak}`
      : `Cold Call ☎️ Day ${dayNumber}`;

  const minutesSuffix =
    typeof result.simMinutes === 'number' && Number.isFinite(result.simMinutes)
      ? ` · ${result.simMinutes} min`
      : '';
  // Clamp: a weird-but-numeric testsUsed from an imported save must not throw
  // (negative) or build a megabyte string (huge) inside String.repeat.
  const gridTests = Math.max(0, Math.min(50, Math.trunc(result.testsUsed) || 0));
  const grid = '🔬'.repeat(gridTests) + (result.solved ? '✅' : '❌') + minutesSuffix;

  // Stats flourish: clean streak wins over callback shame if both are somehow true.
  let statsLine = '';
  if (cleanStreak >= 1) {
    statsLine = `\n🧹 ${cleanStreak} clean`;
  } else if (callbackCount > 0) {
    statsLine = `\n⚠️ ${callbackCount} callback${callbackCount !== 1 ? 's' : ''} waiting`;
  }

  return `${header}\n${grid}${statsLine}\nhttps://tomsteuten.github.io/ColdCall`;
}
