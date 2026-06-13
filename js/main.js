/** @file Boot and screen routing: load save + fault library, route between home/job/invoice. */

import { load, makePersist, exportSave, importSave as importSaveBlob, save as rawSave, SAVE_KEY } from './state.js';
import { loadGameData } from './faults.js';
import { startJob, runTest, commitFix } from './diagnosis.js';
import { buyTool, claimCallback, expireCallbacks, restockVan, hireTech } from './economy.js';
import { simulateOfflineProgress } from './idle.js';
import { pickTicket } from './tickets.js';
import { mulberry32 } from './rng.js';
import { pickMotdFault, canPlayToday, getTodayDateStr, buildShareCard } from './motd.js';
import * as jobScreen from './ui/job.js';
import * as shopScreen from './ui/shop.js?v=2';
import * as motdScreen from './ui/motd.js';

const { state, error } = load();
if (error) {
  // Saves are sacred: the corrupt blob is still in localStorage, untouched.
  console.error(`Cold Call: existing save could not be loaded (${error}). Starting fresh without overwriting it.`);
}
// Every save this session goes through this gate — when load failed it
// refuses to write, so the unreadable blob is never overwritten.
const save = makePersist(error);

// Raw blob preserved in storage when the load failed — offered to the player
// for recovery via copy/paste (the only recovery story for a corrupt save).
const corruptSaveBlob = error ? (globalThis.localStorage?.getItem(SAVE_KEY) ?? null) : null;

const { faults, machines, clients } = await loadGameData();

const app = document.getElementById('app');

// Result of the last commitFix, shown on the invoice screen. Transient by
// design: a refresh mid-invoice lands on home with the money already banked.
let invoice = null;

// Offline progress report from this load (techs earned while away). Transient:
// shown once, dismissed by the player, gone on next refresh.
let offlineReport = null;

// Callbacks that expired off the board while away (GDD §3.1). Transient: shown
// once in a home banner, dismissed by the player, gone on next refresh.
let expiryReport = null;

// Result of a completed MotD run. Transient: a refresh lands on home, and the
// result is still recoverable via state.motd.lastResult if played today.
let motdResult = null;

// Feedback messages for the save data panel in the shop. Transient.
let exportMessage = null;
let importError = null;

// Which top-level screen is showing. Transient on purpose — where you were
// browsing isn't game state, so a refresh lands back on home.
let screen = 'home';

// Tier just unlocked, for a one-time home-screen banner. Transient: the unlock
// itself is in state (player.tierUnlocked); only the fanfare is lost on refresh.
let justUnlockedTier = null;

const actions = {
  nextTicket() {
    justUnlockedTier = null;
    // Fresh tickets only — callbacks are never auto-claimed (GDD §3.1); the
    // player chooses them from the Callbacks list via takeCallback().
    const next = mulberry32(Date.now());
    const { fault, client } = pickTicket(faults, clients, state.player.tierUnlocked, next);
    startJob(state, fault, client.id, next);
    save(state);
    render();
  },
  openCallbacks() {
    justUnlockedTier = null;
    screen = 'callbacks';
    render();
  },
  closeCallbacks() {
    screen = 'home';
    render();
  },
  takeCallback(index) {
    const cb = claimCallback(state, faults, Number(index));
    if (cb) {
      const next = mulberry32(Date.now());
      startJob(state, faults[cb.faultId], cb.clientId, next, {
        misses: cb.misses,
        source: cb.source,
      });
      screen = 'home';
      save(state);
    }
    // A failed claim (stale/removed entry) just re-renders the updated list.
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
    exportMessage = null;
    importError = null;
    screen = 'shop';
    render();
  },
  closeShop() {
    exportMessage = null;
    importError = null;
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
  hireTech() {
    const { ok, reason } = hireTech(state);
    if (ok) save(state);
    else console.warn(`Cold Call: tech not hired: ${reason}`);
    render();
  },
  dismissOfflineReport() {
    offlineReport = null;
    render();
  },
  dismissExpiryReport() {
    expiryReport = null;
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
      // The result pins its faultId; pre-v4 saves don't have it (null), so
      // fall back to re-running the seeded draw for the played date.
      const fault =
        faults[state.motd.lastResult.faultId] ?? pickMotdFault(faults, state.motd.lastPlayedDate);
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
  async exportSave() {
    const blob = exportSave(state);
    try {
      await navigator.clipboard.writeText(blob);
      exportMessage = 'Copied to clipboard.';
    } catch {
      window.prompt('Copy this to transfer your save to another device:', blob);
      exportMessage = null;
    }
    render();
  },
  importSave(blob) {
    if (!blob.trim()) return;
    try {
      const newState = importSaveBlob(blob);
      // Bypass the session gate — an explicit import replaces whatever is there.
      rawSave(newState);
      window.location.reload();
    } catch (e) {
      importError = String(e.message ?? e);
      render();
    }
  },
  async copyCorruptSave() {
    if (!corruptSaveBlob) return;
    try {
      await navigator.clipboard.writeText(corruptSaveBlob);
    } catch {
      window.prompt('Copy the raw save blob (it may be recoverable after a game update):', corruptSaveBlob);
    }
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
    shopScreen.render(app, { state, actions, exportMessage, importError });
  } else {
    jobScreen.render(app, { state, faults, machines, clients, invoice, justUnlockedTier, offlineReport, expiryReport, corruptSaveBlob, screen, actions });
  }
}

// A save can hold an active job whose fault was since renamed/removed from the
// library. Don't strand the player: drop the job (no money moved), keep the save.
if (state.jobs.active && !faults[state.jobs.active.faultId]) {
  console.error(`Cold Call: active job references unknown fault "${state.jobs.active.faultId}"; abandoning the job.`);
  state.jobs.active = null;
}

// Expire stale callbacks and simulate offline progress before first render, so
// both reports are visible on home. Expire first: a callback can only fall off
// the board for being old, never for the new offline jobs queued this load.
expiryReport = expireCallbacks(state);
offlineReport = simulateOfflineProgress(state, faults);

render();
save(state);
