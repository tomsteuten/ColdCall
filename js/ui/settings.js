/** @file Retro settings modal overlay for audio, save transfer, and progress reset. */

import { exportSave } from '../state.js';
import { escapeHtml } from '../utils.js';

/**
 * Render settings modal HTML.
 * @param {object} state
 * @param {object} feedback
 * @param {string|null} feedback.exportMessage
 * @param {string|null} feedback.importError
 * @returns {string} HTML string
 */
export function renderModal(state, feedback = {}) {
  const exportBlob = exportSave(state);
  const audioEnabled = !!state.settings.audio;
  const guidanceMode = ['auto', 'on', 'off'].includes(state.settings.guidanceMode)
    ? state.settings.guidanceMode
    : 'auto';
  const { exportMessage, importError } = feedback;

  return `
    <div class="modal-overlay" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title" id="settings-title">Settings</h2>
          <button class="btn-close-modal" data-action="close-settings" aria-label="Close settings">&times;</button>
        </div>
        
        <div class="settings-section">
          <div class="settings-row">
            <span class="settings-label">Sound FX</span>
            <button class="btn-toggle ${audioEnabled ? 'active' : ''}" data-action="toggle-audio">
              ${audioEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div class="settings-guidance">
            <div>
              <span class="settings-label">Beginner guidance</span>
              <p>Auto teaches the first ticket, then recedes.</p>
            </div>
            <div class="settings-segmented" role="group" aria-label="Beginner guidance mode">
              ${['auto', 'on', 'off'].map((mode) => `<button class="btn-toggle${guidanceMode === mode ? ' active' : ''}" data-guidance-mode="${mode}" aria-pressed="${guidanceMode === mode}">${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}
            </div>
          </div>
        </div>

        <hr class="divider">

        <div class="settings-section">
          <div class="settings-textbox-group">
            <label class="settings-label">Export Save Data</label>
            <div class="settings-textbox-row">
              <input type="text" readonly value="${exportBlob}" class="settings-input settings-export-input" aria-label="Export save data blob">
              <button class="btn btn-settings-action" data-action="copy-settings-save">Copy</button>
            </div>
            ${exportMessage ? `<p class="settings-ok">${escapeHtml(exportMessage)}</p>` : ''}
          </div>

          <div class="settings-textbox-group">
            <label class="settings-label">Import Save Data</label>
            <div class="settings-textbox-row">
              <input type="text" placeholder="Paste save blob here…" class="settings-input settings-import-input" aria-label="Import save data blob">
              <button class="btn btn-settings-action" data-action="import-settings-save">Import</button>
            </div>
            ${importError ? `<p class="settings-err">${escapeHtml(importError)}</p>` : ''}
          </div>
        </div>

        <hr class="divider">

        <div class="settings-section">
          <button class="btn btn-reset-progress" data-action="reset-progress">Reset progress</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to the modal DOM element.
 * @param {HTMLElement} modalEl
 * @param {object} actions
 */
export function wire(modalEl, actions) {
  modalEl.querySelector('[data-action="close-settings"]')?.addEventListener('click', actions.closeSettings);
  modalEl.querySelector('[data-action="toggle-audio"]')?.addEventListener('click', actions.toggleAudio);
  modalEl.querySelectorAll('[data-guidance-mode]').forEach((button) => {
    button.addEventListener('click', () => actions.setGuidanceMode(button.dataset.guidanceMode));
  });

  const copyBtn = modalEl.querySelector('[data-action="copy-settings-save"]');
  const exportInput = modalEl.querySelector('.settings-export-input');
  if (copyBtn && exportInput) {
    copyBtn.addEventListener('click', () => {
      actions.exportSave(exportInput);
    });
  }

  const importBtn = modalEl.querySelector('[data-action="import-settings-save"]');
  const importInput = modalEl.querySelector('.settings-import-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
      actions.importSave(importInput.value);
    });
  }

  modalEl.querySelector('[data-action="reset-progress"]')?.addEventListener('click', actions.resetProgress);
}
