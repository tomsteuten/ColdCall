/** @file Single game-state object: defaults, save/load to localStorage, export/import, migrations. */

import { STARTING, JOBS } from '../config/balance.js';

export const SCHEMA_VERSION = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
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
      stock: { 'generic-parts': STARTING.vanSlots }, // partId -> count
    },

    techs: [], // { id, name, skill, routeId|null, hiredAt }
    routes: [], // { id, clientId }

    jobs: {
      active: null, // in-flight diagnosis job, survives refresh; carries minutesSpent (simulated clock) and, for callbacks, { callback: { misses, source } }
      // { faultId, clientId, dueDay, expiryDay, misses, source } — source is
      // 'player' (obligation, 40% rate) or 'tech' (rescue, ~90% rate); misses
      // counts wrong fixes so far; expiryDay is when it falls off the board.
      callbacks: [],
    },

    motd: {
      lastPlayedDate: null, // UTC date string "YYYY-MM-DD", doubles as the puzzle seed
      streak: 0,
      lastResult: null, // { testsUsed, timeMs, solved, faultId } — faultId pins the puzzle so library updates can't rewrite history
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
  // v1 -> v2: callback queue entries gain a misses count (repeat wrong fixes
  // dampen the reputation penalty instead of repeating it in full). Every v1
  // entry was created by exactly one wrong fix, so misses starts at 1.
  1: (old) => {
    for (const cb of old.jobs.callbacks) {
      if (typeof cb.misses !== 'number') cb.misses = 1;
    }
    old.schemaVersion = 2;
    return old;
  },
  // v2 -> v3: van stock tracking added. Old saves had stock: {} (no parts);
  // give them a full van so they're not immediately blocked on their next job.
  2: (old) => {
    if (typeof old.van.stock['generic-parts'] !== 'number') {
      old.van.stock['generic-parts'] = STARTING.vanSlots;
    }
    old.schemaVersion = 3;
    return old;
  },
  // v3 -> v4: MotD results pin their faultId so a fault-library update can't
  // change which puzzle the result screen shows. Old results predate the field
  // and can't know it here (migrations have no fault library); null means
  // "re-derive from the date", which main.js handles.
  3: (old) => {
    if (old.motd.lastResult && typeof old.motd.lastResult.faultId !== 'string') {
      old.motd.lastResult.faultId = null;
    }
    old.schemaVersion = 4;
    return old;
  },
  // v4 -> v5: diagnosis tests now cost simulated job minutes, and an in-flight
  // active job tracks minutesSpent (it drives the correct-fresh-fix speed bonus).
  // A job saved mid-run before this field existed has unknown spend; default to
  // 0 — the generous reading that keeps the full bonus available, so the change
  // never retroactively punishes a job already on the bench.
  4: (old) => {
    if (old.jobs.active && typeof old.jobs.active.minutesSpent !== 'number') {
      old.jobs.active.minutesSpent = 0;
    }
    old.schemaVersion = 5;
    return old;
  },
  // v5 -> v6: callbacks split into obligations and rescues, and claiming becomes
  // a choice (GDD §3.1). Each queued callback gains a `source` and an `expiryDay`.
  // Existing entries predate the split: migrate them to 'player' — the lower
  // (40%) rate, the conservative reading that never over-pays a save in the wild.
  // expiryDay is dueDay + callbackExpiryDays so an already-due old callback still
  // gets its full claim window before it can expire (never retroactively lost).
  5: (old) => {
    for (const cb of old.jobs.callbacks) {
      if (cb.source !== 'player' && cb.source !== 'tech') cb.source = 'player';
      if (typeof cb.expiryDay !== 'string') {
        const due = Date.parse(`${cb.dueDay}T00:00:00Z`);
        cb.expiryDay = Number.isNaN(due)
          ? null
          : new Date(due + JOBS.callbackExpiryDays * DAY_MS).toISOString().slice(0, 10);
      }
    }
    old.schemaVersion = 6;
    return old;
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
  if (v > SCHEMA_VERSION) {
    throw new Error(
      `Save is from a newer game version (save v${v}, game supports v${SCHEMA_VERSION}) — update the game to load it`
    );
  }
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration from save version ${v}`);
    s = step(s);
    v = s.schemaVersion;
  }
  validateState(s);
  return s;
}

/**
 * Check a migrated save has every field the game dereferences without guards.
 * Throws naming the first bad field. Deliberately shallow beyond what the code
 * actually relies on — over-strict validation would brick saves needlessly.
 * @param {object} s candidate state at SCHEMA_VERSION
 */
export function validateState(s) {
  const checks = [
    ['player', 'object'], ['player.cash', 'number'], ['player.reputation', 'number'],
    ['player.lifetimeEarnings', 'number'], ['player.tierUnlocked', 'number'],
    ['tools', 'object'], ['tools.multimeterTier', 'number'],
    ['van', 'object'], ['van.slots', 'number'], ['van.stock', 'object'],
    ['techs', 'array'], ['routes', 'array'],
    ['jobs', 'object'], ['jobs.callbacks', 'array'],
    ['motd', 'object'], ['stats', 'object'], ['settings', 'object'],
    ['stats.jobsCompleted', 'number'], ['stats.cleanStreak', 'number'],
  ];
  for (const [path, type] of checks) {
    let value = s;
    for (const key of path.split('.')) value = value?.[key];
    const ok =
      type === 'array' ? Array.isArray(value) : typeof value === type && value !== null;
    if (!ok) throw new Error(`Save is missing or has a bad "${path}" (expected ${type})`);
  }
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
 * Build the save function the session will use, gated on the boot load result.
 * When load() reported an error the corrupt blob is still in storage, and
 * every save this session must be refused so it is never overwritten (rule 1:
 * saves are sacred). The player can still play; recovery UI can offer
 * export/import of the preserved blob.
 * @param {string|null} loadError the error from load(), or null
 * @param {Storage} [storage] injectable for tests; defaults to localStorage
 * @returns {function(object): void} save function for the whole session
 */
export function makePersist(loadError, storage = globalThis.localStorage) {
  if (!loadError) return (state) => save(state, storage);
  let warned = false;
  return () => {
    if (!warned) {
      console.warn(
        'Cold Call: not saving this session — the unreadable save is preserved in storage so it can be recovered.'
      );
      warned = true;
    }
  };
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
