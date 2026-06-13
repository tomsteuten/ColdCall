/** @file Ticket/job screen: home ("next ticket"), active diagnosis, and invoice views.
 * Render-from-state: render() redraws everything from state + transient invoice;
 * all mutations happen in the actions passed in from main.js.
 */

import { TESTS, testAvailability, testResult, fixLabel } from '../diagnosis.js';
import { dueCallbacks, speedBonus } from '../economy.js';
import { JOBS } from '../../config/balance.js';
import { canPlayToday } from '../motd.js';

/** Player-facing label for a callback's source (GDD §3.1). */
function sourceLabel(source) {
  return source === 'tech' ? "Dave's miss" : 'your miss';
}

/** The net-payout rate a callback pays when fixed correctly, as a whole percent. */
function callbackRatePct(source) {
  const mult = source === 'tech' ? JOBS.rescueCallbackPayoutMult : JOBS.callbackJobPayoutMult;
  return Math.round(mult * 100);
}

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
 * @param {object|null} ctx.offlineReport result of simulateOfflineProgress on this load, transient
 * @param {{nextTicket: function, runTest: function(string), commitFix: function(string),
 *   dismissInvoice: function, dismissOfflineReport: function}} ctx.actions
 */
export function render(root, ctx) {
  const { state, invoice, screen } = ctx;
  if (invoice) {
    root.innerHTML = invoiceView(ctx);
  } else if (state.jobs.active) {
    root.innerHTML = jobView(ctx);
  } else if (screen === 'callbacks') {
    root.innerHTML = callbacksView(ctx);
  } else {
    root.innerHTML = homeView(ctx);
  }
  wire(root, ctx.actions);
}


/** Cash/reputation/van header shown on every view (shop.js imports it too). */
export function statusBar(state) {
  const parts = state.van.stock['generic-parts'] ?? 0;
  const slots = state.van.slots;
  const vanDim = parts === 0 ? ' stat-warn' : ' stat-dim';
  return `
    <header class="status-bar">
      <span class="stat">$${state.player.cash}</span>
      <span class="stat stat-dim">Rep ${state.player.reputation}</span>
      <span class="stat${vanDim}">Van ${parts}/${slots}</span>
    </header>`;
}

function homeView({ state, justUnlockedTier, offlineReport, expiryReport, corruptSaveBlob }) {
  const streak = state.stats.cleanStreak;
  const due = dueCallbacks(state).length;
  const unlockBanner =
    justUnlockedTier === 2
      ? `<p class="home-unlock">Tier 2 unlocked — Burgertown is calling.</p>`
      : justUnlockedTier
        ? `<p class="home-unlock">Tier ${justUnlockedTier} clients unlocked.</p>`
        : '';

  const motdPlayed = !canPlayToday(state);
  const motdResult = state.motd.lastResult;
  const motdSection = motdPlayed && motdResult
    ? `<button class="btn btn-motd" data-action="open-motd-result">
         Machine of the Day ${motdResult.solved ? '✅' : '❌'}
         ${state.motd.streak > 1 ? ` · 🔥${state.motd.streak}` : ''}
       </button>`
    : `<button class="btn btn-motd" data-action="start-motd">Machine of the Day</button>`;

  const offlineBanner = offlineReport
    ? `<div class="home-offline-report">
         <p class="home-offline-title">While you were away</p>
         <p class="home-offline-detail">${offlineReport.jobsDone} job${offlineReport.jobsDone !== 1 ? 's' : ''} done · $${offlineReport.totalEarned} earned${offlineReport.callbacksAdded > 0 ? ` · ${offlineReport.callbacksAdded} new callback${offlineReport.callbacksAdded !== 1 ? 's' : ''}` : ''}</p>
         <button class="btn btn-sm" data-action="dismiss-offline-report">Dismiss</button>
       </div>`
    : '';

  const corruptBanner = corruptSaveBlob
    ? `<div class="corrupt-banner">
         <p class="corrupt-title">Save file couldn't be loaded</p>
         <p class="corrupt-detail">Your previous save is preserved in storage, untouched. Copy the raw blob to try recovering it after a game update.</p>
         <button class="btn btn-sm" data-action="copy-corrupt-save">Copy raw save blob</button>
       </div>`
    : '';

  const expiryBanner = expiryReport
    ? `<div class="home-expiry-report">
         <p class="home-expiry-title">Callbacks expired</p>
         <p class="home-expiry-detail">${expiryReport.count} callback${expiryReport.count !== 1 ? 's' : ''} dropped off the board${expiryReport.repPenalty > 0 ? ` · −${expiryReport.repPenalty} rep` : ''}.${expiryReport.playerExpired > 0 ? ' Those clients gave up waiting.' : ''}</p>
         <button class="btn btn-sm" data-action="dismiss-expiry-report">Dismiss</button>
       </div>`
    : '';

  return `
    ${statusBar(state)}
    <section class="screen screen-home">
      <h1 class="dev-title">Cold Call</h1>
      <p class="dev-meta">${state.stats.jobsCompleted} jobs done${streak > 1 ? ` · ${streak} clean in a row` : ''}</p>
      ${unlockBanner}
      ${corruptBanner}
      ${offlineBanner}
      ${expiryBanner}
      <button class="btn btn-primary" data-action="next-ticket">Next ticket</button>
      ${due > 0 ? `<button class="btn btn-callbacks" data-action="open-callbacks">Callbacks (${due})</button>` : ''}
      ${motdSection}
      <button class="btn" data-action="open-shop">Tools shop</button>
      ${(state.van.stock['generic-parts'] ?? 0) < state.van.slots
        ? `<button class="btn btn-restock" data-action="restock-van">Restock van</button>`
        : ''}
    </section>`;
}

/** The Callbacks list — due callbacks the player can choose to take (GDD §3.1). */
function callbacksView({ state, faults, clients }) {
  const today = new Date().toISOString().slice(0, 10);
  // Render from the full queue so each row's data-index matches what
  // claimCallback() splices; only due entries get a Take button.
  const rows = state.jobs.callbacks
    .map((cb, index) => ({ cb, index }))
    .filter(({ cb }) => cb.dueDay <= today)
    .map(({ cb, index }) => {
      const fault = faults[cb.faultId];
      const client = clients.find((c) => c.id === cb.clientId);
      const raw = fault ? fault.machineType.replace(/-/g, ' ') : cb.faultId;
      const machineName = raw.charAt(0).toUpperCase() + raw.slice(1);
      return `
        <li class="callback-card">
          <p class="callback-client">${client ? client.name : cb.clientId}</p>
          <p class="callback-meta">${machineName} · ${sourceLabel(cb.source)} · pays ${callbackRatePct(cb.source)}% of net</p>
          <button class="btn btn-callback-take" data-take="${index}">Take callback</button>
        </li>`;
    })
    .join('');

  return `
    ${statusBar(state)}
    <section class="screen screen-callbacks">
      <h2 class="section-title">Callbacks</h2>
      <p class="callbacks-intro">Machines back on the board. Tech misses pay near full; your own misses pay the reduced rate.</p>
      ${rows ? `<ul class="callbacks-list">${rows}</ul>` : `<p class="callbacks-empty">No callbacks due right now.</p>`}
      <button class="btn" data-action="close-callbacks">Back</button>
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

  // Make the speed/thoroughness trade-off visible before each test (GDD §2.1).
  // Only fresh, non-MotD jobs earn the bonus — callbacks are already discounted
  // and MotD pays no cash, so showing a dollar bonus there would mislead.
  const minutes = job.minutesSpent ?? 0;
  const clockBar = !job.callback && !job.motd
    ? `<p class="job-clock">Job clock: ${minutes} min · Speed bonus: <strong>$${speedBonus(minutes)}</strong></p>`
    : '';

  const outOfParts = fault.partsCost > 0 && (state.van.stock['generic-parts'] ?? 0) < 1;
  const fixButtons = job.fixOptions
    .map((id) => `<button class="btn btn-fix" data-fix="${id}" ${outOfParts ? 'disabled' : ''}>${fixLabel(id)}</button>`)
    .join('');

  return `
    ${statusBar(state)}
    <section class="screen screen-job">
      ${job.motd ? `<p class="job-motd-tag">Machine of the Day — no cash, just bragging rights</p>` : ''}
      <h2 class="job-client">${job.motd ? 'Machine of the Day' : (client ? client.name : job.clientId)}</h2>
      <p class="job-machine">${machine ? machine.name : job.machineType}</p>
      ${job.callback ? `<p class="job-callback-tag">Callback — reduced rate, same machine</p>` : ''}
      ${clockBar}

      <h3 class="section-head">Reported symptoms</h3>
      <ul class="symptoms">${fault.symptoms.map((s) => `<li>${s}</li>`).join('')}</ul>

      <h3 class="section-head">Run tests</h3>
      <ul class="tests">${testRows}</ul>

      <h3 class="section-head">Commit to a fix</h3>
      ${outOfParts ? `<p class="job-no-parts">Van empty — restock before committing.</p>
        <button class="btn btn-restock" data-action="restock-van">Restock van</button>` : ''}
      <div class="fixes">${fixButtons}</div>
    </section>`;
}

function invoiceView({ state, invoice }) {
  const { correct, fault, earned, callback, callbackSource, unlockedTier } = invoice;
  let lines;
  if (correct && callback) {
    lines = `<p class="invoice-line">Job payout <span>$${fault.payout}</span></p>
       <p class="invoice-line">Parts <span>−$${fault.partsCost}</span></p>
       <p class="invoice-line">${callbackSource === 'tech' ? 'Rescue rate' : 'Callback rate'} <span>×${callbackRatePct(callbackSource)}%</span></p>`;
  } else if (correct) {
    const bonus = speedBonus(invoice.minutesSpent ?? 0);
    lines = `<p class="invoice-line">Job payout <span>$${fault.payout}</span></p>
       <p class="invoice-line">Parts <span>−$${fault.partsCost}</span></p>
       <p class="invoice-line">Speed bonus <span>+$${bonus}</span></p>`;
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
  root.querySelectorAll('[data-action="start-motd"]').forEach((el) =>
    el.addEventListener('click', actions.startMotd)
  );
  root.querySelectorAll('[data-action="open-motd-result"]').forEach((el) =>
    el.addEventListener('click', actions.openMotdResult)
  );
  root.querySelectorAll('[data-action="restock-van"]').forEach((el) =>
    el.addEventListener('click', actions.restockVan)
  );
  root.querySelectorAll('[data-action="dismiss-offline-report"]').forEach((el) =>
    el.addEventListener('click', actions.dismissOfflineReport)
  );
  root.querySelectorAll('[data-action="dismiss-expiry-report"]').forEach((el) =>
    el.addEventListener('click', actions.dismissExpiryReport)
  );
  root.querySelectorAll('[data-action="open-callbacks"]').forEach((el) =>
    el.addEventListener('click', actions.openCallbacks)
  );
  root.querySelectorAll('[data-action="close-callbacks"]').forEach((el) =>
    el.addEventListener('click', actions.closeCallbacks)
  );
  root.querySelectorAll('[data-action="copy-corrupt-save"]').forEach((el) =>
    el.addEventListener('click', actions.copyCorruptSave)
  );
  root.querySelectorAll('[data-take]').forEach((el) =>
    el.addEventListener('click', () => actions.takeCallback(el.dataset.take))
  );
  root.querySelectorAll('[data-test]').forEach((el) =>
    el.addEventListener('click', () => actions.runTest(el.dataset.test))
  );
  root.querySelectorAll('[data-fix]').forEach((el) =>
    el.addEventListener('click', () => actions.commitFix(el.dataset.fix))
  );
}
