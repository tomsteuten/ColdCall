/** @file Today's contract (GDD §5): seeded generation, pinning, progress, one-time reward. */

import { defaultState, validateState } from '../js/state.js';
import { generateContract, ensureContract, recordContractProgress } from '../js/contract.js';
import { settleJob } from '../js/economy.js';
import { CONTRACT } from '../config/balance.js';

const MACHINES = [
  { id: 'slushie-machine', name: 'Polar Twister Twin-Bowl Slushie', tier: 1 },
  { id: 'soft-serve-commercial', name: 'FrostKing 4500 Soft Serve', tier: 2 },
  { id: 'froyo-multihead', name: 'YogurtMaster 3000 Multihead Froyo', tier: 3 },
];

const NOON = Date.UTC(2026, 6, 4, 12, 0, 0); // 2026-07-04
const TODAY = '2026-07-04';

test('generateContract is deterministic per date + tier (rule 6)', () => {
  const a = generateContract(MACHINES, 3, TODAY);
  const b = generateContract(MACHINES, 3, TODAY);
  assertEqual(a, b, 'same date and tier must generate the identical contract');
  const otherDay = generateContract(MACHINES, 3, '2026-07-05');
  assert(
    JSON.stringify(a) !== JSON.stringify(otherDay),
    'a different date should (eventually) vary the draw — these two days must differ for the test to mean anything'
  );
});

test('generateContract only targets machines of unlocked tiers', () => {
  for (let day = 1; day <= 20; day++) {
    const c = generateContract(MACHINES, 1, `2026-07-${String(day).padStart(2, '0')}`);
    assertEqual(c.machineType, 'slushie-machine', 'a tier 1 player only ever gets tier 1 targets');
  }
  // At tier 3 every machine appears across enough days.
  const seen = new Set();
  for (let day = 1; day <= 28; day++) {
    seen.add(generateContract(MACHINES, 3, `2026-06-${String(day).padStart(2, '0')}`).machineType);
  }
  assert(seen.size === 3, `all machines should appear across a month, saw ${[...seen].join(', ')}`);
});

test('contract count and reward come from balance.js (reward = perFix × count)', () => {
  for (let day = 1; day <= 10; day++) {
    const c = generateContract(MACHINES, 3, `2026-07-${String(day).padStart(2, '0')}`);
    assert(c.count >= CONTRACT.countMin && c.count <= CONTRACT.countMax, `count ${c.count} in range`);
    const tier = MACHINES.find((m) => m.id === c.machineType).tier;
    assertEqual(c.reward, CONTRACT.rewardPerFix[tier] * c.count, 'reward derives from balance.js');
    assertEqual(c.progress, 0);
    assertEqual(c.paid, false);
  }
});

test('generateContract returns null for an empty machine list (defensive)', () => {
  assertEqual(generateContract([], 3, TODAY), null);
});

test('ensureContract generates when missing, refreshes when stale, pins same-day', () => {
  const state = defaultState();
  assertEqual(state.contract, null, 'fresh save starts with no contract');
  const first = ensureContract(state, MACHINES, NOON);
  assertEqual(first.date, TODAY);

  // Same day: pinned — even if the tier changed, the contract must not reroll.
  state.player.tierUnlocked = 3;
  state.contract.progress = 1;
  const again = ensureContract(state, MACHINES, NOON);
  assertEqual(again.progress, 1, 'same-day contract is never regenerated');
  assertEqual(again.machineType, first.machineType);

  // Next day: refreshed from the new date (and the new tier).
  const tomorrowNoon = NOON + 24 * 3600 * 1000;
  const next = ensureContract(state, MACHINES, tomorrowNoon);
  assertEqual(next.date, '2026-07-05');
  assertEqual(next.progress, 0, 'a new day starts a fresh objective');
});

/** A state holding a known 2-fix slushie contract for today. */
function contractState() {
  const state = defaultState();
  state.contract = {
    date: TODAY,
    machineType: 'slushie-machine',
    count: 2,
    reward: 80,
    progress: 0,
    paid: false,
  };
  return state;
}

test('recordContractProgress counts only matching machine types on the right day', () => {
  const state = contractState();
  assertEqual(recordContractProgress(state, 'soft-serve-commercial', NOON), null, 'wrong machine');
  assertEqual(state.contract.progress, 0);
  assertEqual(
    recordContractProgress(state, 'slushie-machine', NOON + 25 * 3600 * 1000),
    null,
    'a stale contract earns nothing tomorrow'
  );
  const r = recordContractProgress(state, 'slushie-machine', NOON);
  assertEqual(r, { progress: 1, count: 2, reward: 80, justCompleted: false });
});

test('completing the contract pays the reward exactly once', () => {
  const state = contractState();
  const cash = state.player.cash;
  recordContractProgress(state, 'slushie-machine', NOON);
  const done = recordContractProgress(state, 'slushie-machine', NOON);
  assertEqual(done.justCompleted, true);
  assertEqual(state.contract.paid, true);
  assertEqual(state.player.cash, cash + 80);
  assertEqual(state.player.lifetimeEarnings, 80);
  // A third matching fix is a plain job — the daily bonus never double-pays.
  assertEqual(recordContractProgress(state, 'slushie-machine', NOON), null);
  assertEqual(state.player.cash, cash + 80, 'no double payment');
});

test('settleJob advances the contract on correct active fixes (fresh and callback), not on misses', () => {
  const state = contractState();
  const fault = {
    id: 'f', machineType: 'slushie-machine', tier: 1, symptoms: ['x'], tests: {},
    correctFix: 'fix', wrongFixes: ['no'], payout: 100, partsCost: 0, flavour: 'ok',
  };
  // Miss: no progress.
  const missed = settleJob(state, fault, false, 'client-1', { now: NOON });
  assertEqual(missed.contract, null);
  assertEqual(state.contract.progress, 0);
  // Fresh correct fix: progress 1.
  const fresh = settleJob(state, fault, true, 'client-1', { testsRun: ['error-log'], now: NOON });
  assertEqual(fresh.contract, { progress: 1, count: 2, reward: 80, justCompleted: false });
  // Correct callback rescue: progress 2 → completed, reward on top of job pay.
  const cashBefore = state.player.cash;
  const rescue = settleJob(state, fault, true, 'client-1', {
    callback: { misses: 1, source: 'tech' },
    now: NOON,
  });
  assertEqual(rescue.contract.justCompleted, true);
  assertEqual(state.player.cash, cashBefore + rescue.earned + 80, 'reward is additive to job pay');
});

test('rule 5: the daily reward only ever pays for active fixes, once, from balance.js', () => {
  // The contract cannot create idle income: recordContractProgress is called
  // only inside settleJob's correct branch (active client jobs). This pins the
  // reward source and the one-time flag so a regression can't silently turn it
  // into a repeatable faucet.
  const state = contractState();
  recordContractProgress(state, 'slushie-machine', NOON);
  recordContractProgress(state, 'slushie-machine', NOON);
  const drained = [1, 2, 3].map(() => recordContractProgress(state, 'slushie-machine', NOON));
  assertEqual(drained, [null, null, null], 'a paid contract is inert for the rest of the day');
});

test('validateState accepts a null contract, a valid contract, and rejects a hostile one', () => {
  validateState(defaultState()); // contract: null — must not throw

  const good = contractState();
  validateState(good); // well-typed — must not throw

  const bad = contractState();
  bad.contract.progress = '<img onerror=alert(1)>';
  let threw = false;
  try {
    validateState(bad);
  } catch (e) {
    threw = true;
    assert(String(e.message).includes('contract.progress'), 'error names the bad field');
  }
  assert(threw, 'a non-numeric contract.progress must be rejected');
});
