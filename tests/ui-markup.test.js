/** @file Static UI-template checks for HTML attributes that must remain machine-readable. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultState } from '../js/state.js';
import { startJob } from '../js/diagnosis.js';
import { isFirstJobOnboarding, jobView, invoiceView, repairView, testCostCopy, homeView, callbacksView } from '../js/ui/job.js';
import { staffExplainerHTML } from '../js/ui/shop.js';
import { REPUTATION, TECHS, OFFLINE } from '../config/balance.js';

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

test('machine art exposes stable machine and state hooks for CSS motion', () => {
  const state = onboardingState();
  state.settings.graphicsMode = 'rendered';
  const faultHtml = jobView({ state, faults, machines, clients });
  assert(faultHtml.includes('machine-stage--slushie-machine'), 'machine identity should reach CSS');
  assert(faultHtml.includes('machine-stage--fault'), 'untested machine should use fault motion');
  assert(jobUi.includes("imageSrc ? ' machine-stage--raster' : ''"), 'rendered art should use the larger raster stage');

  state.jobs.active.testsRun.push('error-log');
  const openHtml = jobView({ state, faults, machines, clients });
  assert(openHtml.includes('machine-stage--open'), 'inspected machine should use open motion');

  const repairHtml = repairView({ state, repairBeat: { machineType: 'slushie-machine' } });
  assert(repairHtml.includes('machine-stage--working'), 'repair payoff should use working motion');
});

test('workshop machine ids from a save are escaped inside HTML attributes', () => {
  const state = defaultState();
  state.player.tierUnlocked = 2; // workshop panel is hidden until Tier 2
  state.workshop.machines.push({
    id: 'x" onmouseover="alert(1)',
    machineType: 'slushie-machine',
    faultId: 'onboarding-fault',
    status: 'broken',
  });
  const html = homeView({ state });
  assert(!html.includes('id: \'x" onmouseover'), 'raw quote must not survive');
  assert(!html.includes('onmouseover="alert'), 'hostile attribute must not be injectable');
  assert(html.includes('x&quot; onmouseover'), 'id should be entity-escaped in the attribute');
});

test('workshop machine with an unknown machineType renders instead of crashing', () => {
  const state = defaultState();
  state.player.tierUnlocked = 2; // workshop panel is hidden until Tier 2
  state.workshop.machines.push({
    id: 'm1', machineType: 'no-such-machine', faultId: 'f', status: 'repaired',
  });
  const html = homeView({ state });
  assert(html.includes('no-such-machine'), 'unknown type should fall back to its raw name');
  assert(html.includes('Sell ($0)'), 'unknown type should offer a $0 sale, not throw');
});

test('workshop panel is hidden from Tier 1 players and shown from Tier 2', () => {
  const state = defaultState(); // tier 1
  assert(!homeView({ state }).includes('Refurbishing Workshop'), 'fresh save should not see the workshop');
  state.player.tierUnlocked = 2;
  assert(homeView({ state }).includes('Refurbishing Workshop'), 'Tier 2 unlock should reveal the workshop');
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

// --- Session 19: callback / staff / offline clarity ---

const cbFault = { ...fault, machineType: 'slushie-machine' };
const cbFaults = { 'cb-fault': { ...cbFault, id: 'cb-fault' } };
const cbClients = [{ id: 'kwik-stop', name: 'Kwik Stop' }];

/** A state with a single callback whose due/expiry/source we control. */
function stateWithCallback(overrides) {
  const state = defaultState();
  state.jobs.callbacks = [
    {
      faultId: 'cb-fault',
      clientId: 'kwik-stop',
      dueDay: '2026-06-10',
      expiryDay: '2026-06-15',
      misses: 1,
      source: 'player',
      ...overrides,
    },
  ];
  return state;
}

test('a due player callback shows its expiry timing and the reputation it risks', () => {
  // Pin "today" relative to the fixture dates: due 2026-06-10, expiry 2026-06-15.
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-06-13T12:00:00Z');
  try {
    const state = stateWithCallback({});
    const html = callbacksView({ state, faults: cbFaults, clients: cbClients });
    assert(html.includes('data-take="0"'), 'a due callback should be takeable');
    assert(html.includes('Due now · expires in 2 days'), 'due callback should show its claim window');
    assert(html.includes(`lose ${REPUTATION.expiredCallbackRepPenalty} rep`), 'player obligation should warn about the rep penalty');
  } finally {
    Date.now = realNow;
  }
});

test('a not-yet-due tech rescue is shown returning soon, untakeable and penalty-free', () => {
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-06-13T12:00:00Z');
  try {
    const state = stateWithCallback({
      dueDay: '2026-06-14',
      expiryDay: '2026-06-17',
      source: 'tech',
      techName: 'Mike',
    });
    const html = callbacksView({ state, faults: cbFaults, clients: cbClients });
    assert(!html.includes('data-take='), 'a not-yet-due callback must not be takeable');
    assert(html.includes('Returns tomorrow'), 'pending callback should show when it returns');
    assert(html.includes('expires with no penalty'), 'a tech rescue should be flagged penalty-free');
    assert(html.includes('Mike&#39;s miss'), 'rescue should attribute the responsible tech (escaped)');
  } finally {
    Date.now = realNow;
  }
});

test('home Callbacks button distinguishes ready from returning-soon callbacks', () => {
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-06-13T12:00:00Z');
  try {
    // Only a future callback: button must show "returning soon", not vanish.
    const pendingOnly = stateWithCallback({ dueDay: '2026-06-14', source: 'tech' });
    const html = homeView({ state: pendingOnly });
    assert(html.includes('returning soon'), 'a queued-but-not-due callback should remain visible on home');
    assert(html.includes('data-action="open-callbacks"'), 'the Callbacks button should still render');
  } finally {
    Date.now = realNow;
  }
});

test('the offline report attributes jobs and misses per technician', () => {
  const state = defaultState();
  const offlineReport = {
    jobsDone: 5,
    totalEarned: 250,
    callbacksAdded: 1,
    techReports: [
      { name: 'Dave', jobs: 3, earned: 150, callbacks: 0 },
      { name: 'Mike', jobs: 3, earned: 100, callbacks: 1 },
    ],
  };
  const html = homeView({ state, offlineReport });
  assert(html.includes('Dave: 3 jobs · $150'), 'Dave should be attributed his jobs and earnings');
  assert(html.includes('Mike: 3 jobs · $100 · 1 miss'), 'Mike should be attributed his miss');
  assert(html.includes('back on the board tomorrow'), 'offline callbacks should be explained, not left to seem vanished');
});

test('the staff explainer states jobs/hour, success, offline cap, wage, and callback risk before hiring', () => {
  const html = staffExplainerHTML();
  assert(html.includes(`${TECHS.jobsPerHour} jobs/hour`), 'should state expected jobs/hour');
  assert(html.includes(`${Math.round(TECHS.baseSuccessRate * 100)}% success`), 'should state success rate');
  assert(html.includes(`${OFFLINE.baseCapHours}h`), 'should state the offline cap');
  assert(html.includes('No wage'), 'should clarify launch techs have no wage');
  assert(html.includes('rescue callback'), 'should explain the callback risk');
});
