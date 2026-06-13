/** @file Tests for state.js: save/load round-trip, v0->v1 migration, export/import. */

import {
  defaultState,
  save,
  load,
  migrate,
  makePersist,
  exportSave,
  importSave,
  SCHEMA_VERSION,
  SAVE_KEY,
} from '../js/state.js';
import { STARTING } from '../config/balance.js';

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

test('v1 save with callbacks migrates to v2: entries gain misses = 1', () => {
  // Fixture: a real v1 save shape — callbacks queued before misses existed.
  const v1Fixture = defaultState();
  v1Fixture.schemaVersion = 1;
  v1Fixture.player.cash = 888;
  v1Fixture.jobs.callbacks = [
    { faultId: 'worn-scraper-blades', clientId: 'burgertown-high-st', dueDay: '2026-06-10' },
  ];

  const migrated = migrate(JSON.parse(JSON.stringify(v1Fixture)));

  assert(migrated.schemaVersion === SCHEMA_VERSION, 'should reach current version');
  assert(migrated.player.cash === 888, 'cash should be preserved');
  assertEqual(migrated.jobs.callbacks.length, 1, 'callback entry should survive');
  const cb = migrated.jobs.callbacks[0];
  assert(cb.misses === 1, 'v1 entries were created by exactly one wrong fix');
  assert(cb.faultId === 'worn-scraper-blades', 'entry fields should be untouched');
  assert(cb.dueDay === '2026-06-10', 'dueDay should be untouched');
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

test('v2 save migrates to v3: van.stock gains generic-parts', () => {
  // Fixture: a v2 save that predates parts tracking — stock is empty.
  const v2Fixture = defaultState();
  v2Fixture.schemaVersion = 2;
  v2Fixture.van.stock = {};

  const migrated = migrate(JSON.parse(JSON.stringify(v2Fixture)));

  assert(migrated.schemaVersion === SCHEMA_VERSION, 'should reach current version');
  assertEqual(migrated.van.stock['generic-parts'], STARTING.vanSlots, 'should get starting parts');
});

test('v3 save migrates to v4: a played MotD result gains faultId = null', () => {
  // Fixture: a v3 save with a result from before faultId was pinned.
  const v3Fixture = defaultState();
  v3Fixture.schemaVersion = 3;
  v3Fixture.motd.lastPlayedDate = '2026-06-12';
  v3Fixture.motd.lastResult = { testsUsed: 2, timeMs: 30000, solved: true };

  const migrated = migrate(JSON.parse(JSON.stringify(v3Fixture)));

  assert(migrated.schemaVersion === SCHEMA_VERSION, 'should reach current version');
  assertEqual(migrated.motd.lastResult.faultId, null, 'old results cannot know their fault');
  assertEqual(migrated.motd.lastResult.solved, true, 'result fields should be untouched');
});

test('v3 save with no MotD result migrates cleanly (lastResult stays null)', () => {
  const v3Fixture = defaultState();
  v3Fixture.schemaVersion = 3;
  v3Fixture.motd.lastResult = null;
  const migrated = migrate(JSON.parse(JSON.stringify(v3Fixture)));
  assertEqual(migrated.motd.lastResult, null);
});

test('a save from a newer game version is rejected, blob left untouched', () => {
  const storage = memoryStorage();
  const future = defaultState();
  future.schemaVersion = SCHEMA_VERSION + 1;
  const blob = JSON.stringify(future);
  storage.setItem(SAVE_KEY, blob);

  const { fresh, error } = load(storage);

  assert(fresh === true, 'future save should fall back to fresh state');
  assert(typeof error === 'string' && error.includes('newer'), `error should explain: ${error}`);
  assert(storage.getItem(SAVE_KEY) === blob, 'future-version blob must remain untouched');
});

test('a structurally broken save is rejected naming the bad field, blob untouched', () => {
  const storage = memoryStorage();
  const broken = defaultState();
  delete broken.jobs; // valid JSON, current version, but the game would crash on it
  const blob = JSON.stringify(broken);
  storage.setItem(SAVE_KEY, blob);

  const { fresh, error } = load(storage);

  assert(fresh === true, 'broken save should fall back to fresh state');
  assert(typeof error === 'string' && error.includes('"jobs"'), `error should name the field: ${error}`);
  assert(storage.getItem(SAVE_KEY) === blob, 'broken blob must remain untouched');
});

test('a save with a wrong-typed field is rejected', () => {
  const broken = defaultState();
  broken.player.cash = 'lots'; // type confusion would corrupt every settlement
  let threw = false;
  try {
    migrate(JSON.parse(JSON.stringify(broken)));
  } catch (e) {
    threw = true;
    assert(String(e.message).includes('"player.cash"'), `should name the field: ${e.message}`);
  }
  assert(threw, 'wrong-typed field should be rejected');
});

test('makePersist refuses every save after a failed load (corrupt blob preserved)', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{not json at all');
  const { state, error } = load(storage);
  assert(error !== null, 'precondition: load failed');

  const persist = makePersist(error, storage);
  state.player.cash = 9999;
  persist(state); // boot save
  persist(state); // a later action save

  assert(storage.getItem(SAVE_KEY) === '{not json at all', 'corrupt blob must survive every save');
});

test('makePersist saves normally when load succeeded', () => {
  const storage = memoryStorage();
  const { state, error } = load(storage); // fresh, no error
  const persist = makePersist(error, storage);
  state.player.cash = 4321;
  persist(state);
  const { state: reloaded } = load(storage);
  assertEqual(reloaded.player.cash, 4321, 'persist should write through to storage');
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

test('importSave rejects a blob from a newer game version', () => {
  const future = defaultState();
  future.schemaVersion = SCHEMA_VERSION + 1;
  const blob = exportSave(future);
  let threw = false;
  try {
    importSave(blob);
  } catch (e) {
    threw = true;
    assert(String(e.message).includes('newer'), `error should explain: ${e.message}`);
  }
  assert(threw, 'future-version blob should be rejected');
});

test('importSave rejects a structurally broken blob', () => {
  const broken = defaultState();
  delete broken.van;
  const blob = exportSave(broken);
  let threw = false;
  try {
    importSave(blob);
  } catch {
    threw = true;
  }
  assert(threw, 'broken blob should be rejected');
});
