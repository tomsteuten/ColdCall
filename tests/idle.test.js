/** @file Tests for idle.js: offline simulation invariants, determinism, earnings, callbacks. */

import { defaultState } from '../js/state.js';
import { TECHS, OFFLINE, JOBS } from '../config/balance.js';
import { simulateOfflineProgress } from '../js/idle.js';
import { utcDateStringAfter } from '../js/economy.js';

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

/** State with both launch techs assigned to the same route. */
function stateWithTwoTechs(lastSeenMsAgo) {
  const { state, now } = stateWithTech(lastSeenMsAgo);
  state.techs.push({
    id: 'tech-2',
    name: 'Mike',
    skill: 1,
    routeId: 'burgertown-south',
    hiredAt: now,
  });
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
    assertEqual(cb.source, 'tech', 'an idle tech botched it — it is a tech-caused rescue');
    assertEqual(cb.expiryDay, utcDateStringAfter(1 + JOBS.callbackExpiryDays, now),
      'expiry = due day + callbackExpiryDays');
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

// --- session 13: offline carry tests (REVIEW_FINDINGS #2) ---

test('two short absences equal one combined absence (carry accumulates)', () => {
  // jobsPerHour = 2, so 45 min = 0.75h = 1.5 raw jobs per session.
  // Without carry: floor(1.5) + floor(1.5) = 1 + 1 = 2 total jobs.
  // With carry:    floor(1.5) = 1, carry = 0.5;
  //                floor(1.5 + 0.5) = 2; total = 1 + 2 = 3 jobs.
  // One combined 1.5h session: floor(3.0) = 3 jobs. Must match.
  const elapsed = 0.75 * HOUR_MS;

  // Two short sessions, manually advancing lastSeen between them.
  const { state: sa, now: nowA } = stateWithTech(elapsed);
  const r1 = simulateOfflineProgress(sa, makeFaults(), nowA);
  const jobs1 = (r1?.jobsDone ?? 0) + (r1?.callbacksAdded ?? 0);
  // Advance lastSeen to simulate the player saving between sessions.
  sa.lastSeen = nowA;
  const nowB = nowA + elapsed;
  const r2 = simulateOfflineProgress(sa, makeFaults(), nowB);
  const jobs2 = (r2?.jobsDone ?? 0) + (r2?.callbacksAdded ?? 0);
  const twoShortTotal = jobs1 + jobs2;

  // One combined session spanning the same total time.
  const { state: sLong, now: nowLong } = stateWithTech(2 * elapsed);
  const rLong = simulateOfflineProgress(sLong, makeFaults(), nowLong);
  const longTotal = (rLong?.jobsDone ?? 0) + (rLong?.callbacksAdded ?? 0);

  assertEqual(twoShortTotal, longTotal,
    `two short sessions (${twoShortTotal}) should equal one long session (${longTotal})`);
});

test('carry accumulated from a short session is used in the next session', () => {
  // 1 job/hr would need 30 min per job. With jobsPerHour = 2 each job is 30 min.
  // Run a 25-minute session: 0.417 * 2 = 0.833 raw jobs → 0 completed, carry = 0.833.
  // Run another 25-minute session: 0.417 * 2 + 0.833 = 1.667 → 1 completed, carry = 0.667.
  const session = (25 / 60) * HOUR_MS;

  const { state, now: now1 } = stateWithTech(session);
  const r1 = simulateOfflineProgress(state, makeFaults(), now1);
  // The first session produces 0 jobs (not enough for a whole job).
  const firstJobs = (r1?.jobsDone ?? 0) + (r1?.callbacksAdded ?? 0);
  assertEqual(firstJobs, 0, 'no complete jobs in a 25-min session');
  assert(state.offlineJobCarry > 0, 'carry should be positive after partial session');

  // Second session.
  state.lastSeen = now1;
  const now2 = now1 + session;
  const r2 = simulateOfflineProgress(state, makeFaults(), now2);
  const secondJobs = (r2?.jobsDone ?? 0) + (r2?.callbacksAdded ?? 0);
  assertEqual(secondJobs, 1, 'carry from first session completes a job in the second');
});

test('carry does not bypass the 8h offline cap', () => {
  // Give the state a large carry (close to 1 job) and a capped absence (>>8h).
  // Total jobs should not exceed floor(capHours * jobsPerHour + carry).
  const { state, now } = stateWithTech(48 * HOUR_MS); // 2 days elapsed
  state.offlineJobCarry = 0.9; // pre-existing carry

  const maxJobs = Math.floor(OFFLINE.baseCapHours * TECHS.jobsPerHour + 0.9);
  const report = simulateOfflineProgress(state, makeFaults(), now);
  const total = (report?.jobsDone ?? 0) + (report?.callbacksAdded ?? 0);

  assert(total <= maxJobs,
    `total jobs (${total}) must not exceed cap + carry ceiling (${maxJobs})`);
});

test('two-tech carry: short absences equal one combined absence', () => {
  // Two techs at 2 jobs/hour generate 4 aggregate jobs/hour. Two 20-minute
  // absences must therefore match one 40-minute absence.
  const elapsed = (20 / 60) * HOUR_MS;

  const { state: split, now: firstNow } = stateWithTwoTechs(elapsed);
  const first = simulateOfflineProgress(split, makeFaults(), firstNow);
  split.lastSeen = firstNow;
  const second = simulateOfflineProgress(split, makeFaults(), firstNow + elapsed);
  const splitJobs =
    (first?.jobsDone ?? 0) + (first?.callbacksAdded ?? 0) +
    (second?.jobsDone ?? 0) + (second?.callbacksAdded ?? 0);

  const { state: combined, now: combinedNow } = stateWithTwoTechs(2 * elapsed);
  const oneRun = simulateOfflineProgress(combined, makeFaults(), combinedNow);
  const combinedJobs = (oneRun?.jobsDone ?? 0) + (oneRun?.callbacksAdded ?? 0);

  assertEqual(
    splitJobs,
    combinedJobs,
    `two-tech split sessions (${splitJobs}) should equal combined session (${combinedJobs})`
  );
  assertEqual(
    split.offlineJobCarry,
    combined.offlineJobCarry,
    'aggregate carry should also match'
  );
});
