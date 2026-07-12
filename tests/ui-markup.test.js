/** @file Static UI-template checks for HTML attributes that must remain machine-readable. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultState } from '../js/state.js';
import { startJob } from '../js/diagnosis.js';
import { isFirstJobOnboarding, showsBeginnerGuidance, jobView, invoiceView, repairView, testCostCopy, homeView, callbacksView, contactFlavourLine, statusBar } from '../js/ui/job.js';
import { TERM_DEFINITIONS, termDisclosure, withTermHelp } from '../js/terminology.js';
import { staffExplainerHTML } from '../js/ui/shop.js';
import { render as renderCodex } from '../js/ui/codex.js';
import { REPUTATION, TECHS, OFFLINE } from '../config/balance.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobUi = readFileSync(join(root, 'js/ui/job.js'), 'utf8');
const mainCss = readFileSync(join(root, 'css/main.css'), 'utf8');
const shopUi = readFileSync(join(root, 'js/ui/shop.js'), 'utf8');
const codexUi = readFileSync(join(root, 'js/ui/codex.js'), 'utf8');

test('UI templates do not use smart quotes as HTML attribute delimiters', () => {
  const attributeWithSmartQuote = /\b(?:class|data-[\w-]+|aria-[\w-]+)=["“”]?[\u201c\u201d]/;
  assert(
    !attributeWithSmartQuote.test(jobUi),
    'smart quotes in HTML attributes break CSS selectors and event wiring'
  );
});

test('service manual exposes accessible all, logged and unknown filters', () => {
  assert(codexUi.includes('data-codex-filter="all"'), 'manual should expose the all filter');
  assert(codexUi.includes('data-codex-filter="logged"'), 'manual should expose the logged filter');
  assert(codexUi.includes('data-codex-filter="unknown"'), 'manual should expose the unknown filter');
  assert(codexUi.includes('aria-pressed='), 'manual filters should expose their selected state');
});

test('service manual collapses indistinguishable unknown faults by tier and machine', () => {
  const state = defaultState();
  state.codex.fixes['known-fault'] = 2;
  const faults = {
    'unknown-a': { id: 'unknown-a', tier: 1, machineType: 'machine-a', lesson: '' },
    'unknown-b': { id: 'unknown-b', tier: 1, machineType: 'machine-a', lesson: '' },
    'unknown-c': { id: 'unknown-c', tier: 1, machineType: 'machine-b', lesson: '' },
    'known-fault': { id: 'known-fault', tier: 1, machineType: 'machine-a', lesson: 'Known lesson.' },
  };
  const root = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  renderCodex(root, {
    state,
    faults,
    machines: [{ id: 'machine-a', name: 'Machine A' }, { id: 'machine-b', name: 'Machine B' }],
    actions: { closeCodex() {} },
  });

  const unknownCards = root.innerHTML.match(/codex-card--unknown/g) ?? [];
  assertEqual(unknownCards.length, 2, 'two tier/machine groups should render as two unknown cards');
  assert(root.innerHTML.includes('aria-label="2 unknown faults"'), 'the grouped card should expose its hidden fault count');
  assert(root.innerHTML.includes('Known fault'), 'logged faults should remain individual reference entries');
});

test('upgrade ladder marks one actionable item as the next goal', () => {
  assert(shopUi.includes("const nextGoal = ladder.find"), 'shop should derive the next unlocked purchase');
  assert(shopUi.includes('shop-card-next'), 'next purchase should receive a stable visual hook');
  assert(shopUi.includes('Next goal'), 'next purchase should be named in the UI');
});

test('invoice actions: Next ticket is primary, Home secondary, both wired (2026-07-04)', () => {
  assert(
    jobUi.includes('<button class="btn btn-primary" data-action="invoice-next-ticket">Next ticket</button>'),
    'invoice primary button must chain into the next ticket'
  );
  assert(
    jobUi.includes('<button class="btn" data-action="dismiss-invoice">Home</button>'),
    'invoice secondary button must go home'
  );
  assert(
    jobUi.includes("root.querySelectorAll('[data-action=\"dismiss-invoice\"]')"),
    'invoice dismiss selector must remain wired'
  );
  assert(
    jobUi.includes("root.querySelectorAll('[data-action=\"invoice-next-ticket\"]')"),
    'invoice next-ticket selector must be wired'
  );
  assert(mainCss.includes('.invoice-actions .btn') && mainCss.includes('text-align: center'),
    'both invoice actions should share centered alignment');
  assert(mainCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'),
    'normal invoice actions should share one compact row');
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

test('diagnostic cost copy explains that the first test unlocks the speed bonus', () => {
  // The bonus is gated on running at least one test (GDD §2.1, 2026-07-04), so
  // before any test the earned bonus is $0 and the first test raises it.
  const state = onboardingState();
  assertEqual(testCostCopy(state.jobs.active, 'error-log'), '+2 min · unlocks $36 speed bonus');
});

test('first fresh job renders integrated diagnosis guidance and an irreversible-choice guard', () => {
  const state = onboardingState();
  assert(isFirstJobOnboarding(state), 'fresh first ticket should receive onboarding');
  assert(showsBeginnerGuidance(state), 'auto guidance should teach the first ticket');
  const initial = jobView({ state, faults, machines, clients });
  assert(initial.includes('Start here.'), 'first ticket should begin at the reported symptoms');
  assert(initial.includes('data-action="go-to-diagnostics"'), 'first ticket should provide a direct path to the next action');
  assert(initial.includes('Next: gather evidence.'), 'diagnostics should teach only the current step');
  assert(initial.includes('What do these tests check?'), 'test purpose should be available without being forced open');
  assert(initial.includes('<strong>+2 min</strong>'), 'test time cost must be visible before use');
  assert(initial.includes('Unlocks $36 bonus'), 'first-test bonus consequence must be named as an unlock');
  assert(initial.includes('No bonus for a blind guess'), 'locked instrument should explain why evidence matters');
  assert(initial.includes('class="diagnosis-steps"'), 'onboarding should retain the current-step rail');
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
  assert(!html.includes('context-guide'), 'auto guidance should recede for returning players');
  assert(html.includes('class="diagnosis-steps"'), 'returning jobs should retain compact loop guidance');
  assert(html.includes('aria-current="step">Review symptoms'), 'symptoms should be the initial active step');
  assert(!html.includes('Your first selection gets one confirmation.'), 'returning fix should commit directly');
  assert(html.includes('data-fix="right-fix"'), 'normal fix buttons should remain available');
});

test('guidance mode can force help on or turn it off without removing the first-fix guard', () => {
  const state = onboardingState();
  state.settings.guidanceMode = 'off';
  assert(!showsBeginnerGuidance(state), 'off should suppress contextual help');
  const hidden = jobView({ state, faults, machines, clients });
  assert(!hidden.includes('data-action="go-to-diagnostics"'), 'off should keep the ticket compact');
  assert(hidden.includes('Your first selection gets one confirmation.'), 'help preference must not remove the safety guard');

  state.stats.jobsCompleted = 2;
  state.settings.guidanceMode = 'on';
  assert(showsBeginnerGuidance(state), 'on should restore help for a returning player');
  assert(jobView({ state, faults, machines, clients }).includes('Next: gather evidence.'),
    'forced help should use the same contextual coach');
});

test('completed evidence advances the coach and produces a visible machine-state acknowledgement', () => {
  const state = onboardingState();
  state.jobs.active.testsRun.push('temp-probe');
  state.jobs.active.minutesSpent = 5;
  const html = jobView({ state, faults, machines, clients });
  assert(html.includes('Evidence logged.'), 'coach should respond to the completed test');
  assert(html.includes('Temperature reading logged'), 'art should acknowledge the latest physical action');
  assert(!html.includes('data-action="go-to-diagnostics"'), 'the symptoms-step action should recede after evidence exists');
});

test('technical terms expose neutral point-of-use definitions without changing action labels', () => {
  const inline = withTermHelp('Auger and thermistor readings.');
  assert(inline.includes('data-term-help="auger"'), 'auger should be an inline optional definition');
  assert(inline.includes('data-term-help="thermistor"'), 'multiple supported terms should be discoverable');
  assert(TERM_DEFINITIONS.auger.includes('spiral paddle'), 'auger definition should use plain physical language');
  assert(!TERM_DEFINITIONS.auger.toLowerCase().includes('replace'), 'definition must not recommend a repair');
  assert(!withTermHelp('<img src=x onerror=alert(1)> auger').includes('<img'),
    'term markup must still escape hostile player-facing text');
  const repairHelp = termDisclosure(['Replace auger motor', 'Replace thermostat'], 'Repair terms');
  assert(repairHelp.includes('<details'), 'terms inside repair buttons should use an adjacent disclosure');
  assert(repairHelp.includes('The spiral paddle'), 'repair disclosure should contain the same neutral definition');
});

test('diagnosis step indicator advances from symptoms to measured evidence', () => {
  const state = onboardingState();
  state.stats.jobsCompleted = 1;
  state.jobs.active.testsRun.push('temp-probe');
  const html = jobView({ state, faults, machines, clients });
  assert(html.includes('is-complete">Review symptoms'), 'symptoms should complete after the first test');
  assert(html.includes('is-active" aria-current="step">Gather evidence'), 'evidence should become the active step');
});

test('reported symptoms precede the progress rail and secondary caller context', () => {
  const state = onboardingState();
  state.stats.jobsCompleted = 1;
  const html = jobView({ state, faults, machines, clients });
  const symptomsAt = html.indexOf('job-ticket-order');
  const stepsAt = html.indexOf('diagnosis-steps');
  const callerAt = html.indexOf('client-callout');
  assert(symptomsAt !== -1 && symptomsAt < stepsAt && stepsAt < callerAt,
    'symptoms should lead, followed by the quiet progress rail and caller context');
  assert(mainCss.includes('border-left: 4px solid var(--accent)'),
    'symptom work order should receive the strongest ticket accent');
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

test('diagnostic controls remain the single reliable interaction path', () => {
  const state = onboardingState();
  const html = jobView({ state, faults, machines, clients });
  assert(!html.includes('art-hotspot'), 'decorative art should not expose unreliable invisible controls');
  assert(html.includes('class="btn btn-test" data-test="temp-probe"'), 'temp probe should remain available from the labelled controls');
  assert(html.includes('class="btn btn-test" data-test="inspect-beater"'), 'inspection should remain available from the labelled controls');
  assert(html.includes('aria-hidden="true"'), 'decorative machine art should stay out of the accessibility tree');
});

test('machine art state follows the last diagnostic test', () => {
  const state = onboardingState();
  state.jobs.active.testsRun.push('temp-probe');
  const probeHtml = jobView({ state, faults, machines, clients });
  assert(probeHtml.includes('machine-stage--probe'), 'temp-probe should show the probe interaction state');

  state.jobs.active.testsRun.push('error-log');
  const backToOpenHtml = jobView({ state, faults, machines, clients });
  assert(backToOpenHtml.includes('machine-stage--open'), 'error-log has no matching state and falls back to open');
});

test('job view separates reported symptoms, measured evidence and remaining actions', () => {
  const state = onboardingState();
  state.jobs.active.testsRun.push('temp-probe');
  state.jobs.active.minutesSpent = 5;
  const html = jobView({ state, faults, machines, clients });
  assert(html.includes('Reported symptoms'), 'work order should retain reported evidence');
  assert(html.includes('Measured evidence'), 'completed diagnostics should enter the evidence ledger');
  assert(html.includes('Run another test'), 'remaining actions should be labelled separately');
  assert(html.includes('job-instruments'), 'job time and speed bonus should use the instrument strip');
  assert(html.includes('Authorise repair'), 'final choices should be framed as repair authorisation');
});

test('machine stage contains no ambient particle decoration', () => {
  const state = onboardingState();
  const html = jobView({ state, faults, machines, clients });
  assert(!html.includes('art-particle'), 'machine art should not include ambiguous floating dots');
});

test('raster art uses its square intrinsic frame', () => {
  // machineImageSrc() is a node-safe no-op in the test environment, so inspect
  // the renderer source for the production-only raster wrapper contract.
  assert(jobUi.includes('class="machine-art-frame"'), 'raster art should provide a square positioning frame');
  assert(jobUi.includes('width="640" height="640"'), 'raster dimensions should match the generated assets');
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

test('workshop panel is hidden from Tier 1 players and shown collapsed from Tier 2', () => {
  const state = defaultState(); // tier 1
  assert(!homeView({ state }).includes('data-home-panel="workshop"'), 'fresh save should not see the workshop');
  state.player.tierUnlocked = 2;
  const html = homeView({ state });
  assert(html.includes('data-home-panel="workshop"'), 'Tier 2 unlock should reveal the workshop');
  assert(html.includes('Workshop — buy &amp; flip damaged machines') || html.includes('Workshop — buy & flip damaged machines'),
    'empty workshop collapses to a one-line summary');
  assert(!html.includes('<details class="home-details" data-home-panel="workshop" open'),
    'workshop starts collapsed');
});

// --- contact flavour line rotation (session 22, data-driven caller variation) ---

test('contactFlavourLine: machine-specific lines only appear on that machine', () => {
  const contact = {
    flavour: 'legacy line',
    flavourLines: {
      default: ['generic one', 'generic two'],
      'commercial-ice-dispenser': ['the ice dispenser is down'],
    },
  };
  // On a froyo ticket, no seed may ever produce the ice-dispenser line.
  for (let i = 0; i < 25; i++) {
    const line = contactFlavourLine(contact, {
      faultId: `fault-${i}`, clientId: 'c1', machineType: 'froyo-multihead',
    });
    assert(line !== 'the ice dispenser is down', 'machine line leaked onto the wrong machine');
    assert(line.startsWith('generic'), `expected a default line, got: ${line}`);
  }
  // On the matching machine, the contextual line is reachable.
  let seen = false;
  for (let i = 0; i < 50 && !seen; i++) {
    seen = contactFlavourLine(contact, {
      faultId: `fault-${i}`, clientId: 'c1', machineType: 'commercial-ice-dispenser',
    }) === 'the ice dispenser is down';
  }
  assert(seen, 'the contextual line should appear on its own machine');
});

test('contactFlavourLine is deterministic per job and varies across jobs', () => {
  const contact = { flavourLines: { default: ['a', 'b', 'c', 'd'] } };
  const job = { faultId: 'f1', clientId: 'c1', machineType: 'm' };
  assertEqual(contactFlavourLine(contact, job), contactFlavourLine(contact, job),
    'same job must always pick the same line');
  const picks = new Set();
  for (let i = 0; i < 30; i++) {
    picks.add(contactFlavourLine(contact, { faultId: `f${i}`, clientId: 'c1', machineType: 'm' }));
  }
  assert(picks.size > 1, 'different jobs should rotate through the pool');
});

test('contactFlavourLine falls back to the legacy flavour string, then empty', () => {
  const job = { faultId: 'f1', clientId: 'c1', machineType: 'm' };
  assertEqual(contactFlavourLine({ flavour: 'old single line' }, job), 'old single line');
  assertEqual(contactFlavourLine(null, job), '');
  assertEqual(contactFlavourLine({}, job), '');
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
    assert(html.includes('returns tomorrow'), 'pending callback should show when it returns');
    assert(html.includes('callback-line'), 'a pending callback collapses to a one-line entry (2026-07-04)');
    assert(!html.includes('callback-card'), 'no full card for a not-yet-due callback');
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
  // 2026-07-04: per-tech lines reconcile arithmetically with the total —
  // fixed = jobs − missed, and the total line sums the fixed counts and $.
  assert(html.includes('Dave: 3 fixed · 0 missed · $150'), 'Dave should be attributed his jobs and earnings');
  assert(html.includes('Mike: 2 fixed · 1 missed · $100'), 'Mike should be attributed his miss');
  assert(html.includes('5 fixed · $250 earned in total'), 'the total must reconcile with the per-tech lines');
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

// --- Phase 4 (2026-07-04): loop and home-screen tightening ---

test('status bar shows reputation progress to the next tier', () => {
  const state = defaultState();
  state.player.reputation = 18;
  state.player.tierUnlocked = 2; // next threshold: tier 3 at REPUTATION.tierThresholds[3]
  const html = statusBar(state);
  const toGo = REPUTATION.tierThresholds[3] - 18;
  assert(html.includes(`Rep 18 · ${toGo} to Tier 3`), `expected tier progress, got: ${html}`);
  // At the top tier there is nothing to count down to.
  state.player.tierUnlocked = 3;
  assert(statusBar(state).includes('Rep 18'), 'top tier still shows rep');
  assert(!statusBar(state).includes('to Tier'), 'no phantom next tier at the top');
});

test('receipt shows the reputation change and a grown clean streak', () => {
  const state = onboardingState();
  state.stats.jobsCompleted = 5; // returning player, no onboarding guard
  state.stats.cleanStreak = 2;
  const invoice = {
    correct: true,
    fault,
    earned: 90,
    repDelta: 1,
    chosenFix: 'right-fix',
    callback: false,
    callbackSource: null,
    unlockedTier: null,
    minutesSpent: 2,
    testsUsed: 1,
    cleanStreak: 3,
    codex: { isNew: false, mastered: 1, total: 10, milestonesPaid: [] },
  };
  const html = invoiceView({ state, invoice });
  assert(html.includes('+1 rep'), 'receipt must show the reputation gained');
  assert(html.includes('3 in a row'), 'receipt must show the grown clean streak');

  const miss = { ...invoice, correct: false, repDelta: -2, earned: 40, cleanStreak: 0, codex: null };
  const missHtml = invoiceView({ state, invoice: miss });
  assert(missHtml.includes('−2 rep'), 'receipt must show the reputation lost');
  assert(!missHtml.includes('in a row'), 'no streak line after a miss');
});

test('home screen order: ticket loop first, then daily, then business panels, then codex', () => {
  const state = defaultState();
  state.stats.jobsCompleted = 3;
  state.player.tierUnlocked = 2;
  state.player.lifetimeEarnings = 1e9; // prestige banner visible
  const html = homeView({ state, faults: {} });
  const order = [
    'data-action="next-ticket"',
    'data-action="start-motd"',
    'data-home-panel="prestige"',
    'data-home-panel="workshop"',
    'data-action="open-codex"',
    'data-action="open-shop"',
    'data-action="open-settings"',
  ];
  let last = -1;
  for (const marker of order) {
    const at = html.indexOf(marker);
    assert(at !== -1, `home should contain ${marker}`);
    assert(at > last, `${marker} out of order`);
    last = at;
  }
});

test('home shift brief recommends the most urgent existing action', () => {
  const state = defaultState();
  const today = new Date(Date.now()).toISOString().slice(0, 10);
  state.player.reputation = 7;
  state.jobs.callbacks.push({
    faultId: 'f', clientId: 'c', dueDay: today, expiryDay: today,
    misses: 1, source: 'player', evidence: null, variant: 0,
  });
  state.contract = {
    date: today, machineType: 'slushie-machine', count: 3, reward: 120, progress: 1, paid: false,
  };
  const html = homeView({
    state,
    machines: [{ id: 'slushie-machine', name: 'Polar Twister', tier: 1 }],
  });
  assert(html.includes('Shift brief'), 'home should label the recommendation');
  assert(html.includes('Clear 1 callback obligation'), 'an expiring player obligation should outrank contract work');
  assert(html.includes('3 Rep to Tier 2'), 'the same brief should retain next-unlock context');
  assert(html.includes('class="btn btn-primary" data-action="open-callbacks"'), 'the recommended obligation should own the primary CTA');
  assert(html.includes('Take a fresh ticket instead'), 'players should retain a secondary fresh-ticket choice');
  assert(html.indexOf('home-shift-brief') < html.indexOf('data-action="next-ticket"'), 'guidance should appear before the primary action');
});

test('home shift brief prioritises a safely paused diagnosis', () => {
  const state = onboardingState();
  state.stats.jobsCompleted = 2;
  const html = homeView({ state, clients });
  assert(html.includes('Resume Kwik Stop'), 'paused client should be named in the recommendation');
  assert(html.includes('simulated time is paused'), 'brief should reassure players that navigation did not cost time');
  assert(html.includes('data-action="resume-job"'), 'existing resume wiring should remain the primary action');
});

test('brand block shrinks once any job has been completed', () => {
  const fresh = defaultState();
  const freshHtml = homeView({ state: fresh, faults: {} });
  assert(freshHtml.includes('game-tagline'), 'a brand-new player sees the full brand');
  assert(!freshHtml.includes('game-brand--compact'), 'full brand is not compact');
  const veteran = defaultState();
  veteran.stats.jobsCompleted = 1;
  const vetHtml = homeView({ state: veteran, faults: {} });
  assert(vetHtml.includes('game-brand--compact'), 'returning player gets the compact brand');
  assert(!vetHtml.includes('game-tagline'), 'compact brand drops the tagline');
});

test('emoji stay out of UI chrome: home, callbacks and MotD button use badges', () => {
  // 2026-07-04 (h): emoji may remain inside flavour/share text only. The home
  // screen and MotD button must not use ✅⚠️🔥📋❌ as interface elements.
  const state = defaultState();
  state.player.tierUnlocked = 2;
  state.workshop.machines.push({ id: 'm1', machineType: 'slushie-machine', faultId: 'f', status: 'repaired' });
  state.motd.lastPlayedDate = new Date(Date.now()).toISOString().slice(0, 10);
  state.motd.lastResult = { testsUsed: 2, simMinutes: 7, solved: true, faultId: 'f' };
  state.motd.streak = 3;
  const html = homeView({ state, faults: {} });
  for (const emoji of ['✅', '❌', '🔥', '⚠️', '📋']) {
    assert(!html.includes(emoji), `home chrome must not contain ${emoji}`);
  }
  assert(html.includes('badge--success'), 'MotD played state uses a badge');
  assert(html.includes('Streak 3'), 'streak is words, not fire');
  assert(html.includes('dot--ok'), 'workshop status uses dots');
});

// --- daily comeback hooks on home (GDD §5, 2026-07-04) ---

test('played MotD button shows the countdown to the next puzzle', () => {
  const state = defaultState();
  state.motd.lastPlayedDate = new Date(Date.now()).toISOString().slice(0, 10); // played today
  state.motd.lastResult = { testsUsed: 1, simMinutes: 2, solved: true, faultId: 'f' };
  const html = homeView({ state });
  assert(html.includes('New puzzle in'), 'played state must count down to the next puzzle');
  assert(html.includes('btn-subtext'), 'countdown uses the design-system subtext line');
});

test('unplayed MotD button warns when a live streak is at risk', () => {
  const state = defaultState();
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  state.motd.lastPlayedDate = yesterday;
  state.motd.streak = 4;
  state.motd.lastResult = { testsUsed: 1, simMinutes: 2, solved: true, faultId: 'f' };
  const html = homeView({ state });
  assert(html.includes('4-day streak at risk'), 'at-risk streak must be visible on the button');
  assert(!html.includes('New puzzle in'), 'no countdown while today is still playable');

  // No streak, nothing at risk: the button stays clean.
  const fresh = defaultState();
  assert(!homeView({ state: fresh }).includes('streak at risk'));
});

test("home shows Today's contract with machine name, progress badge, and reward", () => {
  const state = defaultState();
  const today = new Date(Date.now()).toISOString().slice(0, 10);
  state.contract = {
    date: today, machineType: 'slushie-machine', count: 2, reward: 80, progress: 1, paid: false,
  };
  const html = homeView({ state, machines: [{ id: 'slushie-machine', name: 'Polar Twister', tier: 1 }] });
  assert(html.includes("Today's contract"), 'contract panel present');
  assert(html.includes('Fix 2 × Polar Twister'), 'target machine named from machines.json');
  assert(html.includes('+$80'), 'reward visible');
  assert(html.includes('1/2'), 'progress visible');

  // Completed contract shows the success badge instead of progress.
  state.contract.progress = 2;
  state.contract.paid = true;
  const done = homeView({ state, machines: [{ id: 'slushie-machine', name: 'Polar Twister', tier: 1 }] });
  assert(done.includes('Complete'), 'paid contract reads Complete');

  // A stale (yesterday's) contract is hidden, never shown as today's.
  state.contract.date = '2020-01-01';
  assert(!homeView({ state }).includes("Today's contract"), 'stale contract must not render');
});

test('prestige card states what is kept and lost, and never sells in one tap (2026-07-04)', () => {
  const state = defaultState();
  state.player.lifetimeEarnings = 40000;
  state.player.reputation = 182;

  const html = homeView({ state, faults: {} });
  assert(html.includes('You keep:'), 'card must list what survives the sale');
  assert(html.includes('service manual'), 'codex (player name: service manual) survival must be stated');
  assert(html.includes('The new owners keep:'), 'card must list what is wiped');
  assert(html.includes('tools, van racking, techs'), 'wiped purchases must be named');
  assert(html.includes('restart with $500'), 'cash reset must be explicit');
  assert(html.includes('data-action="sell-business"'), 'unarmed card shows the arming button');
  assert(!html.includes('data-action="confirm-sell-business"'), 'no confirm button until armed');

  // Armed: the confirm/cancel pair replaces the one-tap button.
  const armed = homeView({ state, faults: {}, prestigeConfirm: true, homePanels: { prestige: true } });
  assert(armed.includes('data-action="confirm-sell-business"'), 'armed card shows confirm');
  assert(armed.includes('data-action="cancel-sell-business"'), 'armed card shows cancel');
  assert(!armed.includes('data-action="sell-business"'), 'arming button gone while armed');
  assert(armed.includes('+182%'), 'confirm restates the bonus at stake');
  assert(armed.includes("can't be undone"), 'irreversibility must be stated');
});
