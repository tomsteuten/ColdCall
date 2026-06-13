/** @file Static UI-template checks for HTML attributes that must remain machine-readable. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultState } from '../js/state.js';
import { startJob } from '../js/diagnosis.js';
import { isFirstJobOnboarding, jobView, testCostCopy } from '../js/ui/job.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobUi = readFileSync(join(root, 'js/ui/job.js'), 'utf8');

test('UI templates do not use smart quotes as HTML attribute delimiters', () => {
  const attributeWithSmartQuote = /\b(?:class|data-[\w-]+|aria-[\w-]+)=["“”]?[\u201c\u201d]/;
  assert(
    !attributeWithSmartQuote.test(jobUi),
    'smart quotes in HTML attributes break CSS selectors and event wiring'
  );
});

test('invoice Done button exposes the dismiss action with ASCII quotes', () => {
  assert(
    jobUi.includes('<button class="btn btn-primary" data-action="dismiss-invoice">Done</button>'),
    'invoice Done button must match the selector wired by job.js'
  );
  assert(
    jobUi.includes("root.querySelectorAll('[data-action=\"dismiss-invoice\"]')"),
    'invoice dismiss selector must remain wired'
  );
});

test('save-derived job fallbacks are escaped before innerHTML interpolation', () => {
  assert(jobUi.includes('escapeHtml(machineName)'), 'machine fallback must be escaped');
  assert(jobUi.includes('data-fix="${escapeHtml(id)}"'), 'fix ids in attributes must be escaped');
  assert(jobUi.includes('${escapeHtml(fixLabel(id))}'), 'fix labels must be escaped');
});

const fault = {
  id: 'onboarding-fault',
  machineType: 'slushie-machine',
  symptoms: ['The bowl is warm.'],
  tests: {},
  correctFix: 'right-fix',
  wrongFixes: ['wrong-fix'],
  payout: 100,
  partsCost: 10,
  flavour: 'Cold again.',
};
const faults = { [fault.id]: fault };
const machines = [{ id: 'slushie-machine', name: 'Slushie Machine' }];
const clients = [{ id: 'kwik-stop', name: 'Kwik Stop' }];

function onboardingState() {
  const state = defaultState();
  startJob(state, fault, 'kwik-stop', () => 0);
  return state;
}

test('diagnostic cost copy shows minutes and projected speed-bonus consequence', () => {
  const state = onboardingState();
  assertEqual(testCostCopy(state.jobs.active, 'error-log'), '+2 min · speed bonus $40 → $36');
});

test('first fresh job renders integrated diagnosis guidance and an irreversible-choice guard', () => {
  const state = onboardingState();
  assert(isFirstJobOnboarding(state), 'fresh first ticket should receive onboarding');
  const initial = jobView({ state, faults, machines, clients });
  assert(initial.includes('Read the symptoms.'), 'first ticket should teach the loop');
  assert(initial.includes('+2 min · speed bonus $40 → $36'), 'test cost must be visible before use');
  assert(initial.includes('Your first selection gets one confirmation.'), 'first fix should advertise the guard');

  const guarded = jobView({
    state,
    faults,
    machines,
    clients,
    pendingFirstFixId: 'right-fix',
  });
  assert(guarded.includes('Commit Right fix?'), 'guard should name the selected fix');
  assert(guarded.includes('This ends diagnosis.'), 'guard should explain irreversibility');
  assert(guarded.includes('reduced-rate callback tomorrow'), 'guard should explain the failure consequence');
  assert(guarded.includes('data-action="confirm-first-fix"'), 'guard should expose confirmation wiring');
  assert(guarded.includes('data-action="cancel-first-fix"'), 'guard should let the player keep diagnosing');
});

test('returning players do not receive first-job guidance or confirmation friction', () => {
  const state = onboardingState();
  state.stats.jobsCompleted = 1;
  assert(!isFirstJobOnboarding(state), 'completed players are returning players');
  const html = jobView({ state, faults, machines, clients });
  assert(!html.includes('diagnosis-guide'), 'returning job should omit onboarding');
  assert(!html.includes('Your first selection gets one confirmation.'), 'returning fix should commit directly');
  assert(html.includes('data-fix="right-fix"'), 'normal fix buttons should remain available');
});
