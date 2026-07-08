/** @file Pure rendering checks for the inline SVG machine illustrations. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { machineSvg, HOTSPOTS } from '../js/machine-art.js';

const MACHINES = ['slushie-machine', 'soft-serve-commercial', 'froyo-multihead', 'granita-slushie', 'commercial-ice-dispenser'];
const STATES = ['fault', 'open', 'working'];
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

test('every launch machine renders valid inline SVG in every art state', () => {
  for (const machineId of MACHINES) {
    for (const state of STATES) {
      const svg = machineSvg(machineId, state);
      assert(typeof svg === 'string', `${machineId}/${state} should return markup`);
      assert(svg.startsWith('<svg '), `${machineId}/${state} should start with <svg>`);
      assert(svg.endsWith('</svg>'), `${machineId}/${state} should close the SVG`);
      assert(svg.includes('viewBox="0 0 160 70"'), `${machineId}/${state} should use the art-slot viewBox`);
    }
  }
});

test('unknown machines return null for the text fallback path', () => {
  assertEqual(machineSvg('future-machine', 'fault'), null);
});

test('every catalogued machine has a generated raster asset for every art state', () => {
  const catalogue = JSON.parse(readFileSync(join(rootDir, 'data/machines.json'), 'utf8')).machines;
  for (const machine of catalogue) {
    for (const state of STATES) {
      const path = join(rootDir, 'assets', 'generated', `${machine.id}-${state}.webp`);
      assert(existsSync(path), `${machine.id}/${state} should have generated raster art`);
    }
  }
});

test('fault and open states produce different machine markup', () => {
  for (const machineId of MACHINES) {
    assert(
      machineSvg(machineId, 'fault') !== machineSvg(machineId, 'open'),
      `${machineId} should visibly change when inspection opens the machine`
    );
  }
});

test('interaction states (probe/leads/ajar) render for every machine, distinct from fault', () => {
  for (const machineId of MACHINES) {
    const fault = machineSvg(machineId, 'fault');
    for (const state of ['probe', 'leads', 'ajar']) {
      const svg = machineSvg(machineId, state);
      assert(typeof svg === 'string' && svg.startsWith('<svg '), `${machineId}/${state} should render`);
      assert(svg !== fault, `${machineId}/${state} must visibly differ from the plain fault art`);
      assert(svg.includes(`machine-state-${state}`), `${machineId}/${state} should carry its CSS state class`);
    }
    // The probe and leads props actually appear.
    assert(machineSvg(machineId, 'leads').includes('#ef6a6a'), `${machineId}/leads should show the red meter lead`);
  }
});

test('every launch machine has a probe/leads/ajar hotspot coordinate for the tests-as-touches UI', () => {
  for (const machineId of MACHINES) {
    const coords = HOTSPOTS[machineId];
    assert(coords, `${machineId} should have a HOTSPOTS entry`);
    for (const stateKey of ['probe', 'leads', 'ajar']) {
      const point = coords[stateKey];
      assert(point && typeof point.x === 'number' && typeof point.y === 'number', `${machineId}/${stateKey} should have numeric x/y`);
      assert(point.x >= 0 && point.x <= 160, `${machineId}/${stateKey} x should be inside the 0-160 viewBox`);
      assert(point.y >= 0 && point.y <= 70, `${machineId}/${stateKey} y should be inside the 0-70 viewBox`);
    }
  }
});

test('open inspection art remains visibly faulty, distinct from working art', () => {
  const slushieOpen = machineSvg('slushie-machine', 'open');
  assert(slushieOpen.includes('E-04'), 'open slushie should retain its fault code');
  assert(!slushieOpen.includes('COOL'), 'open slushie must not look repaired');

  const softServeOpen = machineSvg('soft-serve-commercial', 'open');
  assert(softServeOpen.includes('fill="#f59e0b"'), 'open soft serve should retain an amber warning');
  assert(!softServeOpen.includes('34&#176;F'), 'open soft serve must not show the working temperature');

  for (const machineId of MACHINES) {
    assert(
      machineSvg(machineId, 'open') !== machineSvg(machineId, 'working'),
      `${machineId} inspection and working states must remain distinct`
    );
  }
});
