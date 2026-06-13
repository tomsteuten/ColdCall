/** @file Pure rendering checks for the inline SVG machine illustrations. */

import { machineSvg } from '../js/machine-art.js';

const MACHINES = ['slushie-machine', 'soft-serve-commercial'];
const STATES = ['fault', 'open', 'working'];

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

test('fault and open states produce different machine markup', () => {
  for (const machineId of MACHINES) {
    assert(
      machineSvg(machineId, 'fault') !== machineSvg(machineId, 'open'),
      `${machineId} should visibly change when inspection opens the machine`
    );
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
