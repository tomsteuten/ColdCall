/** @file Service Manual screen (GDD §5, 2026-07-04): the long-horizon collection.
 * Player-facing name is "Service Manual" (2026-07-07 — "Codex" read as RPG-menu
 * jargon and told a new player nothing); the internal name stays codex
 * everywhere (state.codex, actions, files) so no save migration is needed.
 * Render-from-state: entries are derived from the fault library at render time;
 * only state.codex.fixes (times fixed per fault) is persisted.
 */

import { statusBar } from './job.js';
import { fixLabel } from '../diagnosis.js';
import { CODEX } from '../../config/balance.js';
import { escapeHtml } from '../utils.js';

/** "23/47" progress over faults still in the library (retired ids don't count). */
export function codexProgress(state, faults) {
  const total = Object.keys(faults).length;
  const mastered = Object.keys(state.codex.fixes).filter((id) => id in faults).length;
  return { mastered, total };
}

/** The next unpaid milestone, for the header hint. Null when all are paid. */
function nextMilestone(state, mastered, total) {
  const thresholds = Object.keys(CODEX.milestones).map(Number).sort((a, b) => a - b);
  for (const pct of thresholds) {
    if (!state.codex.milestonesPaid.includes(pct)) {
      return { pct, bonus: CODEX.milestones[pct], needed: Math.ceil((pct / 100) * total) - mastered };
    }
  }
  return null;
}

/**
 * Render the Codex screen into root.
 * @param {HTMLElement} root
 * @param {object} ctx
 * @param {object} ctx.state game state
 * @param {Object<string, object>} ctx.faults fault library keyed by id
 * @param {object[]} ctx.machines from machines.json
 * @param {{closeCodex: function}} ctx.actions
 */
export function render(root, ctx) {
  const { state, faults, machines, actions } = ctx;
  const { mastered, total } = codexProgress(state, faults);
  const next = nextMilestone(state, mastered, total);

  const machineName = (id) => machines.find((m) => m.id === id)?.name ?? id;

  // Stable, readable order: tier, then machine, then fault name.
  const entries = Object.values(faults)
    .slice()
    .sort((a, b) => a.tier - b.tier || a.machineType.localeCompare(b.machineType) || a.id.localeCompare(b.id))
    .map((fault) => {
      const count = state.codex.fixes[fault.id];
      if (typeof count === 'number') {
        return `
          <li class="codex-card codex-card--mastered">
            <div class="codex-card-head">
              <span class="codex-fault-name">${escapeHtml(fixLabel(fault.id))}</span>
              <span class="codex-times">×${count}</span>
            </div>
            <p class="codex-machine">Tier ${fault.tier} · ${escapeHtml(machineName(fault.machineType))}</p>
            <p class="codex-lesson">${escapeHtml(fault.lesson ?? '')}</p>
          </li>`;
      }
      return `
        <li class="codex-card codex-card--unknown">
          <div class="codex-card-head">
            <span class="codex-fault-name">???</span>
          </div>
          <p class="codex-machine">Tier ${fault.tier} · ${escapeHtml(machineName(fault.machineType))}</p>
          <p class="codex-lesson codex-lesson--hint">Diagnose it correctly once to log it.</p>
        </li>`;
    })
    .join('');

  root.innerHTML = `
    ${statusBar(state, { home: true })}
    <section class="screen screen-codex">
      <h2 class="section-title">Service Manual</h2>
      <p class="codex-progress"><strong>${mastered}/${total}</strong> faults logged</p>
      <p class="codex-explainer">Every fault you diagnose correctly gets logged here for good — the manual is yours even if you sell the business.</p>
      ${
        next
          ? `<p class="codex-next-milestone">${next.pct}% milestone pays <strong>$${next.bonus.toLocaleString('en-US')}</strong>${next.needed > 0 ? ` — ${next.needed} more to go` : ''}</p>`
          : `<p class="codex-next-milestone">Every milestone claimed. The manual is yours.</p>`
      }
      <ul class="codex-list">${entries}</ul>
      <button class="btn" data-action="close-codex">Back</button>
    </section>`;

  root.querySelector('[data-action="close-codex"]')?.addEventListener('click', actions.closeCodex);
}
