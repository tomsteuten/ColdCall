/** @file Boot and screen routing: load save + fault library, route between home/job/invoice. */

import { load, save } from './state.js';
import { loadGameData } from './faults.js';
import { startJob, runTest, commitFix } from './diagnosis.js';
import { buyTool } from './economy.js';
import { pickTicket } from './tickets.js';
import { mulberry32 } from './rng.js';
import * as jobScreen from './ui/job.js';
import * as shopScreen from './ui/shop.js';

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

// Which top-level screen is showing. Transient on purpose — where you were
// browsing isn't game state, so a refresh lands back on home.
let screen = 'home';

const actions = {
  nextTicket() {
    // Random (fault, same-tier client) pair; tier gating comes with reputation later.
    const next = mulberry32(Date.now());
    const { fault, client } = pickTicket(faults, clients, next);
    startJob(state, fault, client.id, next);
    save(state);
    render();
  },
  runTest(testId) {
    runTest(state, testId, faults);
    save(state);
    render();
  },
  commitFix(fixId) {
    invoice = commitFix(state, fixId, faults);
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
};

function render() {
  // An active job or pending invoice always wins over the shop.
  if (screen === 'shop' && !state.jobs.active && !invoice) {
    shopScreen.render(app, { state, actions });
  } else {
    jobScreen.render(app, { state, faults, machines, clients, invoice, actions });
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
