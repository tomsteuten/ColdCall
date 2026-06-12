/** @file Tests for idle.js: offline simulation invariants, determinism, earnings, callbacks. */

import { defaultState } from '../js/state.js';
import { TECHS, OFFLINE, JOBS } from '../config/balance.js';
import { simulateOfflineProgress } from '../js/idle.js';

const HOUR_MS = 3600 * 1000;
const MIN_MS = 60 * 1000;

/** A minimal fault library with one tier-2 fault for the simulation to pick from. */
function makeFaults() {
  return {
    'worn-scraper-blades': {
      id: 'worn-scraper-blades',
      machineType: 'soft-serve-commercial',
      tier: 2,
      symptoms: [],
      tests: {},
      correctFix: 'replace-scraper-blades',
      wrongFixes: ['replace-beater-motor'],
      payout: 110,
      partsCost: 15,
      flavour: 'Done.',
    },
  };
}

/** State with one tech on the Burgertown route. */
function stateWithTech(lastSeenMsAgo) {
  const now = Date.now();
  const state = defaultState();
  state.lastSeen = now - lastSeenMsAgo;
  state.player.tierUnlocked = 2;
  state.routes.push({ id: 'burgertown-south', clientId: 'burgertown-high-st' });
  state.techs.push({ id: 'tech-1', name: 'Dave', skill: 1, routeId: 'burgertown-south', hiredAt: now });
  return { state, now };
}

// --- invariant: active play always beats idle $/min ---

test('active > idle: tech earnings per minute are always below the minimum active payout', () => {
  // Active: the minimum correct-fix payout (tier 1) is JOBS.tier1.payoutMin minus max parts.
  // Even the cheapest correct job nets at least payoutMin - partsCostMax per session (~60s).
  // Idle tech earns earningsPerJob * jobsPerHour / 60 per minute.
  const idlePerMin = (TECHS.earningsPerJob * TECHS.jobsPerHour) / 60;
  const activeMinPerMin = (JOBS.tier1.payoutMin - JOBS.tier1.partsCostMax); // per job, ~60s
  assert(
    idlePerMin < activeMinPerMin,
    `idle $/min (${idlePerMin.toFixed(2)}) must be < active min $/min (${activeMinPerMin})`
  );
});

// --- returns null in edge cases ---

test('returns null when lastSeen is 0 (fresh state)', () => {
  const state = defaultState();
  state.lastSeen = 0;
  assertEqual(simulateOfflineProgress(state, makeFaults()), null);
});

test('returns null when no techs are on a route', () => {
  const state = defaultState();
  state.lastSeen = Date.now() - HOUR_MS;
  // No techs at all
  assertEqual(simulateOfflineProgress(state, makeFaults()), null);
});

test('returns null when elapsed < 1 minute', () => {
  const { state, now } = stateWithTech(30 * 1000); // 30 seconds
  assertEqual(simulateOfflineProgress(state, makeFaults(), now), null);
});

// --- simulation correctness ---

test('simulates the correct number of jobs for elapsed hours', () => {
  const { state, now } = stateWithTech(4 * HOUR_MS); // 4 hours
  const report = simulateOfflineProgress(state, makeFaults(), now);
  assert(report !== null, 'should return a report');
  const expectedJobs = Math.floor(4 * TECHS.jobsPerHour);
  assertEqual(report.jobsDone + report.callbacksAdded, expectedJobs,
    `total jobs (done + callbacks) should equal ${expectedJobs}`);
});

test('caps simulation at OFFLINE.baseCapHours regardless of elapsed time', () => {
  const { state, now } = stateWithTech(48 * HOUR_MS); // 2 days elapsed
  const report = simulateOfflineProgress(state, makeFaults(), now);
  const maxJobs = Math.floor(OFFLINE.baseCapHours * TECHS.jobsPerHour);
  assert(report.jobsDone + report.callbacksAdded <= maxJobs,
    `total jobs should be capped at ${maxJobs} (8h cap)`);
  assert(report.simulatedMs <= OFFLINE.baseCapHours * HOUR_MS,
    'simulatedMs should be capped');
});

test('cash and lifetimeEarnings increase by totalEarned', () => {
  const { state, now } = stateWithTech(4 * HOUR_MS);
  const cashBefore = state.player.cash;
  const report = simulateOfflineProgress(state, makeFaults(), now);
  assertEqual(state.player.cash, cashBefore + report.totalEarned);
  assertEqual(state.player.lifetimeEarnings, report.totalEarned);
});

test('failed jobs add callbacks to state.jobs.callbacks', () => {
  const { state, now } = stateWithTech(4 * HOUR_MS);
  const report = simulateOfflineProgress(state, makeFaults(), now);
  assertEqual(state.jobs.callbacks.length, report.callbacksAdded);
  if (report.callbacksAdded > 0) {
    const cb = state.jobs.callbacks[0];
    assert(typeof cb.faultId === 'string', 'callback should have a faultId');
    assert(typeof cb.dueDay === 'string', 'callback should have a dueDay');
    assertEqual(cb.misses, 1, 'first miss starts at 1');
  }
});

test('deterministic: same lastSeen produces the same result', () => {
  const { state: s1, now } = stateWithTech(4 * HOUR_MS);
  const { state: s2 } = stateWithTech(4 * HOUR_MS);
  // Both states have the same lastSeen since stateWithTech sets it to now - elapsed
  s2.lastSeen = s1.lastSeen;

  const r1 = simulateOfflineProgress(s1, makeFaults(), now);
  const r2 = simulateOfflineProgress(s2, makeFaults(), now);

  assertEqual(r1.jobsDone, r2.jobsDone, 'same seed must produce same successes');
  assertEqual(r1.callbacksAdded, r2.callbacksAdded, 'same seed must produce same failures');
  assertEqual(r1.totalEarned, r2.totalEarned, 'same seed must produce same earnings');
});

test('tech report lists the tech by name', () => {
  const { state, now } = stateWithTech(4 * HOUR_MS);
  const report = simulateOfflineProgress(state, makeFaults(), now);
  assert(report !== null, 'should have a report');
  assert(report.techReports.length === 1, 'one tech, one report');
  assertEqual(report.techReports[0].name, 'Dave');
});
