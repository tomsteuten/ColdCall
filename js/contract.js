/** @file Today's contract (GDD §5): one seeded-by-date bonus objective per day.
 * "Fix N <machine> · +$R" — generated deterministically from the UTC date and
 * the player's unlocked tier (rule 6), pinned into state.contract at generation
 * so a mid-day tier unlock or balance patch can never reroll a contract the
 * player is already working on. Progress counts ACTIVE client fixes only
 * (fresh tickets and callbacks); workshop repairs and MotD are not client jobs.
 */

import { mulberry32 } from './rng.js';
import { CONTRACT } from '../config/balance.js';

/**
 * UTC date string "YYYY-MM-DD". Local copy — economy.js has the same helper,
 * but importing it here would close a cycle (economy → contract → economy).
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {string}
 */
function utcToday(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Generate the contract for a date and tier, deterministically (rule 6): the
 * same date + tier yields the same machine, count, and reward for everyone.
 * Only machines of tiers the player has unlocked are eligible — a Tier 1
 * player is never asked to fix a froyo multihead they can't get tickets for.
 * @param {object[]} machines from machines.json ({id, name, tier})
 * @param {number} tierUnlocked player.tierUnlocked at generation time
 * @param {string} dateStr UTC "YYYY-MM-DD" the contract is for
 * @returns {{date: string, machineType: string, count: number, reward: number, progress: number, paid: boolean}|null}
 *   null when no machine qualifies (defensive — an empty machines.json)
 */
export function generateContract(machines, tierUnlocked, dateStr) {
  const eligible = machines.filter((m) => m.tier <= tierUnlocked);
  if (eligible.length === 0) return null;
  const rng = mulberry32(`contract:${dateStr}:${tierUnlocked}`);
  const machine = eligible[Math.floor(rng() * eligible.length)];
  const span = CONTRACT.countMax - CONTRACT.countMin + 1;
  const count = CONTRACT.countMin + Math.floor(rng() * span);
  const reward = (CONTRACT.rewardPerFix[machine.tier] ?? 0) * count;
  return { date: dateStr, machineType: machine.id, count, reward, progress: 0, paid: false };
}

/**
 * Make sure state.contract is today's contract, generating a fresh one when
 * missing or stale (yesterday's). A same-day contract is never regenerated —
 * its machine, count, and progress are pinned even if the tier changed since.
 * Called from action boundaries (boot, next ticket), never from render.
 * @param {object} state game state (mutated: state.contract on refresh)
 * @param {object[]} machines from machines.json
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {object|null} the current contract
 */
export function ensureContract(state, machines, now = Date.now()) {
  const today = utcToday(now);
  if (!state.contract || state.contract.date !== today) {
    state.contract = generateContract(machines, state.player.tierUnlocked, today);
  }
  return state.contract;
}

/**
 * Count a correct active fix toward today's contract and pay the one-time
 * reward on completion. No-op (null) when there is no live contract for
 * today, the machine doesn't match, or the reward was already paid — so
 * settlement can call this unconditionally.
 * @param {object} state game state (mutated: contract progress, cash on completion)
 * @param {string} machineType the machine type of the job just fixed
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{progress: number, count: number, reward: number, justCompleted: boolean}|null}
 *   receipt payload; null when the fix didn't touch the contract
 */
export function recordContractProgress(state, machineType, now = Date.now()) {
  const c = state.contract;
  if (!c || c.paid) return null;
  if (c.date !== utcToday(now)) return null;
  if (c.machineType !== machineType) return null;
  c.progress += 1;
  let justCompleted = false;
  if (c.progress >= c.count) {
    c.paid = true;
    justCompleted = true;
    state.player.cash += c.reward;
    state.player.lifetimeEarnings += c.reward;
  }
  return { progress: c.progress, count: c.count, reward: c.reward, justCompleted };
}
