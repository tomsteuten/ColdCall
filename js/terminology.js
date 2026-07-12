/** @file Optional, non-spoiler repair terminology help shared by jobs and the Service Manual. */

import { escapeHtml } from './utils.js';

// Definitions describe the component or measurement only. They deliberately do
// not say which symptom, test result or repair points to the hidden fault.
export const TERM_DEFINITIONS = {
  auger: 'The spiral paddle inside a slushie or granita bowl that slowly turns the mix.',
  beater: 'The rotating assembly that scrapes frozen product from a freezing barrel and mixes it evenly.',
  barrel: 'The chilled cylinder where soft-serve or frozen yoghurt freezes while it is mixed.',
  capacitor: 'A small electrical part that helps a motor start and keep running.',
  condenser: 'The part that releases heat from the refrigeration system into the surrounding air.',
  continuity: 'An electrical check for whether current has an unbroken path through a component or wire.',
  evaporator: 'The cold surface where refrigerant absorbs heat from the product or water.',
  interlock: 'A safety switch that prevents operation unless a lid, door or panel is correctly closed.',
  microswitch: 'A small switch operated by a lever, lid or moving mechanism.',
  regas: 'Recharge the sealed refrigeration system with refrigerant after its condition has been verified.',
  setpoint: 'The target temperature the controller is trying to maintain.',
  solenoid: 'An electrically operated valve that opens or closes a flow path.',
  thermostat: 'A control that switches cooling on or off in response to temperature.',
  thermistor: 'A temperature sensor whose electrical resistance changes as it gets warmer or colder.',
};

const TERM_FORMS = {
  augers: 'auger',
  beaters: 'beater',
  barrels: 'barrel',
  capacitors: 'capacitor',
  condensers: 'condenser',
  evaporators: 'evaporator',
  interlocks: 'interlock',
  microswitches: 'microswitch',
  setpoints: 'setpoint',
  solenoids: 'solenoid',
  thermostats: 'thermostat',
  thermistors: 'thermistor',
};

const FORMS = [...Object.keys(TERM_DEFINITIONS), ...Object.keys(TERM_FORMS)]
  .sort((a, b) => b.length - a.length);
const TERM_RE = new RegExp(`\\b(${FORMS.join('|')})\\b`, 'gi');

function canonicalTerm(form) {
  const lower = String(form).toLowerCase();
  return TERM_FORMS[lower] ?? lower;
}

/** Escape plain player-facing text and turn supported terms into optional buttons. */
export function withTermHelp(text) {
  const source = String(text);
  let html = '';
  let at = 0;
  for (const match of source.matchAll(TERM_RE)) {
    html += escapeHtml(source.slice(at, match.index));
    const term = canonicalTerm(match[0]);
    html += `<button class="term-trigger" type="button" data-term-help="${term}" aria-expanded="false">${escapeHtml(match[0])}<span class="term-trigger-mark" aria-hidden="true">?</span></button>`;
    at = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(at));
}

/** Compact disclosure for technical terms that occur inside other buttons. */
export function termDisclosure(texts, label = 'Repair terms') {
  const found = new Set();
  for (const text of texts) {
    for (const match of String(text).matchAll(TERM_RE)) found.add(canonicalTerm(match[0]));
  }
  if (found.size === 0) return '';
  const definitions = [...found]
    .map((term) => `<p><strong>${escapeHtml(term[0].toUpperCase() + term.slice(1))}</strong> — ${escapeHtml(TERM_DEFINITIONS[term])}</p>`)
    .join('');
  return `<details class="term-disclosure"><summary>${escapeHtml(label)}</summary>${definitions}</details>`;
}

/** Wire inline term buttons without changing screen state or triggering a re-render. */
export function wireTermHelp(root) {
  root.querySelectorAll('[data-term-help]').forEach((button) => {
    button.addEventListener('click', () => {
      const container = button.closest('li, p, dd, dt, .test-label') ?? button.parentElement;
      const existing = [...(container?.querySelectorAll('.term-definition') ?? [])]
        .find((el) => el.dataset.termDefinition === button.dataset.termHelp);
      root.querySelectorAll('.term-definition').forEach((el) => {
        if (el !== existing) el.remove();
      });
      root.querySelectorAll('[data-term-help][aria-expanded="true"]').forEach((el) => {
        if (el !== button) el.setAttribute('aria-expanded', 'false');
      });
      if (existing) {
        existing.remove();
        button.setAttribute('aria-expanded', 'false');
        return;
      }
      const term = button.dataset.termHelp;
      const definition = TERM_DEFINITIONS[term];
      if (!definition) return;
      const note = document.createElement('span');
      note.className = 'term-definition';
      note.dataset.termDefinition = term;
      note.setAttribute('role', 'note');
      note.textContent = `${term[0].toUpperCase() + term.slice(1)} — ${definition}`;
      container?.appendChild(note);
      button.setAttribute('aria-expanded', 'true');
    });
  });
}
