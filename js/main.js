/** @file Boot and screen routing: load save + fault library, route between home/job/invoice. */

import { load, makePersist, exportSave, importSave as importSaveBlob, save as rawSave, SAVE_KEY } from './state.js';
import { loadGameData } from './faults.js';
import { startJob, runTest, commitFix } from './diagnosis.js';
import { buyLadderItem, claimCallback, expireCallbacks, restockVan, prestige, buyWorkshopMachine, sellWorkshopMachine } from './economy.js';
import { simulateOfflineProgress } from './idle.js';
import { pickTicket, recordRecentFault } from './tickets.js';
import { mulberry32 } from './rng.js';
import { pickMotdFault, canPlayToday, getTodayDateStr, buildShareCard } from './motd.js';
import { ensureContract } from './contract.js';
import { click as sfxClick, jingle as sfxJingle, thunk as sfxThunk, stamp as sfxStamp, fanfare as sfxFanfare } from './audio.js';
import { prefersReducedMotion } from './utils.js';
import * as jobScreen from './ui/job.js';
import * as shopScreen from './ui/shop.js?v=2';
import * as motdScreen from './ui/motd.js';
import * as settingsScreen from './ui/settings.js';
import * as codexScreen from './ui/codex.js';


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

// Feedback messages for the settings modal. Transient.
let settingsExportMessage = null;
let settingsImportError = null;
let settingsOpen = false;



// Which top-level screen is showing. Transient on purpose — where you were
// browsing isn't game state, so a refresh lands back on home.
let screen = 'home';

// Tier just unlocked, for a one-time home-screen banner. Transient: the unlock
// itself is in state (player.tierUnlocked); only the fanfare is lost on refresh.
let justUnlockedTier = null;

// The first irreversible fix gets a lightweight inline confirmation. This is
// transient: progress stats decide who needs it, so saves stay unchanged.
let pendingFirstFixId = null;

// Expand/collapse state of the home <details> panels (prestige, workshop).
// Transient UI state, not game state: remembered across re-renders in this
// session so tapping a button inside a panel doesn't slam it shut.
const homePanels = { prestige: false, workshop: false };

// Selling the business wipes hours of purchases, so the button is two-step:
// the first tap arms this transient flag and the card re-renders with an
// explicit confirm/cancel (same pattern as pendingFirstFixId — never saved).
let prestigeConfirm = false;

// A correct fix earns a brief repair beat (GDD §2.3) shown before the invoice.
// Transient and purely cosmetic: the money is already settled inside commitFix
// (the settlement boundary), so a refresh mid-beat lands on home with cash
// banked — the reward is never duplicated nor lost by the beat.
let repairBeat = null;

function commitSelectedFix(fixId) {
  const result = commitFix(state, fixId, faults);
  pendingFirstFixId = null;
  if (result.motd) {
    motdResult = result;
    screen = 'motd';
  } else {
    invoice = result;
    if (result.unlockedTier) justUnlockedTier = result.unlockedTier;
    // Only a correct repair gets the satisfying "it works again" payoff.
    if (result.correct) repairBeat = { machineType: result.fault.machineType };
  }
  if (result.correct) sfxJingle(state.settings.audio);
  else sfxThunk(state.settings.audio);
  // A tier unlock or a completed daily contract is a bigger deal than a plain
  // fix — layer the fanfare on top rather than replacing the jingle/thunk.
  if (result.unlockedTier || result.contract?.justCompleted) sfxFanfare(state.settings.audio);
  save(state);
  render();
}

const actions = {
  nextTicket() {
    if (state.jobs.active) return; // a paused job must be resumed, not replaced
    justUnlockedTier = null;
    // A session can cross UTC midnight: refresh yesterday's contract before the
    // job starts so its progress lands on the right day's objective.
    ensureContract(state, machines);
    // Fresh tickets only — callbacks are never auto-claimed (GDD §3.1); the
    // player chooses them from the Callbacks list via takeCallback(). The
    // anti-repeat window (v15) keeps the last few faults out of the draw;
    // callbacks/MotD/workshop never touch it — they replay by design.
    const next = mulberry32(Date.now());
    const { fault, client } = pickTicket(faults, clients, state.player.tierUnlocked, next, state.jobs.recentFaultIds);
    startJob(state, fault, client.id, next);
    recordRecentFault(state.jobs.recentFaultIds, fault.id);
    screen = 'job';
    save(state);
    render();
  },
  goHome() {
    // The always-there status-bar Home (2026-07-08 playtest fix). An active
    // job simply pauses — it lives in state.jobs.active and home offers
    // Resume. A transient invoice/repair beat is dismissed (money already
    // settled at commit, so nothing is lost).
    invoice = null;
    repairBeat = null;
    pendingFirstFixId = null;
    screen = 'home';
    render();
  },
  resumeJob() {
    if (!state.jobs.active) return;
    screen = 'job';
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
    if (state.jobs.active) return; // paused job blocks a claim (startJob would throw)
    const cb = claimCallback(state, faults, Number(index));
    if (cb) {
      const next = mulberry32(Date.now());
      startJob(state, faults[cb.faultId], cb.clientId, next, {
        misses: cb.misses,
        source: cb.source,
        techId: cb.techId ?? null,
        techName: cb.techName ?? null,
        evidence: cb.evidence ?? null,
        variant: cb.variant ?? 0,
      });
      screen = 'job';
      save(state);
    }
    // A failed claim (stale/removed entry) just re-renders the updated list.
    render();
  },
  runTest(testId) {
    runTest(state, testId, faults);
    // Test results "stamp in" (2026-07-05 game-feel session): the visual is a
    // CSS animation on the fresh .test-result element; this is its sound half.
    sfxStamp(state.settings.audio);
    save(state);
    render();
  },
  chooseFix(fixId) {
    if (jobScreen.isFirstJobOnboarding(state)) {
      pendingFirstFixId = fixId;
      render();
      return;
    }
    commitSelectedFix(fixId);
  },
  confirmFirstFix() {
    if (!pendingFirstFixId) return;
    commitSelectedFix(pendingFirstFixId);
  },
  cancelFirstFix() {
    pendingFirstFixId = null;
    render();
  },
  dismissGuidance() {
    state.settings.guidanceMode = 'off';
    save(state);
    render();
  },
  goToDiagnostics() {
    app.querySelector('.diagnostics-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  finishRepair() {
    // Dismiss the repair beat to reveal the invoice. Idempotent: a double-fire
    // (skip + hold completing together) is harmless since the money is settled.
    repairBeat = null;
    render();
  },
  dismissInvoice() {
    invoice = null;
    render();
  },
  invoiceNextTicket() {
    // Straight from the receipt into the next job (2026-07-04 loop tightening).
    invoice = null;
    actions.nextTicket();
  },
  toggleHomePanel(panel, open) {
    // <details> already changed its own display; just remember it. No render.
    if (panel in homePanels) homePanels[panel] = !!open;
  },
  openCodex() {
    justUnlockedTier = null;
    screen = 'codex';
    render();
  },
  closeCodex() {
    screen = 'home';
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
  buyLadderItem(itemId) {
    const { ok, reason } = buyLadderItem(state, itemId);
    if (ok) save(state);
    else console.warn(`Cold Call: not bought: ${reason}`);
    render();
  },
  restockVan() {
    const { ok, reason } = restockVan(state);
    if (ok) save(state);
    else console.warn(`Cold Call: van not restocked: ${reason}`);
    render();
  },
  sellBusiness() {
    prestigeConfirm = true;
    homePanels.prestige = true; // keep the card open across the re-render
    render();
  },
  confirmSellBusiness() {
    prestigeConfirm = false;
    homePanels.prestige = false; // next unlock starts collapsed again
    try {
      prestige(state);
      save(state);
    } catch (e) {
      console.error(e.message);
    }
    render();
  },
  cancelSellBusiness() {
    prestigeConfirm = false;
    render();
  },
  buyWorkshopMachine(machineType) {
    // Pick a random fault for this machineType
    const matchingFaults = Object.values(faults).filter(f => f.machineType === machineType);
    const fault = matchingFaults.length > 0
      ? matchingFaults[Math.floor(Math.random() * matchingFaults.length)]
      : Object.values(faults)[0];
    const machineId = Math.random().toString(36).substring(2, 9);

    const { ok, reason } = buyWorkshopMachine(state, machineType, fault.id, machineId);
    if (ok) save(state);
    else console.warn(`Cold Call: machine not bought: ${reason}`);
    render();
  },
  repairWorkshopMachine(machineId) {
    if (state.jobs.active) return; // paused job must be resumed first
    const machine = state.workshop.machines.find(m => m.id === machineId);
    if (!machine || machine.status !== 'broken') return;
    const fault = faults[machine.faultId];
    if (!fault) return;

    const next = mulberry32(Date.now());
    startJob(state, fault, 'workshop-' + machine.id, next);
    screen = 'job';
    save(state);
    render();
  },
  sellWorkshopMachine(machineId) {
    const { ok, reason } = sellWorkshopMachine(state, machineId);
    if (ok) save(state);
    else console.warn(`Cold Call: machine not sold: ${reason}`);
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
    // puzzleDateStr stored on the job so settlement uses the start-day date
    // even if the player crosses UTC midnight before committing a fix.
    startJob(state, fault, 'motd', prng, null, true, todayStr);
    screen = 'job';
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
  async exportSave(inputEl) {
    const blob = exportSave(state);
    try {
      if (inputEl && inputEl.select) {
        inputEl.select();
      }
      await navigator.clipboard.writeText(blob);
      settingsExportMessage = 'Copied to clipboard.';
    } catch {
      if (inputEl && inputEl.select) {
        inputEl.select();
        document.execCommand('copy');
        settingsExportMessage = 'Copied to clipboard.';
      } else {
        window.prompt('Copy this to transfer your save to another device:', blob);
        settingsExportMessage = null;
      }
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
      settingsImportError = String(e.message ?? e);
      render();
    }
  },
  openSettings() {
    settingsExportMessage = null;
    settingsImportError = null;
    settingsOpen = true;
    render();
  },
  closeSettings() {
    settingsExportMessage = null;
    settingsImportError = null;
    settingsOpen = false;
    render();
  },
  toggleAudio() {
    state.settings.audio = !state.settings.audio;
    save(state);
    render();
  },
  setGuidanceMode(mode) {
    if (!['auto', 'on', 'off'].includes(mode)) return;
    state.settings.guidanceMode = mode;
    save(state);
    render();
  },
  resetProgress() {
    if (confirm("Are you sure you want to reset all game progress? This cannot be undone.")) {
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
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
    const result = motdResult ?? { ...state.motd.lastResult, streak: state.motd.streak };
    // Use the stored puzzle date (immune to UTC-midnight drift); fall back to
    // lastPlayedDate (same value, stored by settleMotd) then to today as a last resort.
    const dateStr =
      result.puzzleDateStr ??
      state.motd.lastResult?.puzzleDateStr ??
      state.motd.lastPlayedDate ??
      getTodayDateStr();
    const stats = {
      cleanStreak: state.stats.cleanStreak,
      callbackCount: state.jobs.callbacks.length,
    };
    const text = buildShareCard(result, dateStr, stats);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (non-secure context) — fall back to a prompt.
      window.prompt('Copy this result:', text);
    }
  },
};

/**
 * Identity of the view the next render will show — mirrors the routing in
 * render() and jobScreen.render(). Screen-to-screen view transitions only run
 * when this changes; intra-view re-renders (running a test, arming a confirm)
 * stay instant so per-element juice (stamp-in, count-up) is never doubled.
 */
function viewKey() {
  // Explicit navigation wins over an active job (2026-07-08 pause-and-resume):
  // the shop/codex/callbacks/home gates no longer require !state.jobs.active —
  // a mid-job visit pauses the job (it persists; home offers Resume). Repair
  // beat and invoice still take precedence: they're transient settlement UI.
  if (screen === 'motd') return 'motd';
  if (repairBeat) return 'repair';
  if (invoice) return 'invoice';
  if (screen === 'shop') return 'shop';
  if (screen === 'codex') return 'codex';
  if (screen === 'callbacks') return 'callbacks';
  if (state.jobs.active && screen !== 'home') return 'job';
  return 'home';
}

let lastViewKey = null;

function render() {
  const key = viewKey();
  // Animate whole-screen changes with the native View Transitions API where it
  // exists (no dependency, no fallback cost: unsupported browsers and
  // reduced-motion players get the plain instant swap they always had).
  const animate = lastViewKey !== null && key !== lastViewKey
    && typeof document.startViewTransition === 'function' && !prefersReducedMotion();
  lastViewKey = key;
  if (animate) document.startViewTransition(paint);
  else paint();
}

function paint() {
  // Mirrors viewKey() above — keep the two in sync or transitions misfire.
  if (screen === 'motd') {
    motdScreen.render(app, { state, motdResult, actions });
  } else if (screen === 'shop' && !repairBeat && !invoice) {
    shopScreen.render(app, { state, actions, exportMessage, importError });
  } else if (screen === 'codex' && !repairBeat && !invoice) {
    codexScreen.render(app, { state, faults, machines, actions });
  } else {
    jobScreen.render(app, {
      state,
      faults,
      machines,
      clients,
      invoice,
      repairBeat,
      justUnlockedTier,
      offlineReport,
      expiryReport,
      corruptSaveBlob,
      pendingFirstFixId,
      homePanels,
      prestigeConfirm,
      screen,
      actions,
    });
  }

  if (settingsOpen) {
    const modalHtml = settingsScreen.renderModal(state, {
      exportMessage: settingsExportMessage,
      importError: settingsImportError,
    });
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    const modalEl = tempDiv.firstElementChild;
    app.appendChild(modalEl);
    settingsScreen.wire(modalEl, actions);
  }
}

// One delegated listener gives every button a soft blip, gated on the audio
// setting at press time. The first enabled press also unlocks the
// AudioContext (it happens inside the user gesture).
app.addEventListener('click', (e) => {
  if (e.target.closest('button')) sfxClick(state.settings.audio);
});

// The status-bar Home button renders on every screen (statusBar in job.js),
// including shop/codex/motd which have their own wire() functions — one
// delegated listener here covers them all instead of five copies.
app.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="go-home"]')) actions.goHome();
});

// A save can hold an active job whose fault was since renamed/removed from the
// library. Don't strand the player: drop the job (no money moved), keep the save.
if (state.jobs.active && !faults[state.jobs.active.faultId]) {
  console.error(`Cold Call: active job references unknown fault "${state.jobs.active.faultId}"; abandoning the job.`);
  state.jobs.active = null;
}

// A save with a live job resumes straight into it — same behaviour as before
// pause-and-resume made 'home' possible alongside an active job.
if (state.jobs.active) screen = 'job';

// Expire stale callbacks and simulate offline progress before first render, so
// both reports are visible on home. Expire first: a callback can only fall off
// the board for being old, never for the new offline jobs queued this load.
expiryReport = expireCallbacks(state);
offlineReport = simulateOfflineProgress(state, faults);

// Generate (or refresh) today's contract before first render (GDD §5). After
// offline sim so a stale contract never absorbs credit from simulated jobs.
ensureContract(state, machines);

render();
save(state);
