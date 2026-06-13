/** @file Tiny shared utilities used across the codebase. No game logic here. */

/**
 * Escape a string for safe interpolation into an innerHTML template.
 * Converts the five HTML special characters to their entity equivalents so
 * a hostile string in a save file can never inject tags or event handlers.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
