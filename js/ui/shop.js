/** @file Tools shop screen: list TOOL_CATALOGUE, buy with cash, show owned state.
 * Also shows the staff (techs) section for hiring and route assignment.
 * Render-from-state like every screen; mutations live in economy.js.
 */

import { purchaseLadder } from '../economy.js';
import { TECHS, OFFLINE, ROUTES } from '../../config/balance.js';
import { statusBar } from './job.js';
import { escapeHtml } from '../utils.js';

/**
 * Render the shop into root.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {object} ctx.state game state
 * @param {{itemId: string}|null} ctx.purchaseNotice transient successful-purchase feedback
 * @param {string|null} ctx.exportMessage feedback after a successful export
 * @param {string|null} ctx.importError error message from a failed import
 * @param {{buyTool: function(string), hireTech: function, closeShop: function,
 *   exportSave: function, importSave: function(string)}} ctx.actions
 */
export function render(root, ctx) {
  const { state, actions, purchaseNotice = null } = ctx;

  // The full purchase ladder, cheapest first, locked items included — the
  // player must always be able to see what's next (2026-07-04 wanting engine).
  const ladder = purchaseLadder(state);
  const nextGoal = ladder.find((item) => !item.owned && !item.lockReason) ?? null;
  const ladderRows = ladder
    .map((item) => {
      const affordable = state.player.cash >= item.cost;
      let action;
      if (item.owned) {
        action = `<span class="ladder-owned">Owned</span>`;
      } else if (item.lockReason) {
        action = `<span class="ladder-cost">$${item.cost.toLocaleString('en-US')}</span>
                  <p class="shop-locked">${escapeHtml(item.lockReason)}</p>`;
      } else if (!affordable) {
        action = `<button class="btn btn-buy" disabled>Buy — $${item.cost.toLocaleString('en-US')}</button>
                  <p class="shop-locked">Not enough cash</p>`;
      } else {
        action = `<button class="btn btn-buy" data-ladder-buy="${item.id}">Buy — $${item.cost.toLocaleString('en-US')}</button>`;
      }
      return `
        <li class="shop-card${item.owned ? ' shop-card-owned' : ''}${item.lockReason && !item.owned ? ' shop-card-locked' : ''}${nextGoal?.id === item.id ? ' shop-card-next' : ''}">
          <div class="shop-card-heading">
            <h3 class="shop-tool-name">${escapeHtml(item.name)}</h3>
            ${nextGoal?.id === item.id ? '<span class="badge badge--success">Next goal</span>' : ''}
          </div>
          <p class="shop-tool-blurb">${escapeHtml(item.detail)}</p>
          ${action}
        </li>`;
    })
    .join('');

  const staffSection = staffHTML(state);
  const purchaseNoticeMarkup = purchaseNoticeHTML(state, purchaseNotice);
  const handoverActive = purchaseNotice?.itemId?.startsWith('hire-tech-')
    || purchaseNotice?.itemId === 'route-froyo-strip';

  root.innerHTML = `
    ${statusBar(state, { home: true })}
    <section class="screen screen-shop">
      ${purchaseNoticeMarkup}
      <h2 class="section-title">Upgrades</h2>
      <ul class="shop-list">${ladderRows}</ul>
      ${staffSection}
      <button class="btn${handoverActive ? '' : ' btn-primary'}" data-action="close-shop">${handoverActive ? 'Back to operations' : 'Back'}</button>
    </section>`;

  root.querySelectorAll('[data-ladder-buy]').forEach((el) =>
    el.addEventListener('click', () => actions.buyLadderItem(el.dataset.ladderBuy))
  );
  root.querySelectorAll('[data-action="close-shop"]').forEach((el) =>
    el.addEventListener('click', actions.closeShop)
  );
}

/**
 * A successful crew purchase lands as a signed dispatch docket instead of a
 * ladder row silently changing to "Owned". It is transient UI feedback: the
 * durable route/skill truth is still rendered from state on Home.
 */
export function purchaseNoticeHTML(state, notice) {
  const itemId = notice?.itemId;
  if (!itemId) return '';

  let stamp = 'Fitted';
  let title = 'Upgrade signed off';
  let detail = 'Back in service. Try not to lose the receipt.';
  let assignment = '';
  let primary = false;

  if (itemId === 'hire-tech-1' || itemId === 'hire-tech-2') {
    const techIndex = itemId === 'hire-tech-1' ? 0 : 1;
    const tech = state.techs[techIndex];
    const route = ROUTES[tech?.routeId];
    if (!tech || !route) return '';
    const success = Math.round((TECHS.successRateBySkill[tech.skill] ?? TECHS.baseSuccessRate) * 100);
    stamp = 'Keys signed out';
    title = `${escapeHtml(tech.name)} is on the books`;
    detail = `Clock off and ${escapeHtml(tech.name)} works the route. Results settle on your return; misses come back as optional rescue calls.`;
    assignment = `
      <div class="dispatch-assignment">
        <span class="dispatch-route-mark" aria-hidden="true"></span>
        <span><strong>${escapeHtml(route.name)}</strong><small>Included contract route</small></span>
        <span class="dispatch-assignment-stats">Skill ${tech.skill} · ${success}% · ~${TECHS.jobsPerHour}/hr</span>
      </div>`;
    primary = true;
  } else if (itemId === 'route-froyo-strip') {
    const route = ROUTES['froyo-strip'];
    const tech = state.techs.find((entry) => entry.routeId === 'froyo-strip');
    stamp = 'Route pinned';
    title = `${escapeHtml(route.name)} is live`;
    detail = tech
      ? `${escapeHtml(tech.name)} has the keys. Route tier sets the jobs and pay; skill sets how many come back clean.`
      : 'The contract is ready for a technician assignment.';
    assignment = `
      <div class="dispatch-assignment">
        <span class="dispatch-route-mark" aria-hidden="true"></span>
        <span><strong>${escapeHtml(route.name)}</strong><small>Tier ${route.tier} · $${TECHS.routeEarningsPerJob[route.tier]}/clean fix</small></span>
        <span class="dispatch-assignment-stats">${tech ? escapeHtml(tech.name) : 'Unassigned'}</span>
      </div>`;
    primary = true;
  } else if (itemId.startsWith('train-tech-')) {
    const techIndex = itemId === 'train-tech-1' ? 0 : 1;
    const tech = state.techs[techIndex];
    if (!tech) return '';
    const success = Math.round((TECHS.successRateBySkill[tech.skill] ?? TECHS.baseSuccessRate) * 100);
    stamp = 'Training signed';
    title = `${escapeHtml(tech.name)} is sharper`;
    detail = `Skill ${tech.skill} · ${success}% success. Same route and pace; fewer jobs return wearing a callback tag.`;
  } else {
    const bought = purchaseLadder(state).find((item) => item.id === itemId);
    if (bought) title = `${escapeHtml(bought.name)} fitted`;
  }

  return `
    <aside class="dispatch-handover${primary ? ' dispatch-handover--major' : ''}" aria-live="polite">
      <div class="dispatch-handover-head">
        <span class="dispatch-stamp">${stamp}</span>
        <span class="badge badge--success">Signed off</span>
      </div>
      <h2>${title}</h2>
      <p>${detail}</p>
      ${assignment}
      ${primary ? '<button class="btn btn-primary" data-action="close-shop">See the dispatch board</button>' : ''}
    </aside>`;
}

/** Plain-English explainer of what a hire delivers — shown before the purchase. */
export function staffExplainerHTML() {
  const successPct = Math.round((TECHS.successRateBySkill[1] ?? TECHS.baseSuccessRate) * 100);
  return `
    <div class="shop-card staff-explainer">
      <p class="shop-tool-blurb">A tech works your contract route while you're away.</p>
      <ul class="staff-stats">
        <li>~${TECHS.jobsPerHour} jobs/hour, ${successPct}% success — earns $${TECHS.routeEarningsPerJob[2]}–$${TECHS.routeEarningsPerJob[3]}/job by route (always less than active play)</li>
        <li>Offline earnings simulate up to ${OFFLINE.baseCapHours}h per absence</li>
        <li>A botched job becomes a rescue callback you can claim — no reputation hit</li>
        <li>No wage at launch — the $${TECHS.firstHireCost} hire is the only cost</li>
      </ul>
    </div>`;
}

export function staffHTML(state) {
  // Roster is informational — hiring and training live on the ladder above.
  const successPct = (skill) =>
    Math.round((TECHS.successRateBySkill[skill] ?? TECHS.baseSuccessRate) * 100);
  const techList = state.techs.length > 0
    ? state.techs.map((t) => {
        const route = ROUTES[t.routeId];
        const routeLabel = route?.name ?? 'Unassigned';
        const routePay = route ? TECHS.routeEarningsPerJob[route.tier] : null;
        return `<li class="shop-card staff-roster-card">
          <div class="staff-roster-head">
            <span class="shop-tool-name">${escapeHtml(t.name)}</span>
            <span class="badge">${route ? 'Dispatched' : 'Unassigned'}</span>
          </div>
          <span class="shop-tool-blurb">${escapeHtml(routeLabel)}</span>
          <span class="staff-roster-effect">Skill ${t.skill} · ${successPct(t.skill)}% success${routePay ? ` · $${routePay}/clean fix` : ''}</span>
        </li>`;
      }).join('')
    : `<li class="shop-card"><p class="shop-tool-blurb">No techs hired yet.</p></li>`;

  const atMax = state.techs.length >= TECHS.maxTechs;

  return `
    <h2 class="section-title">Staff</h2>
    <ul class="shop-list">${techList}</ul>
    ${atMax ? '' : staffExplainerHTML()}`;
}
