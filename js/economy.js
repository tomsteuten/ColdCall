/** @file All earning/spending math. Every number it uses comes from config/balance.js. */

import { JOBS, REPUTATION, TOOLS } from '../config/balance.js';

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

/**
 * Tools for sale. Costs come from config/balance.js (rule 3); blurbs are the
 * shop copy. GDD §3.3: tools unlock test types, they don't just inflate numbers.
 * @type {Object<string, {name: string, blurb: string, cost: number, owned: function(object): boolean, apply: function(object): void}>}
 */
export const TOOL_CATALOGUE = {
  'multimeter-tier-2': {
    name: 'Multimeter Tier 2',
    blurb: 'A proper meter. Unlocks the continuity test on motors and sensors.',
    cost: TOOLS.multimeterTier2Cost,
    owned: (state) => state.tools.multimeterTier >= 2,
    apply: (state) => {
      state.tools.multimeterTier = 2;
    },
  },
};

/**
 * Buy a tool: spend cash, apply its effect. Refuses (without mutating) when
 * already owned or unaffordable — those are player situations, not bugs, so
 * the result carries a player-facing reason instead of throwing.
 * @param {object} state game state (mutated on success)
 * @param {string} toolId key in TOOL_CATALOGUE
 * @returns {{ok: boolean, reason: string|null}}
 */
export function buyTool(state, toolId) {
  const tool = TOOL_CATALOGUE[toolId];
  if (!tool) throw new Error(`Unknown tool id "${toolId}"`);
  if (tool.owned(state)) return { ok: false, reason: 'Already owned' };
  if (state.player.cash < tool.cost) return { ok: false, reason: 'Not enough cash' };
  state.player.cash -= tool.cost;
  tool.apply(state);
  return { ok: true, reason: null };
}
