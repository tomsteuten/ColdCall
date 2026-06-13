/** @file All earning/spending math. Every number it uses comes from config/balance.js. */

import { JOBS, REPUTATION, TOOLS, TECHS, DIAGNOSIS } from '../config/balance.js';

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
 * The diagnosis speed bonus in whole dollars for the simulated minutes a job
 * spent on tests (GDD §2.1). Starts at DIAGNOSIS.speedBonusMax on a blind commit
 * and decays linearly, floored at 0 — so being thorough is safe (never below
 * base payout) and being sharp is rewarded. Pure; used by settleJob and the UI.
 * @param {number} minutesSpent simulated minutes the active job accumulated
 * @returns {number} bonus dollars, always >= 0
 */
export function speedBonus(minutesSpent) {
  return Math.max(
    0,
    Math.round(DIAGNOSIS.speedBonusMax - minutesSpent * DIAGNOSIS.bonusDecayPerMin)
  );
}

/**
 * Settle a finished job: apply cash, lifetime earnings, reputation and stats.
 *
 * Fresh job — correct: payout minus parts, plus a speed bonus that decays with
 * the simulated minutes spent on tests (GDD §2.1). Wrong: partial payout at
 * wrongFixPayoutMult, reputation hit, job queued to return (GDD §2.1).
 * No parts deduction on a wrong fix — the correct part was never fitted.
 *
 * Callback job (opts.callback set) — correct: a source-dependent rate applied to
 * the job's NET (payout minus parts), so a correct rescue can never lose money
 * however expensive the part. A player-caused obligation pays callbackJobPayoutMult
 * (GDD §6's 40%); a tech-caused rescue pays the higher rescueCallbackPayoutMult
 * (GDD §3.1, kept < 1.0 so it never beats a fresh ticket). Clean streak does NOT
 * advance, a rescue isn't a clean job. Wrong again: $0 (the partial was already
 * paid once), a dampened reputation hit, and the job re-queues — keeping its
 * source — for tomorrow.
 *
 * @param {object} state game state (mutated)
 * @param {object} fault the fault that was (or wasn't) fixed
 * @param {boolean} correct whether the committed fix was the correct one
 * @param {string} clientId for the callback queue entry
 * @param {{callback?: {misses: number, source?: string}|null, minutesSpent?: number, now?: number}} [opts]
 *   callback context (source defaults to 'player' — the conservative lower rate),
 *   simulated minutes spent from the active job, and an injectable clock for tests
 * @returns {{earned: number, unlockedTier: number|null}} for the invoice screen
 */
export function settleJob(state, fault, correct, clientId, opts = {}) {
  const { callback = null, minutesSpent = 0, now = Date.now() } = opts;
  // A callback with no source predates the split (old in-flight job) — treat it
  // as a player obligation, the lower rate, so the change never over-pays.
  const source = callback ? callback.source ?? 'player' : 'player';
  let earned;
  if (correct) {
    if (fault.partsCost > 0) {
      const inStock = state.van.stock['generic-parts'] ?? 0;
      if (inStock < 1) throw new Error('Van is out of parts — restock before committing');
      state.van.stock['generic-parts'] = inStock - 1;
    }
    const net = fault.payout - fault.partsCost;
    // No speed bonus on a rescue — callbacks are already discounted (GDD §2.1).
    const callbackMult =
      source === 'tech' ? JOBS.rescueCallbackPayoutMult : JOBS.callbackJobPayoutMult;
    earned = callback ? Math.round(net * callbackMult) : net + speedBonus(minutesSpent);
    state.player.reputation += REPUTATION.correctFix;
    state.stats.jobsCompleted += 1;
    if (!callback) state.stats.cleanStreak += 1;
  } else {
    earned = callback ? 0 : Math.round(fault.payout * JOBS.wrongFixPayoutMult);
    state.player.reputation -= callback
      ? REPUTATION.repeatCallbackPenalty
      : REPUTATION.callbackPenalty;
    state.stats.callbacksCaused += 1;
    state.stats.cleanStreak = 0;
    state.jobs.callbacks.push({
      faultId: fault.id,
      clientId,
      dueDay: utcDateStringAfter(JOBS.callbackDueDays, now),
      expiryDay: utcDateStringAfter(JOBS.callbackDueDays + JOBS.callbackExpiryDays, now),
      misses: callback ? callback.misses + 1 : 1,
      // A botched rescue stays a rescue; a fresh miss is the player's obligation.
      source: callback ? source : 'player',
    });
  }
  state.player.cash += earned;
  state.player.lifetimeEarnings += earned;
  return { earned, unlockedTier: checkTierUnlock(state) };
}

/**
 * Unlock the next client tier if reputation has reached its balance.js
 * threshold. One tier per call is plenty — thresholds are minutes apart.
 * @param {object} state game state (mutated on unlock)
 * @returns {number|null} the tier just unlocked, or null
 */
function checkTierUnlock(state) {
  const next = state.player.tierUnlocked + 1;
  const threshold = REPUTATION.tierThresholds[next];
  if (threshold !== undefined && state.player.reputation >= threshold) {
    state.player.tierUnlocked = next;
    return next;
  }
  return null;
}

/**
 * Callbacks that have come due: dueDay is today (UTC) or earlier.
 * Pure — the home screen uses it for the "callbacks waiting" count.
 * @param {object} state
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {object[]} due entries from state.jobs.callbacks
 */
export function dueCallbacks(state, now = Date.now()) {
  const today = utcDateStringAfter(0, now);
  return state.jobs.callbacks.filter((cb) => cb.dueDay <= today);
}

/**
 * Claim a specific callback the player chose from the Callbacks list, removing
 * it from the queue (GDD §3.1: claiming is a choice, never auto-claimed). The
 * index is into state.jobs.callbacks — the UI passes the position of the row it
 * rendered. Refuses an out-of-range or not-yet-due index (returns null without
 * mutating). An entry whose fault has left the library is dropped with a console
 * error and null returned — same convention main.js uses for a stranded active
 * job. The caller starts the job from the returned entry; if the player then
 * refreshes, the callback context lives on state.jobs.active, so nothing is lost.
 * @param {object} state game state (mutated: queue entry removed on success)
 * @param {Object<string, object>} faults fault library keyed by id
 * @param {number} index position in state.jobs.callbacks to claim
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{faultId: string, clientId: string, dueDay: string, expiryDay: string, misses: number, source: string}|null}
 */
export function claimCallback(state, faults, index, now = Date.now()) {
  const today = utcDateStringAfter(0, now);
  const cb = state.jobs.callbacks[index];
  if (!cb || cb.dueDay > today) return null; // out of range or not yet due
  state.jobs.callbacks.splice(index, 1);
  if (!faults[cb.faultId]) {
    console.error(`Cold Call: callback references unknown fault "${cb.faultId}"; dropping it.`);
    return null;
  }
  return cb;
}

/**
 * Remove callbacks that have passed their expiry day, computed deterministically
 * on load like offline progress (GDD §3.1). Player-caused obligations expiring
 * cost reputation (you abandoned a client you owe); tech-caused rescues expire
 * silently — they were optional bonus pay, never a debt. Entries with no
 * expiryDay (shouldn't occur post-migration) are left alone.
 * @param {object} state game state (mutated: expired entries removed, rep docked)
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{count: number, playerExpired: number, techExpired: number, repPenalty: number}|null}
 *   null when nothing expired — nothing to report on the welcome-back banner
 */
export function expireCallbacks(state, now = Date.now()) {
  const today = utcDateStringAfter(0, now);
  const isExpired = (cb) => typeof cb.expiryDay === 'string' && cb.expiryDay < today;
  const expired = state.jobs.callbacks.filter(isExpired);
  if (expired.length === 0) return null;
  state.jobs.callbacks = state.jobs.callbacks.filter((cb) => !isExpired(cb));
  const playerExpired = expired.filter((cb) => cb.source !== 'tech').length;
  const techExpired = expired.length - playerExpired;
  const repPenalty = playerExpired * REPUTATION.expiredCallbackRepPenalty;
  state.player.reputation -= repPenalty;
  return { count: expired.length, playerExpired, techExpired, repPenalty };
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
 * Restock the van to full capacity. Refuses when already full.
 * Free at launch: van stock is availability, not a second parts bill — the
 * part's price is charged per job via fault.partsCost (GDD §6), so charging
 * here too would bill the player twice for the same part. The GDD §2.3
 * supplier-run time cost / express markup is a v1.x lever.
 * @param {object} state game state (mutated on success)
 * @returns {{ok: boolean, reason: string|null}}
 */
export function restockVan(state) {
  const current = state.van.stock['generic-parts'] ?? 0;
  if (current >= state.van.slots) return { ok: false, reason: 'Van already full' };
  state.van.stock['generic-parts'] = state.van.slots;
  return { ok: true, reason: null };
}

// The single contract route available at launch (GDD §9 v1.0: one route).
const BURGERTOWN_ROUTE = { id: 'burgertown-south', clientId: 'burgertown-high-st' };
const TECH_NAMES = ['Dave', 'Mike'];

/**
 * Hire a tech. Deducts the hire cost, creates the tech, and if tier 2 is
 * unlocked creates (or reuses) the Burgertown route and assigns the tech to it.
 * Refuses if unaffordable, already at max techs, or tier 2 not yet unlocked.
 * @param {object} state game state (mutated on success)
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{ok: boolean, reason: string|null}}
 */
export function hireTech(state, now = Date.now()) {
  if (state.techs.length >= TECHS.maxTechs) return { ok: false, reason: 'Max techs already hired' };
  if (state.player.cash < TECHS.firstHireCost) return { ok: false, reason: 'Not enough cash' };
  if (state.player.tierUnlocked < 2) return { ok: false, reason: 'Unlock Tier 2 first' };

  state.player.cash -= TECHS.firstHireCost;

  // Ensure the contract route exists.
  if (!state.routes.find((r) => r.id === BURGERTOWN_ROUTE.id)) {
    state.routes.push({ ...BURGERTOWN_ROUTE });
  }

  const name = TECH_NAMES[state.techs.length] ?? `Tech ${state.techs.length + 1}`;
  state.techs.push({
    id: `tech-${state.techs.length + 1}`,
    name,
    skill: 1,
    routeId: BURGERTOWN_ROUTE.id,
    hiredAt: now,
  });

  return { ok: true, reason: null };
}

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
