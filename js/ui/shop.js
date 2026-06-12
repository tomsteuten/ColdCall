/** @file Tools shop screen: list TOOL_CATALOGUE, buy with cash, show owned state.
 * Render-from-state like every screen; the buy mutation lives in economy.buyTool.
 */

import { TOOL_CATALOGUE } from '../economy.js';
import { statusBar } from './job.js';

/**
 * Render the shop into root.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {object} ctx.state game state
 * @param {{buyTool: function(string), closeShop: function}} ctx.actions
 */
export function render(root, ctx) {
  const { state, actions } = ctx;
  const cards = Object.entries(TOOL_CATALOGUE)
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

  root.innerHTML = `
    ${statusBar(state)}
    <section class="screen screen-shop">
      <h2 class="section-title">Tools shop</h2>
      <ul class="shop-list">${cards}</ul>
      <button class="btn btn-primary" data-action="close-shop">Back</button>
    </section>`;

  root.querySelectorAll('[data-buy]').forEach((el) =>
    el.addEventListener('click', () => actions.buyTool(el.dataset.buy))
  );
  root.querySelectorAll('[data-action="close-shop"]').forEach((el) =>
    el.addEventListener('click', actions.closeShop)
  );
}
