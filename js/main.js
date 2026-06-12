/** @file Boot and screen routing: load save + fault library, route between home/job/invoice. */

import { load, save } from './state.js';
import { loadGameData } from './faults.js';
import { startJob, runTest, commitFix } from './diagnosis.js';
import { buyTool, claimDueCallback, restockVan } from './economy.js';
import { pickTicket } from './tickets.js';
import { mulberry32 } from './rng.js';
import { pickMotdFault, canPlayToday, getTodayDateStr, buildShareCard } from './motd.js';
import * as jobScreen from './ui/job.js';
import * as shopScreen from './ui/shop.js';
import * as motdScreen from './ui/motd.js';

const { state, error } = load();
if (error) {
  // Saves are sacred: the corrupt blob is still in localStorage, untouched.
  console.error(`Cold Call: existing save could not be loaded (${error}). Starting fresh without overwriting it.`);
}

const { faults, machines, clients } = await loadGameData();

const app = document.getElementById('app');

// Result of the last commitFix, shown on the invoice screen. Transient by
// design: a refresh mid-invoice lands on home with the money already banked.
let invoice = null;

// Result of a completed MotD run. Transient: a refresh lands on home, and the
// result is still recoverable via state.motd.lastResult if played today.
let motdResult = null;

// Which top-level screen is showing. Transient on purpose — where you were
// browsing isn't game state, so a refresh lands back on home.
let screen = 'home';

// Tier just unlocked, for a one-time home-screen banner. Transient: the unlock
// itself is in state (player.tierUnlocked); only the fanfare is lost on refresh.
let justUnlockedTier = null;

const actions = {
  nextTicket() {
    justUnlockedTier = null;
    const next = mulberry32(Date.now());
    // Due callbacks jump the queue (GDD §2.1: the job returns tomorrow).
    const cb = claimDueCallback(state, faults);
    if (cb) {
      startJob(state, faults[cb.faultId], cb.clientId, next, { misses: cb.misses });
    } else {
      const { fault, client } = pickTicket(faults, clients, state.player.tierUnlocked, next);
      startJob(state, fault, client.id, next);
    }
    save(state);
    render();
  },
  runTest(testId) {
    runTest(state, testId, faults);
    save(state);
    render();
  },
  commitFix(fixId) {
    const result = commitFix(state, fixId, faults);
    if (result.motd) {
      motdResult = result;
      screen = 'motd';
    } else {
      invoice = result;
      if (result.unlockedTier) justUnlockedTier = result.unlockedTier;
    }
    save(state);
    render();
  },
  dismissInvoice() {
    invoice = null;
    render();
  },
  openShop() {
    screen = 'shop';
    render();
  },
  closeShop() {
    screen = 'home';
    render();
  },
  buyTool(toolId) {
    const { ok, reason } = buyTool(state, toolId);
    if (ok) save(state);
    else console.warn(`Cold Call: tool not bought: ${reason}`);
    render();
  },
  restockVan() {
    const { ok, reason } = restockVan(state);
    if (ok) save(state);
    else console.warn(`Cold Call: van not restocked: ${reason}`);
    render();
  },
  startMotd() {
    if (!canPlayToday(state)) return; // guard: already played today
    if (state.jobs.active) return;    // guard: finish current job first
    const todayStr = getTodayDateStr();
    const fault = pickMotdFault(faults, todayStr);
    const prng = mulberry32(todayStr + '-shuffle');
    startJob(state, fault, 'motd', prng, null, true);
    save(state);
    render();
  },
  openMotdResult() {
    // Re-open today's result from the home screen after it's been played.
    if (state.motd.lastResult) {
      // Recover the fault by re-running the same seeded draw for today's date.
      const fault = pickMotdFault(faults, state.motd.lastPlayedDate);
      motdResult = { ...state.motd.lastResult, streak: state.motd.streak, fault };
      screen = 'motd';
      render();
    }
  },
  dismissMotdResult() {
    motdResult = null;
    screen = 'home';
    render();
  },
  async shareMotd() {
    const dateStr = getTodayDateStr();
    const result = motdResult ?? { ...state.motd.lastResult, streak: state.motd.streak };
    const text = buildShareCard(result, dateStr);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (non-secure context) — fall back to a prompt.
      window.prompt('Copy this result:', text);
    }
  },
};

function render() {
  if (screen === 'motd') {
    motdScreen.render(app, { state, motdResult, actions });
  } else if (screen === 'shop' && !state.jobs.active && !invoice) {
    shopScreen.render(app, { state, actions });
  } else {
    jobScreen.render(app, { state, faults, machines, clients, invoice, justUnlockedTier, actions });
  }
}

// A save can hold an active job whose fault was since renamed/removed from the
// library. Don't strand the player: drop the job (no money moved), keep the save.
if (state.jobs.active && !faults[state.jobs.active.faultId]) {
  console.error(`Cold Call: active job references unknown fault "${state.jobs.active.faultId}"; abandoning the job.`);
  state.jobs.active = null;
}

render();
save(state);
