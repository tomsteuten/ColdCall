/** @file Ticket picker invariants: fault and client always share a tier, tier gating holds, unlocked tiers reachable. */

import { mulberry32 } from '../js/rng.js';
import { pickTicket } from '../js/tickets.js';

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
