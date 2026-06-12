/** @file All earning/spending math. Every number it uses comes from config/balance.js. */

import { JOBS, REPUTATION } from '../config/balance.js';

const DAY_MS = 24 * 60 * 60 * 1000; // time unit, not a tunable

/**
 * UTC date string ("YYYY-MM-DD") some days from now — callback due dates.
 * @param {number} days
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {string}
 */
export function utcDateStringAfter(days, now = Date.now()) {
  return new Date(now + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Settle a finished job: apply cash, lifetime earnings, reputation and stats.
 * Correct fix -> payout minus parts. Wrong fix -> callback: partial payout at
 * the configured multiplier, reputation hit, job queued to return (GDD §2.1).
 * No parts deduction on a wrong fix — the correct part was never fitted.
 * @param {object} state game state (mutated)
 * @param {object} fault the fault that was (or wasn't) fixed
 * @param {boolean} correct whether the committed fix was the correct one
 * @param {string} clientId for the callback queue entry
 * @returns {number} cash earned, for the invoice screen
 */
export function settleJob(state, fault, correct, clientId) {
  let earned;
  if (correct) {
    earned = fault.payout - fault.partsCost;
    state.player.reputation += REPUTATION.correctFix;
    state.stats.jobsCompleted += 1;
    state.stats.cleanStreak += 1;
  } else {
    earned = Math.round(fault.payout * JOBS.callbackPayoutMult);
    state.player.reputation -= REPUTATION.callbackPenalty;
    state.stats.callbacksCaused += 1;
    state.stats.cleanStreak = 0;
    state.jobs.callbacks.push({
      faultId: fault.id,
      clientId,
      dueDay: utcDateStringAfter(JOBS.callbackDueDays),
    });
  }
  state.player.cash += earned;
  state.player.lifetimeEarnings += earned;
  return earned;
}
