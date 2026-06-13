/** @file Tools shop screen: list TOOL_CATALOGUE, buy with cash, show owned state.
 * Also shows the staff (techs) section for hiring and route assignment.
 * Render-from-state like every screen; mutations live in economy.js.
 */

import { TOOL_CATALOGUE } from '../economy.js';
import { TECHS } from '../../config/balance.js';
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
  const { state, actions, exportMessage, importError } = ctx;

  const toolCards = Object.entries(TOOL_CATALOGUE)
    .map(([id, tool]) => {
      const owned = tool.owned(state);
      const affordable = state.player.cash >= tool.cost;
      let button;
      if (owned) {
        button = `<button class="btn btn-buy" disabled>Owned</button>`;
      } else if (!affordable) {
        button = `<button class="btn btn-buy" disabled>Buy — $${tool.cost}</button>
                  <p class="shop-locked">Not enough cash</p>`;
      } else {
        button = `<button class="btn btn-buy" data-buy="${id}">Buy — $${tool.cost}</button>`;
      }
      return `
        <li class="shop-card${owned ? ' shop-card-owned' : ''}">
          <h3 class="shop-tool-name">${tool.name}</h3>
          <p class="shop-tool-blurb">${tool.blurb}</p>
          ${button}
        </li>`;
    })
    .join('');

  const staffSection = staffHTML(state);
  const saveSection = saveDataHTML(exportMessage, importError);

  root.innerHTML = `
    ${statusBar(state)}
    <section class="screen screen-shop">
      <h2 class="section-title">Tools shop</h2>
      <ul class="shop-list">${toolCards}</ul>
      ${staffSection}
      ${saveSection}
      <button class="btn btn-primary" data-action="close-shop">Back</button>
    </section>`;

  root.querySelectorAll('[data-buy]').forEach((el) =>
    el.addEventListener('click', () => actions.buyTool(el.dataset.buy))
  );
  root.querySelectorAll('[data-action="close-shop"]').forEach((el) =>
    el.addEventListener('click', actions.closeShop)
  );
  root.querySelectorAll('[data-action="hire-tech"]').forEach((el) =>
    el.addEventListener('click', actions.hireTech)
  );
  root.querySelectorAll('[data-action="export-save"]').forEach((el) =>
    el.addEventListener('click', actions.exportSave)
  );
  root.querySelectorAll('[data-action="import-save"]').forEach((el) =>
    el.addEventListener('click', () => {
      const blob = root.querySelector('.import-textarea')?.value ?? '';
      actions.importSave(blob);
    })
  );
}

function saveDataHTML(exportMessage, importError) {
  return `
    <h2 class="section-title">Save data</h2>
    <div class="shop-card">
      <p class="shop-tool-blurb">Copy your save to clipboard and paste it on another device to transfer your progress.</p>
      <button class="btn btn-buy" data-action="export-save">Export save — copy to clipboard</button>
      ${exportMessage ? `<p class="settings-ok">${exportMessage}</p>` : ''}
    </div>
    <div class="shop-card">
      <p class="shop-tool-blurb">Paste a save blob exported from another device. This replaces your current save and reloads the game.</p>
      <textarea class="import-textarea" placeholder="Paste save blob here…" rows="3"></textarea>
      <button class="btn btn-buy" data-action="import-save">Import save — replace &amp; reload</button>
      ${importError ? `<p class="settings-err">${escapeHtml(importError)}</p>` : ''}
    </div>`;
}

function staffHTML(state) {
  const tier2Locked = state.player.tierUnlocked < 2;
  const atMax = state.techs.length >= TECHS.maxTechs;
  const affordable = state.player.cash >= TECHS.firstHireCost;

  const techList = state.techs.length > 0
    ? state.techs.map((t) => {
        const route = state.routes.find((r) => r.id === t.routeId);
        const routeLabel = route ? 'Burgertown South Side' : 'Unassigned';
        return `<li class="shop-card"><span class="shop-tool-name">${escapeHtml(t.name)}</span>
          <span class="shop-tool-blurb">Skill ${t.skill} · ${routeLabel}</span></li>`;
      }).join('')
    : `<li class="shop-card"><p class="shop-tool-blurb">No techs hired yet.</p></li>`;

  let hireButton;
  if (tier2Locked) {
    hireButton = `<button class="btn btn-buy" disabled>Hire tech — $${TECHS.firstHireCost}</button>
      <p class="shop-locked">Unlock Tier 2 first (rep 10)</p>`;
  } else if (atMax) {
    hireButton = `<button class="btn btn-buy" disabled>Max techs hired</button>`;
  } else if (!affordable) {
    hireButton = `<button class="btn btn-buy" disabled>Hire tech — $${TECHS.firstHireCost}</button>
      <p class="shop-locked">Not enough cash</p>`;
  } else {
    hireButton = `<button class="btn btn-buy" data-action="hire-tech">Hire tech — $${TECHS.firstHireCost}</button>`;
  }

  return `
    <h2 class="section-title">Staff</h2>
    <ul class="shop-list">${techList}</ul>
    ${hireButton}`;
}
