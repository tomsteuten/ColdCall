/** @file Ticket/job screen: home ("next ticket"), active diagnosis, and invoice views.
 * Render-from-state: render() redraws everything from state + transient invoice;
 * all mutations happen in the actions passed in from main.js.
 */

import { TESTS, testAvailability, testResult, testLabel, fixLabel, jobSymptoms, eliminatedFix } from '../diagnosis.js';
import { dueCallbacks, earnedSpeedBonus, WORKSHOP_MACHINES } from '../economy.js';

import { DIAGNOSIS, JOBS, REPUTATION, PRESTIGE, STARTING } from '../../config/balance.js';
import { canPlayToday, nextPuzzleCountdown, streakAtRisk } from '../motd.js';
import { escapeHtml, prefersReducedMotion } from '../utils.js';
import { mulberry32 } from '../rng.js';
import { machineImageSrc, machineSvg } from '../machine-art.js';
import { clientPortraitImageSrc, clientPortraitSvg } from '../character-art.js';

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

/** Whole UTC days from one "YYYY-MM-DD" string to another (toStr − fromStr), or null if unparseable. */
function dayDelta(fromStr, toStr) {
  const a = Date.parse(`${fromStr}T00:00:00Z`);
  const b = Date.parse(`${toStr}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/** "today" / "tomorrow" / "in N days" for a target date relative to today (clamped at >= today). */
function relativeDayPhrase(today, target) {
  const d = dayDelta(today, target);
  if (d === null) return 'soon';
  if (d <= 0) return 'today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}

/**
 * Pick the contact's flavour line for this job. Machine-specific pools only
 * enter the draw on that machine's tickets (so "the ice dispenser is down"
 * can't caption a froyo call), merged with the client's default pool. Seeded
 * on the job's fault+client so the same ticket always shows the same line
 * (rule 6) while different tickets rotate through the pool. Falls back to the
 * legacy single `flavour` string when no pools are defined.
 * @param {object|null} contact client.contact from clients.json
 * @param {{faultId: string, clientId: string, machineType: string}} job
 * @returns {string} the line, or '' when the contact has none
 */
export function contactFlavourLine(contact, job) {
  const lines = contact?.flavourLines;
  const pool = [
    ...(Array.isArray(lines?.[job.machineType]) ? lines[job.machineType] : []),
    ...(Array.isArray(lines?.default) ? lines.default : []),
  ];
  if (pool.length === 0) return typeof contact?.flavour === 'string' ? contact.flavour : '';
  return pool[Math.floor(mulberry32(`${job.faultId}:${job.clientId}`)() * pool.length)];
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

  // The bonus is gated on running at least one test (GDD §2.1), so the first
  // test UNLOCKS it — the preview shows $0 → $36, an incentive, not a cost.
  const testsSoFar = job.testsRun.length;
  const before = earnedSpeedBonus(job.minutesSpent ?? 0, testsSoFar);
  const after = earnedSpeedBonus((job.minutesSpent ?? 0) + cost, testsSoFar + 1);
  return `+${cost} min · speed bonus $${before} → $${after}`;
}

/** Small ambient DOM particles (steam/frost) drifting over the art slot.
 * Pure CSS-driven (no JS animation loop) so it stays cheap on a phone;
 * `.art-particles` is hidden under prefers-reduced-motion in main.css. */
function artParticlesHtml() {
  return `<span class="art-particles" aria-hidden="true">
    <span class="art-particle"></span>
    <span class="art-particle"></span>
    <span class="art-particle"></span>
    <span class="art-particle"></span>
  </span>`;
}

/**
 * Shared art-slot markup for the job and repair views: picks raster or SVG
 * art for the given machine+state and wraps it with the shared motion/
 * particle layer so both views stay visually identical.
 * @param {string} machineType
 * @param {string} artState 'fault' | 'open' | 'working'
 * @param {string} graphicsMode state.settings.graphicsMode
 * @param {{fallback?: string, glow?: boolean}} [opts] fallback text for an
 *   unknown machine; glow adds the one-shot correct-fix flash (repair view only)
 */
function artSlotHtml(machineType, artState, graphicsMode, opts = {}) {
  const { fallback = '', glow = false } = opts;
  const imageSrc = machineImageSrc(machineType, artState, graphicsMode);
  const svg = imageSrc ? null : machineSvg(machineType, artState);
  const machineClass = String(machineType).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const hasArt = Boolean(imageSrc || svg);
  const artSlotClass = hasArt
    ? `art-slot art-slot--has-image machine-stage${imageSrc ? ' machine-stage--raster' : ''} machine-stage--${machineClass} machine-stage--${artState}`
    : 'art-slot';
  const content = imageSrc
    ? `<img class="machine-art" src="${imageSrc}" alt="" width="768" height="480">`
    : (svg ?? fallback);
  return `<div class="${artSlotClass}" aria-hidden="true">
    ${content}
    ${hasArt ? artParticlesHtml() : ''}
    ${glow ? '<span class="repair-glow" aria-hidden="true"></span>' : ''}
  </div>`;
}

/** Escalating clean-streak flame (GDD §5 daily hooks territory) — a small CSS
 * icon, not emoji (DESIGN.md anti-pattern), tiered at 5/10/20 so a long streak
 * reads as visibly hotter without changing the underlying number's meaning. */
function streakFlameHtml(streak) {
  if (streak < 5) return '';
  const tier = streak >= 20 ? 3 : streak >= 10 ? 2 : 1;
  return `<span class="streak-flame streak-flame--${tier}" title="${streak} clean in a row" aria-hidden="true">
    <svg viewBox="0 0 12 16" width="12" height="16"><path d="M6 0c1 2.5-2 3.5-2 6.5A2 2 0 0 0 6 8.5 2 2 0 0 0 8 6.5c1 1 1.5 2.3 1.5 3.5A3.5 3.5 0 0 1 6 13.5 3.5 3.5 0 0 1 2.5 10c0-3 2.5-4 3.5-10z" fill="currentColor"/></svg>
  </span>`;
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
  const { state, invoice, repairBeat, screen } = ctx;
  if (repairBeat) {
    // The repair beat precedes the invoice: settlement already happened, this is
    // the "it works again" payoff before the receipt (GDD §2.3).
    root.innerHTML = repairView(ctx);
  } else if (invoice) {
    root.innerHTML = invoiceView(ctx);
    wireInvoiceJuice(root);
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
  // Progress to the next client tier lives in the header (2026-07-04): the rep
  // number alone never told the player what it was FOR.
  const rep = state.player.reputation;
  const nextTier = state.player.tierUnlocked + 1;
  const threshold = REPUTATION.tierThresholds[nextTier];
  const repLabel =
    threshold !== undefined
      ? `Rep ${rep} · ${Math.max(0, threshold - rep)} to Tier ${nextTier}`
      : `Rep ${rep}`;
  return `
    <header class="status-bar">
      <span class="stat">$${state.player.cash.toLocaleString('en-US')}</span>
      <span class="stat stat-dim">${repLabel}</span>
      <span class="stat${vanDim}">Van ${parts}/${slots}</span>
    </header>`;
}

export function homeView({ state, faults, machines = [], justUnlockedTier, offlineReport, expiryReport, corruptSaveBlob, homePanels, prestigeConfirm }) {
  const streak = state.stats.cleanStreak;
  const total = state.jobs.callbacks.length;
  const due = dueCallbacks(state).length;
  const pending = total - due; // queued but not yet returned (e.g. tonight's tech misses)
  // Distinguish ready-to-take from not-yet-due so a freshly-queued callback the
  // offline report just announced is visibly "returning soon", not vanished.
  const callbackLabel =
    due > 0 && pending > 0
      ? `Callbacks (${due} ready · ${pending} soon)`
      : due > 0
        ? `Callbacks (${due})`
        : `Callbacks (${pending} returning soon)`;
  const unlockBanner =
    justUnlockedTier === 2
      ? `<p class="home-unlock celebration-card">Tier 2 unlocked — Burgertown is calling.</p>`
      : justUnlockedTier
        ? `<p class="home-unlock celebration-card">Tier ${justUnlockedTier} clients unlocked.</p>`
        : '';

  const motdPlayed = !canPlayToday(state);
  const motdResult = state.motd.lastResult;
  // Emoji are share-card flavour, not UI (2026-07-04): played state uses the
  // design-system badges instead of ✅/❌/🔥. Daily comeback hooks (GDD §5):
  // the played state counts down to the next puzzle; the unplayed state warns
  // when yesterday's streak dies at UTC midnight.
  const atRisk = streakAtRisk(state);
  const motdSection = motdPlayed && motdResult
    ? `<button class="btn btn-motd" data-action="open-motd-result">
         Machine of the Day
         <span class="badge ${motdResult.solved ? 'badge--success' : 'badge--warn'}">${motdResult.solved ? 'Solved' : 'Missed'}</span>
         ${state.motd.streak > 1 ? `<span class="badge">Streak ${state.motd.streak}</span>` : ''}
         <span class="btn-subtext">New puzzle in ${nextPuzzleCountdown()}</span>
       </button>`
    : `<button class="btn btn-motd" data-action="start-motd">
         Machine of the Day
         ${atRisk > 0 ? `<span class="badge badge--warn">${atRisk}-day streak at risk</span>` : ''}
       </button>`;

  // Today's contract (GDD §5): the second daily hook, right under MotD. State
  // is pinned at generation; render only shows today's (a stale one regenerates
  // on the next action boundary, so hide it rather than lie about the date).
  const contract = state.contract;
  const contractIsToday = contract && contract.date === new Date(Date.now()).toISOString().slice(0, 10);
  const contractMachine = contractIsToday
    ? (machines.find((m) => m.id === contract.machineType)?.name ?? contract.machineType.replace(/-/g, ' '))
    : null;
  const contractSection = contractIsToday
    ? `<div class="home-contract${contract.paid ? ' home-contract--done' : ''}">
         <p class="home-contract-title">Today's contract</p>
         <p class="home-contract-body">
           Fix ${contract.count} × ${escapeHtml(contractMachine)} · +$${contract.reward.toLocaleString('en-US')}
           ${contract.paid
             ? `<span class="badge badge--success">Complete</span>`
             : `<span class="badge">${contract.progress}/${contract.count}</span>`}
         </p>
       </div>`
    : '';

  const offlineBanner = offlineReport
    ? (() => {
        const r = offlineReport;
        // Per-tech lines reconcile arithmetically with the totals (2026-07-04):
        // fixed + missed = attempts per tech; the totals sum the fixed counts
        // and dollars, so "Dave: 8 fixed · 4 missed · $400" always adds up.
        const techLines = (r.techReports ?? [])
          .map((t) => {
            const missed = t.callbacks ?? 0;
            const fixed = t.jobs - missed;
            return `<li class="home-offline-tech">${escapeHtml(t.name)}: ${fixed} fixed · ${missed} missed · $${t.earned}</li>`;
          })
          .join('');
        // Offline callbacks return tomorrow, not now — say so, so the home count's
        // "returning soon" entry doesn't read like it appeared then disappeared.
        const callbackNote =
          r.callbacksAdded > 0
            ? `<p class="home-offline-callbacks">${r.callbacksAdded} missed job${r.callbacksAdded !== 1 ? 's' : ''} — back on the board tomorrow, claim from Callbacks.</p>`
            : '';
        return `<div class="home-offline-report">
         <p class="home-offline-title">While you were away</p>
         ${techLines ? `<ul class="home-offline-techs">${techLines}</ul>` : ''}
         <p class="home-offline-detail">${r.jobsDone} fixed · $${r.totalEarned} earned in total</p>
         ${callbackNote}
         <button class="btn btn-sm" data-action="dismiss-offline-report">Dismiss</button>
       </div>`;
      })()
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

  const bonusPct = ((state.player.founderBonus || 1.0) * 100).toFixed(0);

  const bonusCopy = state.player.founderBonus > 1.0 ? ` · Founder Bonus: ${bonusPct}%` : '';



  const prestigeBonusGained = Math.max(0, state.player.reputation) * PRESTIGE.bonusPerRep;
  const currentFounderBonus = state.player.founderBonus || 1.0;
  const nextFounderBonus = currentFounderBonus + prestigeBonusGained;

  // Compact one-line banner, expanding on tap (2026-07-04 home tightening):
  // the full sales pitch was crowding the ticket loop off the screen. Open
  // state is transient UI state, remembered across re-renders via homePanels.
  // Selling is hours of purchases gone in one go, so the card must make the
  // trade legible (what survives, what the new owners keep) and the button is
  // two-step — armed via the transient prestigeConfirm flag, never one tap
  // (2026-07-04 prestige playtest: the numbers were sound, the blind tap wasn't).
  const prestigeSection = state.player.lifetimeEarnings >= PRESTIGE.lifetimeEarningsThreshold
    ? `<details class="home-details home-details--prestige" data-home-panel="prestige"${homePanels?.prestige ? ' open' : ''}>
         <summary class="home-details-summary">Sell the Business — Founder Bonus ${(currentFounderBonus * 100).toFixed(0)}% → ${(nextFounderBonus * 100).toFixed(0)}%</summary>
         <div class="home-details-body">
           <p class="home-offline-detail">Lifetime earnings reached <strong>$${state.player.lifetimeEarnings.toLocaleString('en-US')}</strong> (threshold $${PRESTIGE.lifetimeEarningsThreshold.toLocaleString('en-US')}). Sell up and restart in a new region with a permanent <strong>Founder Bonus</strong> — it multiplies your job pay and reputation gain on every future run.</p>
           <ul class="home-offline-techs prestige-numbers">
             <li class="home-offline-tech">Current Founder Bonus: <strong>${(currentFounderBonus * 100).toFixed(0)}%</strong></li>
             <li class="home-offline-tech">Reputation value: <strong>+${(prestigeBonusGained * 100).toFixed(0)}%</strong></li>
             <li class="home-offline-tech">New Founder Bonus: <strong>${(nextFounderBonus * 100).toFixed(0)}%</strong></li>
           </ul>
           <p class="prestige-keep">You keep: the Founder Bonus, the Fault Codex, your Machine of the Day streak, and lifetime stats.</p>
           <p class="prestige-lose">The new owners keep: your cash (you restart with $${STARTING.cash.toLocaleString('en-US')}), reputation and tier, tools, van racking, techs and their training, contract routes, workshop machines, and queued callbacks.</p>
           ${prestigeConfirm
             ? `<div class="prestige-confirm" role="alert">
                 <p><strong>Sell for +${(prestigeBonusGained * 100).toFixed(0)}% Founder Bonus?</strong></p>
                 <p>Tools, van, techs and routes go with the business. This can't be undone.</p>
                 <div class="first-fix-actions">
                   <button class="btn btn-prestige" data-action="confirm-sell-business">Sell the Business</button>
                   <button class="btn btn-sm" data-action="cancel-sell-business">Keep the business</button>
                 </div>
               </div>`
             : `<button class="btn btn-prestige" data-action="sell-business">Sell the Business</button>`}
         </div>
       </details>`
    : '';



  let buyOptions = '';
  for (const [id, info] of Object.entries(WORKSHOP_MACHINES)) {
    if (state.player.tierUnlocked >= info.tierRequired) {
      const canBuy = state.player.cash >= info.buyPrice;
      buyOptions += `
        <div class="workshop-row">
          <span class="workshop-machine">${escapeHtml(info.name)} ($${info.buyPrice})</span>
          <button class="btn btn-sm btn-buy" data-buy-workshop-machine="${id}" ${canBuy ? '' : 'disabled'}>Buy</button>
        </div>`;
    }
  }



  let ownedMachines = '';
  const machinesInWorkshop = state.workshop?.machines ?? [];
  if (machinesInWorkshop.length > 0) {
    ownedMachines = machinesInWorkshop.map((m) => {
      const info = WORKSHOP_MACHINES[m.machineType];
      const name = info ? info.name : m.machineType;
      if (m.status === 'broken') {
        return `
          <div class="workshop-row">
            <span class="workshop-machine"><span class="dot dot--warn" aria-hidden="true"></span> ${escapeHtml(name)} (Broken)</span>
            <button class="btn btn-sm btn-primary" data-repair-workshop-machine="${escapeHtml(m.id)}">Repair</button>
          </div>`;
      }
      // Sales are not founderBonus-scaled (rule 5 — see balance.js WORKSHOP).
      // info can be missing when an imported save holds an unknown machineType;
      // render a $0 sale rather than crashing the whole home screen.
      const sellVal = info ? info.sellPrice : 0;
      return `
          <div class="workshop-row">
            <span class="workshop-machine"><span class="dot dot--ok" aria-hidden="true"></span> ${escapeHtml(name)} (Refurbished)</span>
            <button class="btn btn-sm btn-workshop-sell" data-sell-workshop-machine="${escapeHtml(m.id)}">Sell ($${sellVal})</button>
          </div>`;
    }).join('');
  } else {
    ownedMachines = `<p class="workshop-empty">No machines in the workshop. Buy a damaged machine to refurbish.</p>`;
  }

  // Hidden until Tier 2: a brand-new player's home screen should be about the
  // core ticket loop, not a side hustle they can't yet judge the value of.
  // Collapsed to a one-line summary (2026-07-04 home tightening).
  const readyCount = machinesInWorkshop.filter((m) => m.status === 'repaired').length;
  const workshopSummary = machinesInWorkshop.length
    ? `Workshop — ${machinesInWorkshop.length} machine${machinesInWorkshop.length !== 1 ? 's' : ''}${readyCount > 0 ? ` · ${readyCount} ready to sell` : ''}`
    : `Workshop — buy & flip damaged machines`;
  const workshopSection = state.player.tierUnlocked < 2 ? '' : `
    <details class="home-details" data-home-panel="workshop"${homePanels?.workshop ? ' open' : ''}>
      <summary class="home-details-summary">${workshopSummary}</summary>
      <div class="home-details-body">
        <p class="workshop-heading">Buy damaged machines</p>
        ${buyOptions}
        <p class="workshop-heading">Your workshop inventory</p>
        ${ownedMachines}
      </div>
    </details>`;



  // The brand block shrinks once the player has fixed anything (2026-07-04):
  // returning players need the loop above the fold, not the splash.
  const compactBrand = state.stats.jobsCompleted > 0;
  const brand = `
      <div class="game-brand${compactBrand ? ' game-brand--compact' : ''}">
        ${compactBrand ? '' : '<div class="game-logo" aria-hidden="true">❄</div>'}
        <h1 class="game-wordmark"><span class="word-cold">Cold</span> <span class="word-call">Call</span></h1>
        ${compactBrand ? '' : '<p class="game-tagline">Field tech. Frozen tech. Your problem now.</p>'}
      </div>`;

  // Codex progress on the button itself — the collection goal stays visible.
  const codexTotal = Object.keys(faults ?? {}).length;
  const codexMastered = Object.keys(state.codex?.fixes ?? {}).filter((id) => faults && id in faults).length;

  // Home order (2026-07-04): status → notices/offline report → Next ticket →
  // Callbacks/MotD → prestige banner → workshop summary → Codex → shop/settings.
  return `
    ${statusBar(state)}
    <section class="screen screen-home">
      ${brand}
      <p class="game-stats">${state.stats.jobsCompleted} jobs completed${streak > 1 ? ` · ${streak} clean in a row ${streakFlameHtml(streak)}` : ''}${bonusCopy}</p>

      ${unlockBanner}
      ${corruptBanner}
      ${expiryBanner}
      ${offlineBanner}

      <button class="btn btn-primary" data-action="next-ticket">Next ticket</button>
      ${total > 0 ? `<button class="btn btn-callbacks" data-action="open-callbacks">${callbackLabel}</button>` : ''}
      ${motdSection}
      ${contractSection}
      ${prestigeSection}
      ${workshopSection}
      <button class="btn" data-action="open-codex">Codex — ${codexMastered}/${codexTotal} mastered</button>
      <button class="btn" data-action="open-shop">Upgrades shop</button>
      <button class="btn" data-action="open-settings">Settings</button>

      ${(state.van.stock['generic-parts'] ?? 0) < state.van.slots
        ? `<button class="btn btn-restock" data-action="restock-van">Restock van</button>`
        : ''}
    </section>`;
}

/** The Callbacks list — every queued callback, due or returning soon (GDD §3.1). */
export function callbacksView({ state, faults, clients }) {
  // Read the clock via Date.now() (not `new Date()`) so it stays injectable for
  // deterministic tests (CLAUDE.md rule 6). A recovery rewrite had used `new Date()`,
  // which bypassed the test clock pin and made the callback-timing tests date-flaky.
  const today = new Date(Date.now()).toISOString().slice(0, 10);
  // Render from the full queue so each row's data-index matches what
  // claimCallback() splices; only due entries get a Take button, and not-yet-due
  // ones are shown with their return day so an offline-queued callback is visibly
  // waiting rather than seeming to vanish.
  const rows = state.jobs.callbacks
    .map((cb, index) => ({ cb, index }))
    .map(({ cb, index }) => {
      const fault = faults[cb.faultId];
      const client = clients.find((c) => c.id === cb.clientId);
      const raw = fault ? fault.machineType.replace(/-/g, ' ') : cb.faultId;
      const machineName = raw.charAt(0).toUpperCase() + raw.slice(1);
      const isDue = cb.dueDay <= today;
      const isTech = cb.source === 'tech';
      const clientName = client ? client.name : escapeHtml(cb.clientId);

      // Not-yet-due entries collapse to a single line (2026-07-04): they exist
      // only so a queued callback doesn't seem to vanish — no decisions to make.
      if (!isDue) {
        return `
        <li class="callback-line">
          ${clientName} · ${escapeHtml(machineName)} · returns ${relativeDayPhrase(today, cb.dueDay)}
        </li>`;
      }

      // Due entries keep the full card: rate, claim window, and consequence of
      // abandoning it — a player obligation costs reputation; an optional tech
      // rescue expires for free (GDD §3.1).
      const timing =
        typeof cb.expiryDay === 'string'
          ? `Due now · expires ${relativeDayPhrase(today, cb.expiryDay)}`
          : 'Due now';
      const consequence = isTech
        ? 'Optional rescue — expires with no penalty.'
        : `You owe this client — let it expire and lose ${REPUTATION.expiredCallbackRepPenalty} rep.`;

      return `
        <li class="callback-card">
          <p class="callback-client">${clientName}</p>
          <p class="callback-meta">${escapeHtml(machineName)} · ${escapeHtml(sourceLabel(cb))} · pays ${callbackRatePct(cb.source)}% of net</p>
          <p class="callback-timing">${timing}</p>
          <p class="callback-consequence">${consequence}</p>
          <button class="btn btn-callback-take" data-take="${index}">Take callback</button>
        </li>`;
    })
    .join('');

  return `
    ${statusBar(state)}
    <section class="screen screen-callbacks">
      <h2 class="section-title">Callbacks</h2>
      <p class="callbacks-intro">Machines back on the board. A <strong>tech miss</strong> pays near full and expires for free — it's bonus pay. <strong>Your own miss</strong> pays the reduced rate and costs reputation if you abandon it.</p>
      ${rows ? `<ul class="callbacks-list">${rows}</ul>` : `<p class="callbacks-empty">No callbacks right now.</p>`}
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
            <span class="test-label">${testLabel(id, job.machineType)}</span>
            <p class="test-result">${testResult(job, id, faults)}</p>
          </li>`;
      }
      if (!available) {
        return `
          <li class="test-row">
            <button class="btn btn-test" disabled>${testLabel(id, job.machineType)}</button>
            <p class="test-meta">${testCostCopy(job, id)}</p>
            <p class="test-locked">${reason}</p>
          </li>`;
      }
      return `
        <li class="test-row">
          <button class="btn btn-test" data-test="${id}">${testLabel(id, job.machineType)}</button>
          <p class="test-meta">${testCostCopy(job, id)}</p>
        </li>`;
    })
    .join('');

  // Make the speed/thoroughness trade-off visible before each test (GDD §2.1).
  // Only fresh, non-MotD jobs earn the bonus — callbacks are already discounted
  // and MotD pays no cash, so showing a dollar bonus there would mislead.
  // Before the first test the bonus is locked (blind commits earn none).
  const minutes = job.minutesSpent ?? 0;
  const bonusCopy = job.testsRun.length >= DIAGNOSIS.minTestsForBonus
    ? `Speed bonus: <strong>$${earnedSpeedBonus(minutes, job.testsRun.length)}</strong>`
    : `Speed bonus: <strong>locked</strong> — run a test to earn it`;
  const clockBar = !job.callback && !job.motd
    ? `<p class="job-clock">Job clock: ${minutes} min · ${bonusCopy}</p>`
    : '';

  const outOfParts = fault.partsCost > 0 && (state.van.stock['generic-parts'] ?? 0) < 1;
  const firstJob = isFirstJobOnboarding(state);
  // Multimeter Tier 3 definitively rules out one wrong option (GDD §3.3 —
  // tools deepen diagnosis). Rendered struck-through, not hidden: seeing WHAT
  // was ruled out is itself evidence.
  const ruledOut = eliminatedFix(state, job, faults);
  const fixButtons = job.fixOptions
    .map((id) =>
      id === ruledOut
        ? `<button class="btn btn-fix btn-fix--eliminated" disabled><s>${escapeHtml(fixLabel(id))}</s><span class="fix-eliminated-note">Meter ruled this out</span></button>`
        : `<button class="btn btn-fix" data-fix="${escapeHtml(id)}" ${outOfParts ? 'disabled' : ''}>${escapeHtml(fixLabel(id))}</button>`
    )
    .join('');
  const pendingFixLabel = pendingFirstFixId ? escapeHtml(fixLabel(pendingFirstFixId)) : '';

  const clientName = job.motd ? 'Machine of the Day' : (client ? escapeHtml(client.name) : escapeHtml(job.clientId));
  const safeMachineName = escapeHtml(machineName);
  const clientImg = !job.motd && client ? clientPortraitImageSrc(client.id) : null;
  const portrait = !job.motd && client ? (clientImg ? `<img src="${clientImg}" alt="" width="64" height="64">` : clientPortraitSvg(client.portrait)) : null;
  const contact = !job.motd && client?.contact ? client.contact : null;
  const contactName = contact?.name ? escapeHtml(contact.name) : 'Caller details unavailable';
  const contactRole = contact?.role ? escapeHtml(contact.role) : '';
  const flavourLine = contactFlavourLine(contact, job);
  const contactFlavour = flavourLine ? escapeHtml(flavourLine) : '';
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
  const artSlot = artSlotHtml(job.machineType, artState, state.settings.graphicsMode, {
    fallback: `[ ${safeMachineName} ]`,
  });

  // Symptoms are the caller's complaint — the ticket itself — so they render
  // as the first content after the status bar on every viewport (2026-07-05
  // game-feel session). The ticket panel sits outside job-cols precisely so
  // the two-column desktop grid can't push it below the fold or behind the
  // diagnostics buttons; job-cols only holds the art and the controls that
  // act on the evidence above it.
  return `
    ${statusBar(state)}
    <section class="screen screen-job">

      <div class="panel job-ticket">

        ${job.motd ? `<span class="badge badge--success">Machine of the Day</span>` : ''}

        ${job.callback ? `<span class="badge badge--warn">Callback — reduced rate</span>` : ''}

        <h2 class="job-client">${clientName}</h2>

        <p class="job-machine">${safeMachineName}</p>

        <blockquote class="job-ticket-order">

          <p class="panel-label">Reported symptoms</p>

          ${firstJob ? `<div class="diagnosis-guide" aria-label="First job guide">

            <p><strong>1. Read the symptoms.</strong> They narrow down what failed.</p>

            <p><strong>2. Run useful tests.</strong> Evidence costs simulated minutes and reduces the speed bonus.</p>

            <p><strong>3. Commit one fix.</strong> That ends diagnosis; a wrong call returns as a reduced-rate callback.</p>

          </div>` : ''}

          <ul class="symptoms">${jobSymptoms(job, faults).map((s) => `<li>“${s}”</li>`).join('')}</ul>

        </blockquote>

        ${portraitHtml}

        ${clockBar}

      </div>

      <div class="job-cols">

        <div class="job-col-left">

          ${artSlot}

        </div>


        <div class="job-col-right">

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

        </div>

      </div>
    </section>`;
}

/**
 * The repair beat (GDD §2.3): a brief tactile "tighten it up" hold shown after a
 * correct fix, over the machine's `working` art, before the invoice. Pure feedback
 * — no economy or simulated-time effect — and always skippable so it never gates
 * the payout. Settlement already happened in commitFix; this view moves no money.
 * @param {object} ctx
 * @param {object} ctx.state game state (for the status bar)
 * @param {{machineType: string}} ctx.repairBeat the machine being sealed up
 * @returns {string}
 */
export function repairView({ state, repairBeat }) {
  const artSlot = artSlotHtml(repairBeat.machineType, 'working', state.settings.graphicsMode, {
    fallback: '[ repaired ]',
    glow: true, // the one-shot brighten/glow beat (GDD §7 game-feel pass, 2026-07-05)
  });

  return `
    ${statusBar(state)}
    <section class="screen screen-repair">
      <div class="repair-layout-cols">

        <div class="repair-col-left">

          ${artSlot}

        </div>

        <div class="repair-col-right">

          <p class="repair-headline">Running cold again.</p>

          <div class="repair-beat">

            <div class="repair-bolt" data-repair-hold role="button" tabindex="0"

                 aria-label="Hold to tighten the panel, or press Enter to finish">

              <span class="repair-bolt-fill"></span>

              <span class="repair-bolt-label">Hold to tighten</span>

            </div>

            <button class="btn btn-sm" data-action="finish-repair">Skip</button>

          </div>

        </div>
      </div>
    </section>`;
}

export function invoiceView({ state, invoice }) {
  const { correct, fault, earned, chosenFix, callback, callbackSource, unlockedTier, isWorkshop } = invoice;


  let lineItems;
  let outcomeClass;
  let outcomeText;
  let receiptNote = '';



  if (isWorkshop) {

    if (correct) {

      outcomeClass = 'receipt-outcome--good';

      outcomeText = 'Refurbished!';

      lineItems = `

        <div class="receipt-line"><span>Status</span><span>Refurbished</span></div>

        <div class="receipt-line receipt-line--total"><span>Earned</span><span>$0</span></div>`;

      receiptNote = `<p class="receipt-note">You can now sell this machine from the Workshop panel on the home screen for a profit.</p>`;

    } else {

      outcomeClass = 'receipt-outcome--bad';

      outcomeText = 'Failed!';

      lineItems = `

        <div class="receipt-line"><span>Status</span><span>Still Damaged</span></div>`;

      receiptNote = `<p class="receipt-note">The machine is still broken. Try repairing it again.</p>`;

    }

  } else if (correct && callback) {

    outcomeClass = 'receipt-outcome--good';
    outcomeText = 'Fixed!';
    lineItems = `
      <div class="receipt-line"><span>Job payout</span><span>$${fault.payout}</span></div>
      <div class="receipt-line"><span>Parts</span><span>−$${fault.partsCost}</span></div>
      <div class="receipt-line"><span>${callbackSource === 'tech' ? 'Rescue rate' : 'Callback rate'}</span><span>×${callbackRatePct(callbackSource)}%</span></div>
      <div class="receipt-line receipt-line--total"><span>TOTAL</span><span class="receipt-count" data-count-target="${earned}">$${earned}</span></div>`;
    receiptNote = '';

  } else if (correct) {
    const bonus = earnedSpeedBonus(invoice.minutesSpent ?? 0, invoice.testsUsed ?? 0);
    outcomeClass = 'receipt-outcome--good';
    outcomeText = 'Fixed!';
    lineItems = `
      <div class="receipt-line"><span>Job payout</span><span>$${fault.payout}</span></div>
      <div class="receipt-line"><span>Parts</span><span>−$${fault.partsCost}</span></div>
      <div class="receipt-line"><span>Speed bonus</span><span>+$${bonus}</span></div>
      <div class="receipt-line receipt-line--total"><span>TOTAL</span><span class="receipt-count" data-count-target="${earned}">$${earned}</span></div>`;
    receiptNote = '';

  } else if (callback) {
    outcomeClass = 'receipt-outcome--bad';
    outcomeText = 'Callback.';
    lineItems = `
      <div class="receipt-line"><span>Repeat miss</span><span>$0</span></div>`;
    receiptNote = `<p class="receipt-note">Wrong again — back on the board tomorrow. No charge.</p>`;

  } else {
    outcomeClass = 'receipt-outcome--bad';
    outcomeText = 'Callback.';
    lineItems = `
      <div class="receipt-line"><span>Partial payout</span><span class="receipt-count" data-count-target="${earned}">$${earned}</span></div>`;
    receiptNote = `<p class="receipt-note">Wrong call — that machine will be back tomorrow.</p>`;

  }

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

  // Reputation and clean-streak movement on the receipt (2026-07-04): the two
  // numbers that gate progression moved invisibly before.
  const repLine =
    !isWorkshop && typeof invoice.repDelta === 'number' && invoice.repDelta !== 0
      ? `<div class="receipt-line receipt-line--rep"><span>Reputation</span><span>${invoice.repDelta > 0 ? '+' : '−'}${Math.abs(invoice.repDelta)} rep</span></div>`
      : '';
  const streakLine =
    !isWorkshop && correct && !callback && (invoice.cleanStreak ?? 0) >= 2
      ? `<div class="receipt-line receipt-line--rep"><span>Clean streak</span><span>${invoice.cleanStreak} in a row ${streakFlameHtml(invoice.cleanStreak)}</span></div>`
      : '';

  // Codex feedback (GDD §5): a first-time diagnosis and any milestone bonuses
  // are receipt-worthy moments — the collection goal pays off inside the loop.
  const codexInfo = invoice.codex;
  const codexLines = codexInfo
    ? [
        codexInfo.isNew
          ? `<p class="receipt-codex">★ New Codex entry — ${codexInfo.mastered}/${codexInfo.total} mastered</p>`
          : '',
        ...codexInfo.milestonesPaid.map(
          (m) => `<p class="receipt-codex">Codex ${m.pct}% milestone: +$${m.bonus.toLocaleString('en-US')}</p>`
        ),
      ].join('')
    : '';

  // Today's contract (GDD §5): progress lands on the receipt so the daily goal
  // pays off inside the loop, not just back on the home screen.
  const contractInfo = invoice.contract;
  const contractLine = contractInfo
    ? contractInfo.justCompleted
      ? `<p class="receipt-codex celebration-card">Contract complete: +$${contractInfo.reward.toLocaleString('en-US')}</p>`
      : `<p class="receipt-codex">Today's contract: ${contractInfo.progress}/${contractInfo.count}</p>`
    : '';

  // A wrong fix gets one hard screen-shake as the receipt lands (2026-07-05
  // game-feel session); a correct one already got its glow beat on the repair
  // screen just before this, so the invoice itself stays calm.
  const shakeClass = !isWorkshop && !correct ? ' screen-shake' : '';

  return `
    ${statusBar(state)}
    <section class="screen screen-invoice${shakeClass}">
      <div class="receipt">
        <div class="receipt-header">— COLD CALL SERVICES —</div>
        <p class="receipt-outcome ${outcomeClass}">${outcomeText}</p>
        ${lineItems}
        ${repLine}
        ${streakLine}
        ${receiptNote}
        ${codexLines}
        ${contractLine}
        ${unlockedTier ? `<p class="receipt-unlock celebration-card">★ Tier ${unlockedTier} clients unlocked!</p>` : ''}
        ${correct ? `<p class="receipt-flavour">“${fault.flavour}”</p>` : ''}
      </div>
      ${learningBlock}
      <div class="invoice-actions">
        ${isWorkshop
          ? `<button class="btn btn-primary" data-action="dismiss-invoice">Home</button>`
          : `<button class="btn btn-primary" data-action="invoice-next-ticket">Next ticket</button>
             <button class="btn" data-action="dismiss-invoice">Home</button>`}
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
  root.querySelectorAll('[data-action="invoice-next-ticket"]').forEach((el) =>
    el.addEventListener('click', actions.invoiceNextTicket)
  );
  // Remember expand/collapse of home <details> panels across re-renders —
  // details manages its own display; we only record the state, no re-render.
  root.querySelectorAll('details[data-home-panel]').forEach((el) =>
    el.addEventListener('toggle', () => actions.toggleHomePanel(el.dataset.homePanel, el.open))
  );
  root.querySelectorAll('[data-action="open-shop"]').forEach((el) =>
    el.addEventListener('click', actions.openShop)
  );
  root.querySelectorAll('[data-action="open-codex"]').forEach((el) =>
    el.addEventListener('click', actions.openCodex)
  );
  root.querySelectorAll('[data-action="open-settings"]').forEach((el) =>
    el.addEventListener('click', actions.openSettings)
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
  root.querySelectorAll('[data-action="finish-repair"]').forEach((el) =>
    el.addEventListener('click', actions.finishRepair)
  );
  root.querySelectorAll('[data-action="sell-business"]').forEach((el) =>

    el.addEventListener('click', actions.sellBusiness)

  );

  root.querySelectorAll('[data-action="confirm-sell-business"]').forEach((el) =>
    el.addEventListener('click', actions.confirmSellBusiness)
  );

  root.querySelectorAll('[data-action="cancel-sell-business"]').forEach((el) =>
    el.addEventListener('click', actions.cancelSellBusiness)
  );

  root.querySelectorAll('[data-buy-workshop-machine]').forEach((el) =>

    el.addEventListener('click', () => actions.buyWorkshopMachine(el.dataset.buyWorkshopMachine))

  );

  root.querySelectorAll('[data-repair-workshop-machine]').forEach((el) =>

    el.addEventListener('click', () => actions.repairWorkshopMachine(el.dataset.repairWorkshopMachine))

  );

  root.querySelectorAll('[data-sell-workshop-machine]').forEach((el) =>

    el.addEventListener('click', () => actions.sellWorkshopMachine(el.dataset.sellWorkshopMachine))

  );

  wireRepairHold(root, actions);
}

/**
 * Animate the invoice's settlement number (GDD §7 game-feel pass, 2026-07-05):
 * the TOTAL/payout row counts up from $0 with a floating "+$N" badge instead
 * of appearing fully-formed. The value shown at rest is already correct in
 * the server-rendered markup, so skipping this (reduced motion, or a $0 line)
 * is always a safe no-op — never a missing or wrong number.
 * @param {HTMLElement} root
 */
function wireInvoiceJuice(root) {
  const target = root.querySelector('[data-count-target]');
  if (!target) return;
  const end = Number(target.dataset.countTarget);
  if (!Number.isFinite(end) || end <= 0 || prefersReducedMotion()) return;

  const DURATION = 650;
  let start = 0;
  function tick(now) {
    if (!target.isConnected) return;
    start = start || now;
    const p = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(1 - p, 3);
    target.textContent = `$${Math.round(end * eased).toLocaleString('en-US')}`;
    if (p < 1) requestAnimationFrame(tick);
  }
  target.textContent = '$0';
  requestAnimationFrame(tick);

  const line = target.closest('.receipt-line');
  if (!line) return;
  const float = document.createElement('span');
  float.className = 'receipt-float';
  float.textContent = `+$${end.toLocaleString('en-US')}`;
  float.addEventListener('animationend', () => float.remove());
  line.appendChild(float);
}

/**
 * Drive the hold-to-tighten beat. Holding fills a bar; reaching full finishes.
 * It cannot fail — releasing only pauses — so it's feedback, not a skill gate.
 * Keyboard (Enter/Space) and the Skip button both finish instantly, keeping it
 * accessible and touch-friendly. The fill loop self-cancels once the element is
 * detached (the next render replaces the DOM), so no animation outlives the view.
 */
function wireRepairHold(root, actions) {
  const bolt = root.querySelectorAll('[data-repair-hold]')[0];
  if (!bolt) return;
  const fill = bolt.querySelector('.repair-bolt-fill');
  const HOLD_MS = 1000; // time-to-full while held; generous, never a challenge
  let progress = 0;     // 0..1
  let last = 0;
  let rafId = 0;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    actions.finishRepair();
  }
  function tick(now) {
    if (done || !bolt.isConnected) return;
    progress += (now - last) / HOLD_MS;
    last = now;
    if (progress >= 1) {
      fill.style.width = '100%';
      finish();
      return;
    }
    fill.style.width = `${progress * 100}%`;
    rafId = requestAnimationFrame(tick);
  }
  function startHold(e) {
    if (done) return;
    e.preventDefault();
    last = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }
  function pauseHold() {
    cancelAnimationFrame(rafId); // freeze progress until the next press
  }

  bolt.addEventListener('pointerdown', startHold);
  bolt.addEventListener('pointerup', pauseHold);
  bolt.addEventListener('pointerleave', pauseHold);
  bolt.addEventListener('pointercancel', pauseHold);
  bolt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      finish();
    }
  });
}
