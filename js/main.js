/** @file Boot and screen routing: load save + fault library, route between home/job/invoice. */

import { load, save } from './state.js';
import { loadGameData } from './faults.js';
import { startJob, runTest, commitFix } from './diagnosis.js';
import { mulberry32 } from './rng.js';
import * as jobScreen from './ui/job.js';

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

const actions = {
  nextTicket() {
    // Random ticket for this slice; tier gating and real ticket generation come later.
    const next = mulberry32(Date.now());
    const ids = Object.keys(faults);
    const fault = faults[ids[Math.floor(next() * ids.length)]];
    startJob(state, fault, clients[0].id, next);
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
};

function render() {
  jobScreen.render(app, { state, faults, machines, clients, invoice, actions });
}

// A save can hold an active job whose fault was since renamed/removed from the
// library. Don't strand the player: drop the job (no money moved), keep the save.
if (state.jobs.active && !faults[state.jobs.active.faultId]) {
  console.error(`Cold Call: active job references unknown fault "${state.jobs.active.faultId}"; abandoning the job.`);
  state.jobs.active = null;
}

render();
save(state);
