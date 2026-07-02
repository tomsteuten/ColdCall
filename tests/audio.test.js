/** @file SFX module safety: sound must be a no-op, never a crash, when disabled
 * or when no AudioContext exists (node, old browsers). The audible behaviour is
 * manual-check territory; these tests pin the failure modes. */

import { click, jingle, thunk } from '../js/audio.js';

test('all SFX are silent no-ops when the audio setting is off', () => {
  click(false);
  jingle(false);
  thunk(false);
  // Reaching here without a throw is the assertion.
  assert(true);
});

test('all SFX survive an environment with no AudioContext (node)', () => {
  // In node there is no `window`; enabled calls must still be safe no-ops.
  click(true);
  jingle(true);
  thunk(true);
  assert(true);
});
