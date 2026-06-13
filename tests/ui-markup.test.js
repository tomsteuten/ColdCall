/** @file Static UI-template checks for HTML attributes that must remain machine-readable. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultState } from '../js/state.js';
import { startJob } from '../js/diagnosis.js';
import { isFirstJobOnboarding, jobView, invoiceView, repairView, testCostCopy } from '../js/ui/job.js';

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

// --- failure-as-learning receipt (GDD §2.1) ---

const lessonFault = {
  ...fault,
  lesson: 'A warm bowl with the compressor flat out means iced coils, not low gas — defrost it.',
};

test('a wrong fresh fix teaches: chosen vs correct fix and the discriminating clue', () => {
  const state = defaultState();
  const invoice = {
    correct: false,
    fault: lessonFault,
    earned: 40,
    chosenFix: 'wrong-fix',
    callback: false,
    callbackSource: null,
    unlockedTier: null,
    minutesSpent: 5,
  };
  const html = invoiceView({ state, invoice });
  assert(html.includes('Where it went wrong'), 'failure receipt should frame the lesson');
  assert(html.includes('You committed') && html.includes('Wrong fix'), 'should name the chosen fix');
  assert(html.includes('Correct fix') && html.includes('Right fix'), 'should reveal the correct fix');
  assert(html.includes(lessonFault.lesson), 'should explain the discriminating clue');
  assert(html.includes('saved for the return visit'), 'a fresh miss should mention preserved evidence');
});

test('a repeat callback miss teaches but omits the fresh-miss evidence line', () => {
  const state = defaultState();
  const invoice = {
    correct: false,
    fault: lessonFault,
    earned: 0,
    chosenFix: 'wrong-fix',
    callback: true,
    callbackSource: 'player',
    unlockedTier: null,
    minutesSpent: 0,
  };
  const html = invoiceView({ state, invoice });
  assert(html.includes('Where it went wrong'), 'a repeat miss is still a teaching moment');
  assert(html.includes('Correct fix') && html.includes('Right fix'), 'should still reveal the correct fix');
  assert(!html.includes('saved for the return visit'), 'the repeat-miss receipt already states it returns');
});

test('a correct fix shows no failure lesson and hides the correct-fix reveal', () => {
  const state = defaultState();
  const invoice = {
    correct: true,
    fault: lessonFault,
    earned: 90,
    chosenFix: 'right-fix',
    callback: false,
    callbackSource: null,
    unlockedTier: null,
    minutesSpent: 0,
  };
  const html = invoiceView({ state, invoice });
  assert(!html.includes('Where it went wrong'), 'a win is not a lesson in failure');
  assert(!html.includes('Correct fix'), 'do not reveal answers on a successful job');
});

// --- repair beat (GDD §2.3) ---

test('the repair beat shows the working machine art with a holdable, skippable control', () => {
  const state = defaultState();
  const html = repairView({ state, repairBeat: { machineType: 'slushie-machine' } });
  // Working state pins the green "COOL" indicator — the visible payoff.
  assert(html.includes('COOL'), 'repair beat should render the working machine art');
  assert(html.includes('art-slot--has-image'), 'known machine art should fill the slot');
  assert(html.includes('data-repair-hold'), 'beat should expose the hold-to-tighten control');
  assert(html.includes('data-action="finish-repair"'), 'beat must always be skippable');
});

test('the repair beat keyboard/skip wiring is hooked up', () => {
  assert(
    jobUi.includes("root.querySelectorAll('[data-action=\"finish-repair\"]')"),
    'finish-repair (skip) must be wired'
  );
  assert(jobUi.includes('wireRepairHold(root, actions)'), 'the hold gesture must be wired');
  assert(jobUi.includes("e.key === 'Enter'"), 'the hold control must finish on keyboard for accessibility');
});

test('the repair beat falls back to text for an unknown machine and stays skippable', () => {
  const state = defaultState();
  const html = repairView({ state, repairBeat: { machineType: 'no-such-machine' } });
  assert(!html.includes('art-slot--has-image'), 'unknown machine should not claim a real illustration');
  assert(html.includes('[ repaired ]'), 'unknown machine should show a text fallback');
  assert(html.includes('data-action="finish-repair"'), 'fallback beat must still be skippable');
});
