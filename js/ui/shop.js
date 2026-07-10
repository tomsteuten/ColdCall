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
 * @param {string|null} ctx.exportMessage feedback after a successful export
 * @param {string|null} ctx.importError error message from a failed import
 * @param {{buyTool: function(string), hireTech: function, closeShop: function,
 *   exportSave: function, importSave: function(string)}} ctx.actions
 */
export function render(root, ctx) {
  const { state, actions } = ctx;

  // The full purchase ladder, cheapest first, locked items included — the
  // player must always be able to see what's next (2026-07-04 wanting engine).
  const ladderRows = purchaseLadder(state)
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
        <li class="shop-card${item.owned ? ' shop-card-owned' : ''}${item.lockReason && !item.owned ? ' shop-card-locked' : ''}">
          <h3 class="shop-tool-name">${escapeHtml(item.name)}</h3>
          <p class="shop-tool-blurb">${escapeHtml(item.detail)}</p>
          ${action}
        </li>`;
    })
    .join('');

  const staffSection = staffHTML(state);

  root.innerHTML = `
    ${statusBar(state, { home: true })}
    <section class="screen screen-shop">
      <h2 class="section-title">Upgrades</h2>
      <ul class="shop-list">${ladderRows}</ul>
      ${staffSection}
      <button class="btn btn-primary" data-action="close-shop">Back</button>
    </section>`;

  root.querySelectorAll('[data-ladder-buy]').forEach((el) =>
    el.addEventListener('click', () => actions.buyLadderItem(el.dataset.ladderBuy))
  );
  root.querySelectorAll('[data-action="close-shop"]').forEach((el) =>
    el.addEventListener('click', actions.closeShop)
  );
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
        const routeLabel = ROUTES[t.routeId]?.name ?? 'Unassigned';
        return `<li class="shop-card"><span class="shop-tool-name">${escapeHtml(t.name)}</span>
          <span class="shop-tool-blurb">Skill ${t.skill} (${successPct(t.skill)}% success) · ${escapeHtml(routeLabel)}</span></li>`;
      }).join('')
    : `<li class="shop-card"><p class="shop-tool-blurb">No techs hired yet.</p></li>`;

  const atMax = state.techs.length >= TECHS.maxTechs;

  return `
    <h2 class="section-title">Staff</h2>
    <ul class="shop-list">${techList}</ul>
    ${atMax ? '' : staffExplainerHTML()}`;
}
