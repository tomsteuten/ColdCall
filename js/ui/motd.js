/** @file Machine of the Day result screen. */

import { statusBar } from './job.js';
import { buildShareCard, getTodayDateStr } from '../motd.js';

/**
 * Render the MotD result screen into root.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {object} ctx.state game state
 * @param {object} ctx.motdResult { testsUsed, timeMs, solved, streak, fault }
 * @param {{ dismissMotdResult: function, shareMotd: function }} ctx.actions
 */
export function render(root, ctx) {
  const { state, motdResult, actions } = ctx;
  root.innerHTML = resultView(state, motdResult);
  root.querySelector('[data-action="dismiss-motd"]')?.addEventListener('click', actions.dismissMotdResult);
  root.querySelector('[data-action="share-motd"]')?.addEventListener('click', actions.shareMotd);
}

function resultView(state, result) {
  const { testsUsed, timeMs, solved, streak, fault } = result;
  const dateStr = getTodayDateStr();
  const shareText = buildShareCard(result, dateStr);

  const timeSec = (timeMs / 1000).toFixed(1);
  const scoreLines = solved
    ? `<p class="motd-score">${testsUsed} test${testsUsed !== 1 ? 's' : ''} · ${timeSec}s</p>
       <p class="motd-streak">${streak > 1 ? `🔥 ${streak} day streak` : streak === 1 ? '🔥 Streak started' : ''}</p>`
    : `<p class="motd-score">${testsUsed} test${testsUsed !== 1 ? 's' : ''} · no fix</p>`;

  const emojiRow = '🔬'.repeat(testsUsed) + (solved ? '✅' : '❌');

  return `
    ${statusBar(state)}
    <section class="screen screen-motd-result ${solved ? 'motd-good' : 'motd-bad'}">
      <h2>${solved ? 'Fixed it!' : 'Stumped.'}</h2>
      <p class="motd-label">Machine of the Day</p>
      <p class="motd-emoji">${emojiRow}</p>
      ${scoreLines}
      ${solved ? `<p class="motd-flavour">"${fault.flavour}"</p>` : `<p class="motd-note">The correct fix was: <strong>${fault.correctFix.replace(/-/g, ' ')}</strong></p>`}
      <button class="btn btn-primary" data-action="share-motd">Copy result</button>
      <button class="btn" data-action="dismiss-motd">Back</button>
    </section>`;
}
