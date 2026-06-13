/** @file Machine of the Day result screen. */

import { statusBar } from './job.js';
import { buildShareCard, getTodayDateStr } from '../motd.js';
import { MOTD } from '../../config/balance.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Render the MotD result screen into root.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {object} ctx.state game state
 * @param {object} ctx.motdResult { testsUsed, simMinutes, solved, streak, fault, puzzleDateStr }
 * @param {{ dismissMotdResult: function, shareMotd: function }} ctx.actions
 */
export function render(root, ctx) {
  const { state, motdResult, actions } = ctx;
  root.innerHTML = resultView(state, motdResult);
  root.querySelector('[data-action="dismiss-motd"]')?.addEventListener('click', actions.dismissMotdResult);
  root.querySelector('[data-action="share-motd"]')?.addEventListener('click', actions.shareMotd);
}

function resultView(state, result) {
  const { testsUsed, simMinutes, solved, streak, fault } = result;

  // Use stored puzzle date so the card is stable across UTC-midnight refreshes.
  const dateStr =
    result.puzzleDateStr ??
    state.motd.lastResult?.puzzleDateStr ??
    state.motd.lastPlayedDate ??
    getTodayDateStr();

  const epochMs = new Date(MOTD.epochDate).getTime();
  const dayMs = new Date(dateStr).getTime();
  const dayNumber = Math.floor((dayMs - epochMs) / DAY_MS) + 1;

  // Score line: tests used, then simulated diagnostic minutes (the interruption-safe
  // measure). Legacy results predate simMinutes — show tests only rather than the
  // wall-clock time those saves stored, which no longer counts (GDD §5).
  const minutesClause =
    typeof simMinutes === 'number' && Number.isFinite(simMinutes) ? ` · ${simMinutes} min` : '';
  const emojiRow = '🔬'.repeat(testsUsed) + (solved ? '✅' : '❌');

  const streakLine = solved && streak > 0
    ? `<p class="motd-streak">${streak > 1 ? `🔥 ${streak} day streak` : '🔥 Streak started'}</p>`
    : '';

  // Clean-streak / callback-shame flourish (GDD §5).
  const cleanStreak = state.stats.cleanStreak ?? 0;
  const callbackCount = state.jobs.callbacks.length;
  let statsLine = '';
  if (cleanStreak >= 1) {
    statsLine = `<p class="motd-clean">🧹 ${cleanStreak} clean in a row</p>`;
  } else if (callbackCount > 0) {
    statsLine = `<p class="motd-shame">⚠️ ${callbackCount} callback${callbackCount !== 1 ? 's' : ''} waiting</p>`;
  }

  const flavourLine = solved
    ? `<p class="motd-flavour">"${fault.flavour}"</p>`
    : `<p class="motd-note">The correct fix was: <strong>${fault.correctFix.replace(/-/g, ' ')}</strong></p>`;

  return `
    ${statusBar(state)}
    <section class="screen screen-motd-result ${solved ? 'motd-good' : 'motd-bad'}">
      <div class="motd-card">
        <p class="motd-label">Machine of the Day · Day ${dayNumber}</p>
        <p class="motd-emoji">${emojiRow}</p>
        <h2 class="motd-verdict">${solved ? 'Fixed it!' : 'Stumped.'}</h2>
        <p class="motd-score">${testsUsed} test${testsUsed !== 1 ? 's' : ''}${minutesClause}</p>
        ${streakLine}
        ${statsLine}
        ${flavourLine}
      </div>
      <button class="btn btn-primary" data-action="share-motd">📋 Copy result</button>
      <button class="btn" data-action="dismiss-motd">Back</button>
    </section>`;
}
