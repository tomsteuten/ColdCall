/** @file Tests for state.js: save/load round-trip, v0->v1 migration, export/import. */

import {
  defaultState,
  save,
  load,
  migrate,
  exportSave,
  importSave,
  SCHEMA_VERSION,
  SAVE_KEY,
} from '../js/state.js';

/** In-memory localStorage stand-in for node. */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('load with no save returns fresh default state', () => {
  const { state, fresh, error } = load(memoryStorage());
  assert(fresh === true, 'should report fresh');
  assert(error === null, 'should have no error');
  assertEqual(state, defaultState(), 'fresh state should equal defaults');
});

test('save -> load round-trips state exactly', () => {
  const storage = memoryStorage();
  const before = defaultState();
  before.player.cash = 1234;
  before.van.stock['scraper-blades'] = 2;
  before.techs.push({ id: 't1', name: 'Dave', skill: 1, routeId: null, hiredAt: 100 });

  save(before, storage);
  const { state: after, fresh, error } = load(storage);

  assert(fresh === false, 'should not be fresh');
  assert(error === null, 'should have no error');
  assert(after.lastSeen > 0, 'save should stamp lastSeen');
  assertEqual(after, before, 'loaded state should equal saved state');
});

test('v0 (pre-release flat) save migrates to v1 shape', () => {
  // Fixture: what a pre-release save looked like — no schemaVersion, flat keys.
  const v0Fixture = { cash: 777, reputation: 5, lastSeen: 1700000000000 };

  const migrated = migrate(v0Fixture);

  assert(migrated.schemaVersion === SCHEMA_VERSION, 'should reach current version');
  assert(migrated.player.cash === 777, 'cash should be preserved');
  assert(migrated.player.reputation === 5, 'reputation should be preserved');
  assert(migrated.lastSeen === 1700000000000, 'lastSeen should be preserved');
  assert(migrated.van.slots === defaultState().van.slots, 'new keys should get defaults');
});

test('v0 migration applies through load() from storage', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ cash: 321 }));

  const { state, fresh, error } = load(storage);

  assert(fresh === false, 'a migrated save is not fresh');
  assert(error === null, 'should migrate without error');
  assert(state.schemaVersion === SCHEMA_VERSION, 'should be at current version');
  assert(state.player.cash === 321, 'cash should survive migration via load');
});

test('load refuses to wipe a corrupt save', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{not json at all');

  const { state, fresh, error } = load(storage);

  assert(fresh === true, 'corrupt save should fall back to fresh state');
  assert(typeof error === 'string' && error.length > 0, 'should report the error');
  assert(storage.getItem(SAVE_KEY) === '{not json at all', 'corrupt blob must remain untouched');
  assertEqual(state, defaultState(), 'fallback state should be defaults');
});

test('exportSave -> importSave round-trips and migrates', () => {
  const state = defaultState();
  state.player.cash = 999;
  const blob = exportSave(state);

  assert(typeof blob === 'string' && !blob.includes('{'), 'blob should be opaque text');
  const imported = importSave(blob);
  assertEqual(imported, state, 'imported state should equal exported state');

  // Importing a v0 blob should migrate too.
  const v0Blob = Buffer.from(JSON.stringify({ cash: 55 })).toString('base64');
  const migrated = importSave(v0Blob);
  assert(migrated.schemaVersion === SCHEMA_VERSION, 'imported v0 blob should migrate');
  assert(migrated.player.cash === 55, 'imported v0 cash should survive');
});

test('importSave throws on garbage without side effects', () => {
  let threw = false;
  try {
    importSave('definitely not a save blob !!!');
  } catch {
    threw = true;
  }
  assert(threw, 'garbage input should throw');
});
