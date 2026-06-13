/** @file Techs, contract routes, and deterministic offline-progress simulation from lastSeen. */

import { TECHS, OFFLINE, JOBS } from '../config/balance.js';
import { mulberry32 } from './rng.js';
import { utcDateStringAfter } from './economy.js';

const HOUR_MS = 3600 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Simulate offline progress for all techs on routes.
 * Called once on load; never called again until the next load.
 * Pure over state — only mutates cash, lifetimeEarnings, stats, and callbacks.
 *
 * GDD §3.2: "Simulated on load from elapsed time (no background timers).
 * Capped at 8h base." Active play must always beat idle $/min (GDD §3.1).
 *
 * @param {object} state game state (mutated on non-null return)
 * @param {Object<string, object>} faults fault library keyed by id
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{elapsedMs: number, simulatedMs: number, totalEarned: number,
 *   jobsDone: number, callbacksAdded: number,
 *   techReports: Array<{name: string, jobs: number, earned: number, callbacks: number}>}|null}
 *   null when there is nothing to report (fresh save or < 1 min elapsed)
 */
export function simulateOfflineProgress(state, faults, now = Date.now()) {
  if (!state.lastSeen || state.lastSeen === 0) return null;

  const activeTechs = state.techs
    .map((tech) => ({ tech, route: state.routes.find((r) => r.id === tech.routeId) }))
    .filter(({ route }) => route);
  if (activeTechs.length === 0) return null;

  const elapsedMs = now - state.lastSeen;
  if (elapsedMs < MINUTE_MS) return null;

  const capMs = OFFLINE.baseCapHours * HOUR_MS;
  const simulatedMs = Math.min(elapsedMs, capMs);
  const hours = simulatedMs / HOUR_MS;

  // Carry is aggregate work across every assigned tech. This keeps several
  // short absences equivalent to one combined absence even with two techs.
  const prevCarry = typeof state.offlineJobCarry === 'number' ? state.offlineJobCarry : 0;
  const rawJobs = hours * TECHS.jobsPerHour * activeTechs.length + prevCarry;
  const totalJobs = Math.floor(rawJobs);
  state.offlineJobCarry = rawJobs - totalJobs;

  let totalEarned = 0;
  let jobsDone = 0;
  let callbacksAdded = 0;
  const techReports = [];

  const baseJobs = Math.floor(totalJobs / activeTechs.length);
  const extraJobs = totalJobs % activeTechs.length;

  for (const [techIndex, { tech, route }] of activeTechs.entries()) {
    // Tier-appropriate faults for the route's client tier — pick from tier 2
    // (the only contract route at launch). Falling back to all faults is safe.
    const routeFaults = Object.values(faults).filter((f) => f.tier === 2);
    const faultPool = routeFaults.length > 0 ? routeFaults : Object.values(faults);

    const jobs = baseJobs + (techIndex < extraJobs ? 1 : 0);
    // Seed on tech id + lastSeen so the same offline period always produces the
    // same result — deterministic simulation is a GDD rule 6 requirement.
    const prng = mulberry32(`${tech.id}-${state.lastSeen}`);

    let techEarned = 0;
    let techCallbacks = 0;

    for (let i = 0; i < jobs; i++) {
      if (prng() < TECHS.baseSuccessRate) {
        techEarned += TECHS.earningsPerJob;
        jobsDone++;
      } else {
        // Failed job: pick a random fault and queue a tech-caused (rescue)
        // callback due tomorrow (GDD §3.1) — the player can rescue it near the
        // fresh rate. expiryDay gives it the same claim window as any callback.
        const fault = faultPool[Math.floor(prng() * faultPool.length)];
        state.jobs.callbacks.push({
          faultId: fault.id,
          clientId: route.clientId,
          dueDay: utcDateStringAfter(1, now),
          expiryDay: utcDateStringAfter(1 + JOBS.callbackExpiryDays, now),
          misses: 1,
          source: 'tech',
          techId: tech.id,
          techName: tech.name,
        });
        techCallbacks++;
        callbacksAdded++;
      }
    }

    totalEarned += techEarned;
    techReports.push({ name: tech.name, jobs, earned: techEarned, callbacks: techCallbacks });
  }

  if (totalEarned === 0 && callbacksAdded === 0) return null;

  state.player.cash += totalEarned;
  state.player.lifetimeEarnings += totalEarned;
  state.stats.jobsCompleted += jobsDone;

  return { elapsedMs, simulatedMs, totalEarned, jobsDone, callbacksAdded, techReports };
}
