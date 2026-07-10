/** @file Ticket generation: pick a random (fault, same-tier client) pair,
 * gated to the player's unlocked tier (GDD §3.3: reputation gates client tiers).
 */

/**
 * Pick a random fault and a random client of the same tier, using an injected
 * PRNG so tests (and later Machine of the Day) can reproduce the draw.
 * Only tiers ≤ tierUnlocked are offered; faults whose tier has no client are
 * never picked — a ticket needs a caller.
 *
 * Anti-repeat (2026-07-08 playtest fix — "feels too repetitive"): faults in
 * `recentFaultIds` are excluded from the draw so the same fault can't come up
 * twice in quick succession. If exclusion would empty the pool (tiny fault
 * pool, e.g. a test fixture), fall back to the full pool rather than throw —
 * a repeat beats no ticket. Determinism (rule 6) is preserved: the list is
 * saved state and the PRNG is untouched.
 * @param {Object<string, object>} faults fault library keyed by id
 * @param {object[]} clients from clients.json
 * @param {number} tierUnlocked player.tierUnlocked — highest tier to offer
 * @param {function(): number} next PRNG in [0,1)
 * @param {string[]} [recentFaultIds] fault ids to avoid (state.jobs.recentFaultIds)
 * @returns {{fault: object, client: object}}
 */
export function pickTicket(faults, clients, tierUnlocked, next, recentFaultIds = []) {
  const clientsByTier = new Map();
  for (const c of clients) {
    if (c.tier > tierUnlocked) continue;
    if (!clientsByTier.has(c.tier)) clientsByTier.set(c.tier, []);
    clientsByTier.get(c.tier).push(c);
  }
  const candidates = Object.values(faults).filter((f) => clientsByTier.has(f.tier));
  if (candidates.length === 0) throw new Error('No fault has a client of the same unlocked tier');
  const fresh = candidates.filter((f) => !recentFaultIds.includes(f.id));
  const pool_ = fresh.length > 0 ? fresh : candidates;
  const fault = pool_[Math.floor(next() * pool_.length)];
  const pool = clientsByTier.get(fault.tier);
  const client = pool[Math.floor(next() * pool.length)];
  return { fault, client };
}

/** How many recent fault ids the draw avoids (window size for recentFaultIds). */
export const RECENT_FAULT_WINDOW = 3;

/**
 * Record a drawn fault in the anti-repeat window (FIFO, capped at
 * RECENT_FAULT_WINDOW). Mutates and returns the array for convenience.
 * @param {string[]} recentFaultIds state.jobs.recentFaultIds
 * @param {string} faultId
 */
export function recordRecentFault(recentFaultIds, faultId) {
  recentFaultIds.push(faultId);
  while (recentFaultIds.length > RECENT_FAULT_WINDOW) recentFaultIds.shift();
  return recentFaultIds;
}
