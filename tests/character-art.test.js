/** @file Client portrait and character UI regression tests. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { clientPortraitSvg } from '../js/character-art.js';
import { render, sourceLabel } from '../js/ui/job.js';
import { defaultState } from '../js/state.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const clients = JSON.parse(readFileSync(join(rootDir, 'data/clients.json'), 'utf8')).clients;

function fakeRoot() {
  return {
    innerHTML: '',
    querySelectorAll: () => [],
  };
}

function renderJob(client) {
  const state = defaultState();
  state.jobs.active = {
    faultId: 'fault',
    clientId: client.id,
    machineType: 'unknown-machine',
    testsRun: [],
    minutesSpent: 0,
    fixOptions: ['fix-it'],
    callback: null,
    motd: false,
  };
  const root = fakeRoot();
  render(root, {
    state,
    faults: {
      fault: {
        symptoms: ['It stopped.'],
        tests: {},
        correctFix: 'fix-it',
        wrongFixes: [],
        partsCost: 0,
      },
    },
    machines: [],
    clients: [client],
    invoice: null,
    screen: 'home',
    actions: {},
  });
  return root.innerHTML;
}

test('real clients have renderable inline SVG portraits and character flavour', () => {
  for (const client of clients) {
    const svg = clientPortraitSvg(client.portrait);
    assert(svg?.startsWith('<svg'), `${client.id} should render an inline SVG`);
    const html = renderJob(client);
    assert(html.includes('class="client-portrait"'), `${client.id} portrait should be shown`);
    assert(html.includes(client.contact.name), `${client.id} contact name should be shown`);
    assert(html.includes(client.contact.flavour), `${client.id} flavour should be shown`);
  }
});

test('missing portrait data renders a reliable text-only caller block', () => {
  const client = {
    id: 'text-only-client',
    name: 'Text Only Client',
    tier: 1,
    contact: { name: 'Pat', flavour: 'The machine has made a decision.' },
  };
  const html = renderJob(client);
  assertEqual(clientPortraitSvg(client.portrait), null);
  assert(html.includes('client-callout--text-only'), 'text-only layout should be selected');
  assert(!html.includes('class="client-portrait"'), 'no broken portrait frame should render');
  assert(html.includes('Pat'), 'caller text should remain available');
});

test('invalid portrait colours cannot inject SVG attributes', () => {
  const svg = clientPortraitSvg({
    skin: '" onload="alert(1)',
    hair: '#202633',
    shirt: '#4a5470',
    accent: '#7fd4f0',
    expression: 'bright',
  });
  assert(!svg.includes('onload'), 'invalid colour should be replaced, not interpolated');
  assert(svg.includes('#d6a074'), 'invalid skin colour should use the safe fallback');
});

test('sourceLabel names the responsible technician or uses a neutral fallback', () => {
  assertEqual(sourceLabel({ source: 'tech', techName: 'Mike' }), "Mike's miss");
  assertEqual(sourceLabel({ source: 'tech', techName: null }), 'tech miss');
  assertEqual(sourceLabel({ source: 'player' }), 'your miss');
});

test('callback UI escapes save-derived technician names', () => {
  const state = defaultState();
  state.jobs.callbacks = [{
    faultId: 'fault',
    clientId: 'client',
    dueDay: '2000-01-01',
    expiryDay: '2999-01-01',
    misses: 1,
    source: 'tech',
    techId: 'tech-2',
    techName: '<img src=x onerror=alert(1)>',
  }];
  const root = fakeRoot();
  render(root, {
    state,
    faults: { fault: { machineType: 'soft-serve-commercial' } },
    machines: [],
    clients: [{ id: 'client', name: 'Client' }],
    invoice: null,
    screen: 'callbacks',
    actions: {},
  });
  assert(!root.innerHTML.includes('<img'), 'save-derived tech name must not become markup');
  assert(root.innerHTML.includes('&lt;img'), 'escaped technician text should remain visible');
});
