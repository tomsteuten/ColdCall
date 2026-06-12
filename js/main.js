/** @file Boot and screen routing. Session 1: load state, render dev-build banner. */

import { load, save } from './state.js';

const { state, fresh, error } = load();
if (error) {
  // Saves are sacred: the corrupt blob is still in localStorage, untouched.
  console.error(`Cold Call: existing save could not be loaded (${error}). Starting fresh without overwriting it.`);
}

const app = document.getElementById('app');
app.innerHTML = `
  <h1 class="dev-title">Cold Call — dev build</h1>
  <p class="dev-meta">save schema v${state.schemaVersion} · ${fresh ? 'new game' : 'save loaded'}</p>
`;

save(state);
