/** @file Ticket picker invariants: fault and client always share a tier, tier gating holds, unlocked tiers reachable. */

import { mulberry32 } from '../js/rng.js';
import { pickTicket, recordRecentFault, RECENT_FAULT_WINDOW } from '../js/tickets.js';

const FAULTS = {
  'slushie-fault': { id: 'slushie-fault', tier: 1 },
  'soft-serve-fault-a': { id: 'soft-serve-fault-a', tier: 2 },
  'soft-serve-fault-b': { id: 'soft-serve-fault-b', tier: 2 },
  'froyo-fault': { id: 'froyo-fault', tier: 3 }, // no tier-3 client exists
};
const CLIENTS = [
  { id: 'corner-shop', tier: 1 },
  { id: 'burgertown', tier: 2 },
];

test('fault and client always share a tier over many seeded draws', () => {
  const next = mulberry32('tickets-test');
  for (let i = 0; i < 500; i++) {
    const { fault, client } = pickTicket(FAULTS, CLIENTS, 2, next);
    assertEqual(fault.tier, client.tier, `draw ${i}: ${fault.id} paired with ${client.id}`);
  }
});

test('a fault whose tier has no client is never picked', () => {
  const next = mulberry32('tickets-test');
  for (let i = 0; i < 500; i++) {
    const { fault } = pickTicket(FAULTS, CLIENTS, 3, next);
    assert(fault.id !== 'froyo-fault', 'tier-3 fault picked with no tier-3 client');
  }
});

test('tier gating: a tier-1 player never sees tier-2 faults or clients', () => {
  const next = mulberry32('tickets-test');
  for (let i = 0; i < 500; i++) {
    const { fault, client } = pickTicket(FAULTS, CLIENTS, 1, next);
    assertEqual(fault.tier, 1, `draw ${i}: tier-${fault.tier} fault offered to a tier-1 player`);
    assertEqual(client.tier, 1, `draw ${i}: tier-${client.tier} client offered to a tier-1 player`);
  }
});

test('every unlocked pairable tier is reachable', () => {
  const next = mulberry32('tickets-test');
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(pickTicket(FAULTS, CLIENTS, 2, next).fault.tier);
  assert(seen.has(1) && seen.has(2), `expected tiers 1 and 2, saw ${[...seen].join(', ')}`);
});

test('same seed reproduces the same draw', () => {
  const a = pickTicket(FAULTS, CLIENTS, 2, mulberry32(42));
  const b = pickTicket(FAULTS, CLIENTS, 2, mulberry32(42));
  assertEqual(a.fault.id, b.fault.id);
  assertEqual(a.client.id, b.client.id);
});

test('throws when no fault can be paired within the unlocked tiers', () => {
  let threw = false;
  try {
    pickTicket({ 'froyo-fault': { id: 'froyo-fault', tier: 3 } }, CLIENTS, 3, mulberry32(1));
  } catch {
    threw = true;
  }
  assert(threw, 'expected pickTicket to throw with no pairable fault');
});

test('anti-repeat: recent faults are excluded from the draw when the pool allows (2026-07-08)', () => {
  // A big-enough pool: draw N times maintaining the window like main.js does,
  // and no fault may repeat within RECENT_FAULT_WINDOW consecutive draws.
  const bigPool = {};
  for (let i = 0; i < 8; i++) bigPool[`fault-${i}`] = { id: `fault-${i}`, tier: 1 };
  const next = mulberry32('anti-repeat');
  const recent = [];
  const drawn = [];
  for (let i = 0; i < 200; i++) {
    const { fault } = pickTicket(bigPool, CLIENTS, 1, next, recent);
    for (const prev of drawn.slice(-RECENT_FAULT_WINDOW)) {
      assert(fault.id !== prev, `draw ${i}: ${fault.id} repeated within a ${RECENT_FAULT_WINDOW}-draw window`);
    }
    drawn.push(fault.id);
    recordRecentFault(recent, fault.id);
  }
});

test('anti-repeat: falls back to the full pool instead of throwing when everything is recent', () => {
  // A pool smaller than the window: exclusion would empty it — a repeat is
  // returned rather than an error.
  const tinyPool = { 'only-fault': { id: 'only-fault', tier: 1 } };
  const { fault } = pickTicket(tinyPool, CLIENTS, 1, mulberry32(7), ['only-fault']);
  assertEqual(fault.id, 'only-fault', 'the sole fault must still be drawable');
});

test('recordRecentFault keeps a FIFO window of RECENT_FAULT_WINDOW ids', () => {
  const recent = [];
  for (const id of ['a', 'b', 'c', 'd', 'e']) recordRecentFault(recent, id);
  assertEqual(recent, ['c', 'd', 'e'].slice(-RECENT_FAULT_WINDOW),
    'oldest entries fall off the front');
  assertEqual(recent.length, RECENT_FAULT_WINDOW);
});
