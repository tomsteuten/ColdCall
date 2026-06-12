/** @file Single game-state object: defaults, save/load to localStorage, export/import, migrations. */

import { STARTING } from '../config/balance.js';

export const SCHEMA_VERSION = 1;
export const SAVE_KEY = 'coldcall_save';

/**
 * Fresh state for a new game. The one and only definition of the state shape —
 * every key the game ever reads must exist here.
 * @returns {object} new game state
 */
export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    lastSeen: 0, // ms epoch, stamped on every save; drives offline simulation

    player: {
      cash: STARTING.cash,
      reputation: 0,
      lifetimeEarnings: 0, // prestige gate later; cheap to track from day one
      tierUnlocked: STARTING.tierUnlocked,
    },

    tools: {
      multimeterTier: STARTING.multimeterTier,
      thermalCamera: false,
    },

    van: {
      slots: STARTING.vanSlots,
      stock: {}, // partId -> count
    },

    techs: [], // { id, name, skill, routeId|null, hiredAt }
    routes: [], // { id, clientId }

    jobs: {
      active: null, // in-flight diagnosis job, survives refresh
      callbacks: [], // { faultId, clientId, dueDay }
    },

    motd: {
      lastPlayedDate: null, // UTC date string "YYYY-MM-DD", doubles as the puzzle seed
      streak: 0,
      lastResult: null, // { testsUsed, timeMs, solved }
    },

    stats: {
      jobsCompleted: 0,
      cleanStreak: 0,
      callbacksCaused: 0,
    },

    settings: {
      audio: true,
    },
  };
}

/**
 * Migrations map: key N migrates a save FROM version N TO version N+1.
 * Applied sequentially in load() until schemaVersion === SCHEMA_VERSION.
 * Never delete entries — old saves in the wild may be many versions behind.
 * @type {Object<number, function(object): object>}
 */
export const MIGRATIONS = {
  // Pre-release saves had no schemaVersion and a flat shape (cash at top level).
  0: (old) => {
    const fresh = defaultState();
    fresh.player.cash = typeof old.cash === 'number' ? old.cash : fresh.player.cash;
    fresh.player.reputation =
      typeof old.reputation === 'number' ? old.reputation : fresh.player.reputation;
    fresh.lastSeen = typeof old.lastSeen === 'number' ? old.lastSeen : 0;
    fresh.schemaVersion = 1;
    return fresh;
  },
};

/**
 * Bring a parsed save up to the current schema version. Throws if a needed
 * migration is missing (better to fail loudly than corrupt a save).
 * @param {object} parsed raw save object of any past version
 * @returns {object} state at SCHEMA_VERSION
 */
export function migrate(parsed) {
  let s = parsed;
  let v = typeof s.schemaVersion === 'number' ? s.schemaVersion : 0;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from save version ${v}`);
    s = step(s);
    v = s.schemaVersion;
  }
  return s;
}

/**
 * Serialise state to localStorage, stamping lastSeen.
 * @param {object} state
 * @param {Storage} [storage] injectable for tests; defaults to localStorage
 */
export function save(state, storage = globalThis.localStorage) {
  state.lastSeen = Date.now();
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

/**
 * Load and migrate the save, or return a fresh state if none exists.
 * A corrupt (unparseable) save is left untouched in storage and reported,
 * never overwritten — saves are sacred.
 * @param {Storage} [storage] injectable for tests; defaults to localStorage
 * @returns {{state: object, fresh: boolean, error: string|null}}
 */
export function load(storage = globalThis.localStorage) {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { state: defaultState(), fresh: true, error: null };
  try {
    const state = migrate(JSON.parse(raw));
    return { state, fresh: false, error: null };
  } catch (e) {
    return { state: defaultState(), fresh: true, error: String(e && e.message ? e.message : e) };
  }
}

/**
 * Export the save as a text blob for device transfer (base64-wrapped JSON).
 * @param {object} state
 * @returns {string}
 */
export function exportSave(state) {
  const json = JSON.stringify(state);
  // btoa chokes on non-Latin1; round-trip through percent-encoding first.
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Import a save blob produced by exportSave(), migrating it to current schema.
 * Throws on garbage input — caller shows the error, existing save is untouched.
 * @param {string} blob
 * @returns {object} migrated state
 */
export function importSave(blob) {
  const json = decodeURIComponent(escape(atob(blob.trim())));
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Save blob did not contain a save object');
  }
  return migrate(parsed);
}
