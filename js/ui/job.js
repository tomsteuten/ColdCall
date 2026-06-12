/** @file Ticket/job screen: home ("next ticket"), active diagnosis, and invoice views.
 * Render-from-state: render() redraws everything from state + transient invoice;
 * all mutations happen in the actions passed in from main.js.
 */

import { TESTS, testAvailability, testResult, fixLabel } from '../diagnosis.js';
import { dueCallbacks } from '../economy.js';

/**
 * Render the job flow into root.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {object} ctx.state game state
 * @param {Object<string, object>} ctx.faults fault library keyed by id
 * @param {object[]} ctx.machines from machines.json
 * @param {object[]} ctx.clients from clients.json
 * @param {object|null} ctx.invoice transient result of the last commitFix, not persisted
 * @param {number|null} ctx.justUnlockedTier tier unlocked this session, for a one-time banner
 * @param {{nextTicket: function, runTest: function(string), commitFix: function(string), dismissInvoice: function}} ctx.actions
 */
export function render(root, ctx) {
  const { state, invoice } = ctx;
  if (invoice) {
    root.innerHTML = invoiceView(ctx);
  } else if (state.jobs.active) {
    root.innerHTML = jobView(ctx);
  } else {
    root.innerHTML = homeView(ctx);
  }
  wire(root, ctx.actions);
}

/** Cash/reputation header shown on every view (shop.js imports it too). */
export function statusBar(state) {
  return `
    <header class="status-bar">
      <span class="stat">$${state.player.cash}</span>
      <span class="stat stat-dim">Rep ${state.player.reputation}</span>
    </header>`;
}

function homeView({ state, justUnlockedTier }) {
  const streak = state.stats.cleanStreak;
  const due = dueCallbacks(state).length;
  const unlockBanner =
    justUnlockedTier === 2
      ? `<p class="home-unlock">Tier 2 unlocked — Burgertown is calling.</p>`
      : justUnlockedTier
        ? `<p class="home-unlock">Tier ${justUnlockedTier} clients unlocked.</p>`
        : '';
  return `
    ${statusBar(state)}
    <section class="screen screen-home">
      <h1 class="dev-title">Cold Call</h1>
      <p class="dev-meta">${state.stats.jobsCompleted} jobs done${streak > 1 ? ` · ${streak} clean in a row` : ''}</p>
      ${unlockBanner}
      ${due > 0 ? `<p class="home-callbacks">${due} callback${due > 1 ? 's' : ''} waiting</p>` : ''}
      <button class="btn btn-primary" data-action="next-ticket">${due > 0 ? 'Take callback' : 'Next ticket'}</button>
      <button class="btn" data-action="open-shop">Tools shop</button>
    </section>`;
}

function jobView({ state, faults, machines, clients }) {
  const job = state.jobs.active;
  const fault = faults[job.faultId];
  const machine = machines.find((m) => m.id === job.machineType);
  const client = clients.find((c) => c.id === job.clientId);

  const testRows = Object.keys(TESTS)
    .map((id) => {
      const { available, reason } = testAvailability(state, id);
      if (job.testsRun.includes(id)) {
        return `
          <li class="test-row">
            <span class="test-label">${TESTS[id].label}</span>
            <p class="test-result">${testResult(job, id, faults)}</p>
          </li>`;
      }
      if (!available) {
        return `
          <li class="test-row">
            <button class="btn btn-test" disabled>${TESTS[id].label}</button>
            <p class="test-locked">${reason}</p>
          </li>`;
      }
      return `
        <li class="test-row">
          <button class="btn btn-test" data-test="${id}">${TESTS[id].label}</button>
        </li>`;
    })
    .join('');

  const fixButtons = job.fixOptions
    .map((id) => `<button class="btn btn-fix" data-fix="${id}">${fixLabel(id)}</button>`)
    .join('');

  return `
    ${statusBar(state)}
    <section class="screen screen-job">
      <h2 class="job-client">${client ? client.name : job.clientId}</h2>
      <p class="job-machine">${machine ? machine.name : job.machineType}</p>
      ${job.callback ? `<p class="job-callback-tag">Callback — reduced rate, same machine</p>` : ''}

      <h3 class="section-head">Reported symptoms</h3>
      <ul class="symptoms">${fault.symptoms.map((s) => `<li>${s}</li>`).join('')}</ul>

      <h3 class="section-head">Run tests</h3>
      <ul class="tests">${testRows}</ul>

      <h3 class="section-head">Commit to a fix</h3>
      <div class="fixes">${fixButtons}</div>
    </section>`;
}

function invoiceView({ state, invoice }) {
  const { correct, fault, earned, callback, unlockedTier } = invoice;
  let lines;
  if (correct && callback) {
    // earned = callback rate minus parts, so the rate line is reconstructable.
    lines = `<p class="invoice-line">Callback rate <span>$${earned + fault.partsCost}</span></p>
       <p class="invoice-line">Parts <span>−$${fault.partsCost}</span></p>`;
  } else if (correct) {
    lines = `<p class="invoice-line">Job payout <span>$${fault.payout}</span></p>
       <p class="invoice-line">Parts <span>−$${fault.partsCost}</span></p>`;
  } else if (callback) {
    lines = `<p class="invoice-line">Repeat miss <span>$0</span></p>
       <p class="invoice-note">Wrong again — that machine is back on the board tomorrow, and they're not paying twice.</p>`;
  } else {
    lines = `<p class="invoice-line">Partial payout <span>$${earned}</span></p>
       <p class="invoice-note">Wrong call — that machine will be back on the board tomorrow.</p>`;
  }
  return `
    ${statusBar(state)}
    <section class="screen screen-invoice ${correct ? 'invoice-good' : 'invoice-bad'}">
      <h2>${correct ? 'Fixed!' : 'Callback.'}</h2>
      ${lines}
      ${unlockedTier ? `<p class="invoice-unlock">Reputation milestone — Tier ${unlockedTier} clients unlocked!</p>` : ''}
      <p class="invoice-total">You earned <strong>$${earned}</strong></p>
      ${correct ? `<p class="invoice-flavour">“${fault.flavour}”</p>` : ''}
      <button class="btn btn-primary" data-action="dismiss-invoice">Done</button>
    </section>`;
}

/** Attach click handlers for the data-* hooks rendered above. */
function wire(root, actions) {
  root.querySelectorAll('[data-action="next-ticket"]').forEach((el) =>
    el.addEventListener('click', actions.nextTicket)
  );
  root.querySelectorAll('[data-action="dismiss-invoice"]').forEach((el) =>
    el.addEventListener('click', actions.dismissInvoice)
  );
  root.querySelectorAll('[data-action="open-shop"]').forEach((el) =>
    el.addEventListener('click', actions.openShop)
  );
  root.querySelectorAll('[data-test]').forEach((el) =>
    el.addEventListener('click', () => actions.runTest(el.dataset.test))
  );
  root.querySelectorAll('[data-fix]').forEach((el) =>
    el.addEventListener('click', () => actions.commitFix(el.dataset.fix))
  );
}
