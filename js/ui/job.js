/** @file Ticket/job screen: home ("next ticket"), active diagnosis, and invoice views.
 * Render-from-state: render() redraws everything from state + transient invoice;
 * all mutations happen in the actions passed in from main.js.
 */

import { TESTS, testAvailability, testResult, fixLabel } from '../diagnosis.js';
import { dueCallbacks, speedBonus } from '../economy.js';
import { DIAGNOSIS, JOBS } from '../../config/balance.js';
import { canPlayToday } from '../motd.js';
import { escapeHtml } from '../utils.js';
import { machineSvg } from '../machine-art.js';
import { clientPortraitSvg } from '../character-art.js';

/** Player-facing label for a callback's source (GDD §3.1). */
export function sourceLabel(callback) {
  if (callback?.source !== 'tech') return 'your miss';
  return typeof callback.techName === 'string' && callback.techName.trim()
    ? `${callback.techName.trim()}'s miss`
    : 'tech miss';
}

/** The net-payout rate a callback pays when fixed correctly, as a whole percent. */
function callbackRatePct(source) {
  const mult = source === 'tech' ? JOBS.rescueCallbackPayoutMult : JOBS.callbackJobPayoutMult;
  return Math.round(mult * 100);
}

/** First-ticket guidance is derived from existing progress, so saves need no new flag. */
export function isFirstJobOnboarding(state) {
  const job = state.jobs.active;
  return !!job
    && !job.callback
    && !job.motd
    && state.stats.jobsCompleted === 0
    && state.stats.callbacksCaused === 0;
}

/** Player-facing cost/consequence shown before a diagnostic is run. */
export function testCostCopy(job, testId) {
  const cost = DIAGNOSIS.testMinutes[testId] ?? 0;
  if (job.callback) return `+${cost} min simulated job time`;
  if (job.motd) return `+${cost} min simulated job time · adds 1 test to your score`;

  const before = speedBonus(job.minutesSpent ?? 0);
  const after = speedBonus((job.minutesSpent ?? 0) + cost);
  return `+${cost} min · speed bonus $${before} → $${after}`;
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
      <div class="game-brand">
        <div class="game-logo" aria-hidden="true">❄</div>
        <h1 class="game-wordmark"><span class="word-cold">Cold</span> <span class="word-call">Call</span></h1>
        <p class="game-tagline">Field tech. Frozen tech. Your problem now.</p>
      </div>
      <p class="game-stats">${state.stats.jobsCompleted} jobs completed${streak > 1 ? ` · ${streak} clean in a row` : ''}</p>
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
          <p class="callback-client">${client ? client.name : escapeHtml(cb.clientId)}</p>
          <p class="callback-meta">${escapeHtml(machineName)} · ${escapeHtml(sourceLabel(cb))} · pays ${callbackRatePct(cb.source)}% of net</p>
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

export function jobView({ state, faults, machines, clients, pendingFirstFixId = null }) {
  const job = state.jobs.active;
  const fault = faults[job.faultId];
  const machine = machines.find((m) => m.id === job.machineType);
  const client = clients.find((c) => c.id === job.clientId);
  const machineName = machine ? machine.name : job.machineType;

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
            <p class="test-meta">${testCostCopy(job, id)}</p>
            <p class="test-locked">${reason}</p>
          </li>`;
      }
      return `
        <li class="test-row">
          <button class="btn btn-test" data-test="${id}">${TESTS[id].label}</button>
          <p class="test-meta">${testCostCopy(job, id)}</p>
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
  const firstJob = isFirstJobOnboarding(state);
  const fixButtons = job.fixOptions
    .map((id) => `<button class="btn btn-fix" data-fix="${escapeHtml(id)}" ${outOfParts ? 'disabled' : ''}>${escapeHtml(fixLabel(id))}</button>`)
    .join('');
  const pendingFixLabel = pendingFirstFixId ? escapeHtml(fixLabel(pendingFirstFixId)) : '';

  const clientName = job.motd ? 'Machine of the Day' : (client ? escapeHtml(client.name) : escapeHtml(job.clientId));
  const safeMachineName = escapeHtml(machineName);
  const portrait = !job.motd && client ? clientPortraitSvg(client.portrait) : null;
  const contact = !job.motd && client?.contact ? client.contact : null;
  const contactName = contact?.name ? escapeHtml(contact.name) : 'Caller details unavailable';
  const contactRole = contact?.role ? escapeHtml(contact.role) : '';
  const contactFlavour = contact?.flavour ? escapeHtml(contact.flavour) : '';
  const portraitHtml = !job.motd
    ? `<div class="client-callout${portrait ? '' : ' client-callout--text-only'}">
        ${portrait ? `<div class="client-portrait">${portrait}</div>` : ''}
        <div class="client-copy">
          <p class="client-contact">${contactName}</p>
          ${contactRole ? `<p class="client-role">${contactRole}</p>` : ''}
          ${contactFlavour ? `<p class="client-flavour">"${contactFlavour}"</p>` : ''}
        </div>
      </div>`
    : '';

  // Art state: 'open' once the player has run at least one test (machine is being
  // inspected); 'fault' before that (machine showing symptoms, panel closed).
  const artState = job.testsRun.length > 0 ? 'open' : 'fault';
  const svg = machineSvg(job.machineType, artState);
  const artSlotClass = svg ? 'art-slot art-slot--has-image' : 'art-slot';
  const artSlotContent = svg ?? `[ ${safeMachineName} ]`;

  return `
    ${statusBar(state)}
    <section class="screen screen-job">
      <div class="panel">
        ${job.motd ? `<span class="badge badge--success">Machine of the Day</span>` : ''}
        ${job.callback ? `<span class="badge badge--warn">Callback — reduced rate</span>` : ''}
        <h2 class="job-client">${clientName}</h2>
        <p class="job-machine">${safeMachineName}</p>
        ${portraitHtml}
        ${clockBar}
      </div>

      <div class="${artSlotClass}" aria-hidden="true">${artSlotContent}</div>

      <div class="panel">
        <h3 class="panel-label">Reported symptoms</h3>
        ${firstJob ? `<div class="diagnosis-guide" aria-label="First job guide">
          <p><strong>1. Read the symptoms.</strong> They narrow down what failed.</p>
          <p><strong>2. Run useful tests.</strong> Evidence costs simulated minutes and reduces the speed bonus.</p>
          <p><strong>3. Commit one fix.</strong> That ends diagnosis; a wrong call returns as a reduced-rate callback.</p>
        </div>` : ''}
        <ul class="symptoms">${fault.symptoms.map((s) => `<li>${s}</li>`).join('')}</ul>
      </div>

      <div class="panel">
        <h3 class="panel-label">Diagnostics</h3>
        <ul class="tests">${testRows}</ul>
      </div>

      <div class="panel">
        <h3 class="panel-label">Commit fix</h3>
        ${firstJob && !pendingFirstFixId
          ? `<p class="fix-guidance">Choose when the evidence is strong enough. Your first selection gets one confirmation.</p>`
          : ''}
        ${outOfParts ? `<p class="job-no-parts">Van empty — restock before committing.</p>
          <button class="btn btn-restock" data-action="restock-van">Restock van</button>` : ''}
        ${pendingFirstFixId
          ? `<div class="first-fix-warning" role="alert">
              <p><strong>Commit ${pendingFixLabel}?</strong></p>
              <p>This ends diagnosis. A wrong fix causes a reduced-rate callback tomorrow.</p>
              <div class="first-fix-actions">
                <button class="btn btn-primary" data-action="confirm-first-fix">Commit fix</button>
                <button class="btn btn-sm" data-action="cancel-first-fix">Keep diagnosing</button>
              </div>
            </div>`
          : `<div class="fixes">${fixButtons}</div>`}
      </div>
    </section>`;
}

export function invoiceView({ state, invoice }) {
  const { correct, fault, earned, chosenFix, callback, callbackSource, unlockedTier } = invoice;

  let lineItems;
  let outcomeClass;
  let outcomeText;

  if (correct && callback) {
    outcomeClass = 'receipt-outcome--good';
    outcomeText = 'Fixed!';
    lineItems = `
      <div class="receipt-line"><span>Job payout</span><span>$${fault.payout}</span></div>
      <div class="receipt-line"><span>Parts</span><span>−$${fault.partsCost}</span></div>
      <div class="receipt-line"><span>${callbackSource === 'tech' ? 'Rescue rate' : 'Callback rate'}</span><span>×${callbackRatePct(callbackSource)}%</span></div>
      <div class="receipt-line receipt-line--total"><span>TOTAL</span><span>$${earned}</span></div>`;
  } else if (correct) {
    const bonus = speedBonus(invoice.minutesSpent ?? 0);
    outcomeClass = 'receipt-outcome--good';
    outcomeText = 'Fixed!';
    lineItems = `
      <div class="receipt-line"><span>Job payout</span><span>$${fault.payout}</span></div>
      <div class="receipt-line"><span>Parts</span><span>−$${fault.partsCost}</span></div>
      <div class="receipt-line"><span>Speed bonus</span><span>+$${bonus}</span></div>
      <div class="receipt-line receipt-line--total"><span>TOTAL</span><span>$${earned}</span></div>`;
  } else if (callback) {
    outcomeClass = 'receipt-outcome--bad';
    outcomeText = 'Callback.';
    lineItems = `
      <div class="receipt-line"><span>Repeat miss</span><span>$0</span></div>`;
  } else {
    outcomeClass = 'receipt-outcome--bad';
    outcomeText = 'Callback.';
    lineItems = `
      <div class="receipt-line"><span>Partial payout</span><span>$${earned}</span></div>`;
  }

  const receiptNote = (!correct && callback)
    ? `<p class="receipt-note">Wrong again — back on the board tomorrow. No charge.</p>`
    : (!correct)
      ? `<p class="receipt-note">Wrong call — that machine will be back tomorrow.</p>`
      : '';

  // Failure is a lesson (GDD §2.1): contrast the player's pick with the correct
  // fix and explain the discriminating clue so the next call is a better one.
  // The lesson is authored per fault; fall back to a generic prompt if absent.
  const lessonText = (typeof fault.lesson === 'string' && fault.lesson.trim())
    ? fault.lesson
    : `The fix was ${fixLabel(fault.correctFix)}. Re-read the symptoms and run the test that points to it.`;
  const learningBlock = !correct
    ? `<div class="failure-lesson">
         <p class="failure-lesson-title">Where it went wrong</p>
         <div class="failure-fixes">
           <p class="failure-fix failure-fix--chosen"><span class="failure-fix-label">You committed</span><span class="failure-fix-name">${escapeHtml(fixLabel(chosenFix))}</span></p>
           <p class="failure-fix failure-fix--correct"><span class="failure-fix-label">Correct fix</span><span class="failure-fix-name">${escapeHtml(fixLabel(fault.correctFix))}</span></p>
         </div>
         <p class="failure-why">${escapeHtml(lessonText)}</p>
         ${callback ? '' : `<p class="failure-followup">Your evidence so far is saved for the return visit.</p>`}
       </div>`
    : '';

  return `
    ${statusBar(state)}
    <section class="screen screen-invoice">
      <div class="receipt">
        <div class="receipt-header">— COLD CALL SERVICES —</div>
        <p class="receipt-outcome ${outcomeClass}">${outcomeText}</p>
        ${lineItems}
        ${receiptNote}
        ${unlockedTier ? `<p class="receipt-unlock">★ Tier ${unlockedTier} clients unlocked!</p>` : ''}
        ${correct ? `<p class="receipt-flavour">“${fault.flavour}”</p>` : ''}
      </div>
      ${learningBlock}
      <div class="invoice-actions">
        <button class="btn btn-primary" data-action="dismiss-invoice">Done</button>
      </div>
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
    el.addEventListener('click', () => actions.chooseFix(el.dataset.fix))
  );
  root.querySelectorAll('[data-action="confirm-first-fix"]').forEach((el) =>
    el.addEventListener('click', actions.confirmFirstFix)
  );
  root.querySelectorAll('[data-action="cancel-first-fix"]').forEach((el) =>
    el.addEventListener('click', actions.cancelFirstFix)
  );
}
