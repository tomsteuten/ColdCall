/** @file Ticket generation: pick a random (fault, same-tier client) pair,
 * gated to the player's unlocked tier (GDD §3.3: reputation gates client tiers).
 */

/**
 * Pick a random fault and a random client of the same tier, using an injected
 * PRNG so tests (and later Machine of the Day) can reproduce the draw.
 * Only tiers ≤ tierUnlocked are offered; faults whose tier has no client are
 * never picked — a ticket needs a caller.
 * @param {Object<string, object>} faults fault library keyed by id
 * @param {object[]} clients from clients.json
 * @param {number} tierUnlocked player.tierUnlocked — highest tier to offer
 * @param {function(): number} next PRNG in [0,1)
 * @returns {{fault: object, client: object}}
 */
export function pickTicket(faults, clients, tierUnlocked, next) {
  const clientsByTier = new Map();
  for (const c of clients) {
    if (c.tier > tierUnlocked) continue;
    if (!clientsByTier.has(c.tier)) clientsByTier.set(c.tier, []);
    clientsByTier.get(c.tier).push(c);
  }
  const candidates = Object.values(faults).filter((f) => clientsByTier.has(f.tier));
  if (candidates.length === 0) throw new Error('No fault has a client of the same unlocked tier');
  const fault = candidates[Math.floor(next() * candidates.length)];
  const pool = clientsByTier.get(fault.tier);
  const client = pool[Math.floor(next() * pool.length)];
  return { fault, client };
}
