/** @file Tiny generated SFX via WebAudio — no assets, no dependencies, no autoplay.
 * Every call takes `enabled` (state.settings.audio) so the Settings toggle is
 * the single source of truth. The AudioContext is created lazily on the first
 * enabled call, which is always inside a user gesture (a button click), so
 * browsers never block it. All failures are swallowed: sound is garnish, and a
 * broken AudioContext must never break the game.
 */

let ctx = null;

function context() {
  if (typeof window === 'undefined') return null; // node test environment
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = ctx ?? new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One enveloped oscillator note. Times are seconds relative to now. */
function tone(ac, { freq, at = 0, dur = 0.08, type = 'square', peak = 0.045 }) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t0 = ac.currentTime + at;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * Soft UI blip for button presses.
 * @param {boolean} enabled state.settings.audio
 */
export function click(enabled) {
  if (!enabled) return;
  try {
    const ac = context();
    if (ac) tone(ac, { freq: 660, dur: 0.05, type: 'triangle', peak: 0.035 });
  } catch { /* sound is optional, never fatal */ }
}

/**
 * Three-note rising jingle for a correct fix — the "running cold again" payoff.
 * @param {boolean} enabled state.settings.audio
 */
export function jingle(enabled) {
  if (!enabled) return;
  try {
    const ac = context();
    if (!ac) return;
    tone(ac, { freq: 523.25, at: 0.0, dur: 0.12, type: 'square' }); // C5
    tone(ac, { freq: 659.25, at: 0.1, dur: 0.12, type: 'square' }); // E5
    tone(ac, { freq: 783.99, at: 0.2, dur: 0.22, type: 'square' }); // G5
  } catch { /* sound is optional, never fatal */ }
}

/**
 * Low descending thunk for a wrong fix.
 * @param {boolean} enabled state.settings.audio
 */
export function thunk(enabled) {
  if (!enabled) return;
  try {
    const ac = context();
    if (!ac) return;
    tone(ac, { freq: 220, at: 0.0, dur: 0.12, type: 'sawtooth', peak: 0.035 });
    tone(ac, { freq: 164.81, at: 0.1, dur: 0.18, type: 'sawtooth', peak: 0.035 });
  } catch { /* sound is optional, never fatal */ }
}
