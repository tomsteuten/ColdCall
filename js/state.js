/** @file Single game-state object: defaults, save/load to localStorage, export/import, migrations. */

import { STARTING, JOBS } from '../config/balance.js';

export const SCHEMA_VERSION = 16;
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
      prestigeCount: 0,
      founderBonus: 1.0,
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
      active: null, // in-flight diagnosis job; callback context also carries optional techId/techName attribution
      // { faultId, clientId, dueDay, expiryDay, misses, source, techId?, techName?, evidence? } —
      // source is 'player' (obligation, 40% rate) or 'tech' (rescue, ~90% rate);
      // misses counts wrong fixes so far; expiryDay is when it falls off the board;
      // evidence is the tests the player ran before the wrong fix (null when none),
      // restored on the return visit so a callback continues the investigation.
      callbacks: [],
      // Anti-repeat window (v15, 2026-07-08): the last few fresh-ticket fault
      // ids, excluded from the next draw (tickets.js). Callbacks/MotD/workshop
      // never touch it — they replay by design.
      recentFaultIds: [],
    },

    workshop: {
      machines: [], // { id, machineType, faultId, status }
    },

    motd: {
      lastPlayedDate: null, // UTC date string "YYYY-MM-DD", doubles as the puzzle seed
      streak: 0,
      lastResult: null, // { testsUsed, timeMs, solved, faultId } — faultId pins the puzzle so library updates can't rewrite history
    },

    // The Fault Codex (GDD §5, 2026-07-04): long-horizon collection. Only the
    // fix counts are persisted — names, machines and lesson text are derived
    // from the fault library at render time. Survives prestige on purpose.
    codex: {
      fixes: {}, // faultId -> times fixed correctly (presence = mastered)
      milestonesPaid: [], // completion percents already paid (25/50/75/100)
    },

    // Today's contract (GDD §5, 2026-07-04): one seeded-by-date bonus objective.
    // null until first generated; { date, machineType, count, reward, progress, paid }.
    contract: null,

    stats: {
      jobsCompleted: 0,
      cleanStreak: 0,
      callbacksCaused: 0,
    },

    settings: {
      audio: true,
      // 'auto' teaches the first ordinary ticket and then recedes; 'on' keeps
      // contextual help available; 'off' is the experienced-player lane.
      guidanceMode: 'auto',
      // 'rendered' (static raster) is the default for new games — all 5 machines
      // have full-state renders and they read far stronger than the SVGs
      // (session 22 visual pass). Existing saves keep whatever they have; the
      // v11→v12 migration still writes 'vector' and is never re-run on them.
      graphicsMode: 'rendered',
    },

    // Fractional offline-job carry: sub-job remainder from the last offline
    // simulation, added to the next session so short sessions accumulate fairly.
    offlineJobCarry: 0,
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
  // v6 -> v7: add offlineJobCarry so short offline sessions accumulate fairly.
  // Old saves had no carry field; start at 0 (no pending sub-job credit).
  6: (old) => {
    if (typeof old.offlineJobCarry !== 'number') old.offlineJobCarry = 0;
    old.schemaVersion = 7;
    return old;
  },
  // v7 -> v8: tech callbacks record the responsible technician. Existing tech
  // callbacks cannot be attributed reliably, so preserve them with explicit
  // nulls; the UI renders the neutral "tech miss" fallback.
  7: (old) => {
    for (const cb of old.jobs.callbacks) {
      if (cb.source === 'tech') {
        if (typeof cb.techId !== 'string') cb.techId = null;
        if (typeof cb.techName !== 'string') cb.techName = null;
      }
    }
    const activeCallback = old.jobs.active?.callback;
    if (activeCallback?.source === 'tech') {
      if (typeof activeCallback.techId !== 'string') activeCallback.techId = null;
      if (typeof activeCallback.techName !== 'string') activeCallback.techName = null;
    }
    old.schemaVersion = 8;
    return old;
  },
  // v8 -> v9: a player-worked callback can now carry the evidence (tests run)
  // gathered before the wrong fix, so the return visit continues the investigation
  // instead of starting from a blank panel (GDD §2.1 failure-as-learning). Existing
  // callbacks predate captured evidence; normalise the field to null so the claim
  // path treats them as a clean start — no evidence is invented for old saves.
  8: (old) => {
    for (const cb of old.jobs.callbacks) {
      if (!Array.isArray(cb.evidence)) cb.evidence = null;
    }
    old.schemaVersion = 9;
    return old;
  },
  // v9 -> v10: Machine of the Day is scored by simulated diagnostic minutes, not
  // wall-clock time, so interruptions (calls, sleep, refreshes, accessibility pauses)
  // can never worsen a shared-puzzle result (GDD §5). A stored result predates the
  // simMinutes field and its old wall-clock `timeMs` is no longer a fair score, so
  // normalise simMinutes to null ("unknown" — the result screen and share card then
  // show tests only). The legacy timeMs is left in place but is never read again.
  9: (old) => {
    if (old.motd.lastResult && typeof old.motd.lastResult.simMinutes !== 'number') {
      old.motd.lastResult.simMinutes = null;
    }
    old.schemaVersion = 10;
    return old;
  },
  // v10 -> v11: prestigeCount, founderBonus, and workshop added.
  10: (old) => {
    if (old.player) {
      if (typeof old.player.prestigeCount !== 'number') {
        old.player.prestigeCount = 0;
      }
      if (typeof old.player.founderBonus !== 'number') {
        old.player.founderBonus = 1.0;
      }
    }
    if (!old.workshop) {
      old.workshop = { machines: [] };
    }
    old.schemaVersion = 11;
    return old;
  },
  // v11 -> v12: add settings.graphicsMode (defaults to 'vector' for animated SVG visuals)
  11: (old) => {
    if (!old.settings) {
      old.settings = { audio: true };
    }
    if (typeof old.settings.graphicsMode !== 'string') {
      old.settings.graphicsMode = 'vector';
    }
    old.schemaVersion = 12;
    return old;
  },
  // v12 -> v13: jobs gained a symptom-variant index (0 = the fault's base
  // presentation). Every pre-variant job and callback was created from the base
  // symptoms — the only presentation that existed — so 0 is the factually
  // correct value, not a guess.
  12: (old) => {
    for (const cb of old.jobs.callbacks) {
      if (typeof cb.variant !== 'number') cb.variant = 0;
    }
    if (old.jobs.active && typeof old.jobs.active.variant !== 'number') {
      old.jobs.active.variant = 0;
    }
    old.schemaVersion = 13;
    return old;
  },
  // v13 -> v14: the Fault Codex and Today's Contract added (GDD §5). Old saves
  // start with an empty codex — past fixes were never recorded per fault, and
  // inventing history would be a guess. contract starts null (generated on the
  // next home render).
  13: (old) => {
    if (typeof old.codex !== 'object' || old.codex === null) {
      old.codex = { fixes: {}, milestonesPaid: [] };
    }
    if (old.contract === undefined) old.contract = null;
    old.schemaVersion = 14;
    return old;
  },
  // v14 -> v15: anti-repeat ticket draw (2026-07-08 playtest fix). The last
  // few drawn fault ids are excluded from the next fresh-ticket draw so the
  // same fault can't come up twice in quick succession. Empty for old saves —
  // their history was never recorded.
  14: (old) => {
    if (!Array.isArray(old.jobs?.recentFaultIds)) {
      old.jobs.recentFaultIds = [];
    }
    old.schemaVersion = 15;
    return old;
  },
  // v15 -> v16: optional contextual diagnosis help. Existing players receive
  // 'auto', which is silent once they have completed a job; no experienced UI
  // is unexpectedly expanded, while a paused first ticket can still be taught.
  15: (old) => {
    if (!old.settings || typeof old.settings !== 'object') old.settings = { audio: true };
    if (!['auto', 'on', 'off'].includes(old.settings.guidanceMode)) {
      old.settings.guidanceMode = 'auto';
    }
    old.schemaVersion = 16;
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
  // Determine starting version.
  // Missing (undefined) → pre-release "v0" flat shape (cash at top level).
  // Present but invalid (string, NaN, negative, fractional) → refuse; preserving
  // the blob untouched is the only safe action (saves are sacred, CLAUDE.md rule 1).
  let v;
  if (s.schemaVersion === undefined) {
    // A missing version is only v0 if the blob actually looks like the
    // historical pre-release flat shape (cash at top level, no nested
    // containers). A modern save that somehow lost its schemaVersion is
    // damaged, not ancient — running it through MIGRATIONS[0] would rebuild
    // it from defaults and wipe real progress.
    const hasModernShape =
      (typeof s.player === 'object' && s.player !== null) ||
      (typeof s.jobs === 'object' && s.jobs !== null) ||
      (typeof s.motd === 'object' && s.motd !== null);
    if (hasModernShape) {
      throw new Error(
        'Save has no schemaVersion but is not a pre-release save — the blob has not been changed'
      );
    }
    v = 0;
  } else if (
    typeof s.schemaVersion !== 'number' ||
    !Number.isFinite(s.schemaVersion) ||
    s.schemaVersion < 0 ||
    s.schemaVersion !== Math.floor(s.schemaVersion)
  ) {
    throw new Error(
      'Save has an unrecognised schemaVersion — the blob has not been changed'
    );
  } else {
    v = s.schemaVersion;
  }
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
    ['player.prestigeCount', 'number'], ['player.founderBonus', 'number'],
    ['tools', 'object'], ['tools.multimeterTier', 'number'],
    ['van', 'object'], ['van.slots', 'number'], ['van.stock', 'object'],
    ['techs', 'array'], ['routes', 'array'],
    ['jobs', 'object'], ['jobs.callbacks', 'array'], ['jobs.recentFaultIds', 'array'],
    ['workshop', 'object'], ['workshop.machines', 'array'],
    ['codex', 'object'], ['codex.fixes', 'object'], ['codex.milestonesPaid', 'array'],
    ['motd', 'object'], ['stats', 'object'], ['settings', 'object'],
    ['stats.jobsCompleted', 'number'], ['stats.cleanStreak', 'number'],
    ['offlineJobCarry', 'number'], ['settings.graphicsMode', 'string'],
    ['settings.guidanceMode', 'string'],
  ];
  for (const [path, type] of checks) {
    let value = s;
    for (const key of path.split('.')) value = value?.[key];
    const ok =
      type === 'array' ? Array.isArray(value) : typeof value === type && value !== null;
    if (!ok) throw new Error(`Save is missing or has a bad "${path}" (expected ${type})`);
  }
  if (!['auto', 'on', 'off'].includes(s.settings.guidanceMode)) {
    throw new Error('Save has a bad "settings.guidanceMode" (expected auto, on or off)');
  }

  // Fields the UI interpolates into innerHTML assuming they are numbers. A
  // hostile imported blob could smuggle HTML through them if the type isn't
  // enforced here — every genuine save has always had numbers in these slots,
  // so this can never brick a real save.
  if (typeof s.motd.streak !== 'number') {
    throw new Error('Save has a bad "motd.streak" (expected number)');
  }
  if (s.motd.lastResult !== null && s.motd.lastResult !== undefined) {
    if (typeof s.motd.lastResult.testsUsed !== 'number') {
      throw new Error('Save has a bad "motd.lastResult.testsUsed" (expected number)');
    }
    if (typeof s.motd.lastResult.solved !== 'boolean') {
      throw new Error('Save has a bad "motd.lastResult.solved" (expected boolean)');
    }
  }
  for (const [partId, count] of Object.entries(s.van.stock)) {
    if (typeof count !== 'number') {
      throw new Error(`Save has a bad van stock count for "${partId}" (expected number)`);
    }
  }
  for (const [faultId, count] of Object.entries(s.codex.fixes)) {
    if (typeof count !== 'number') {
      throw new Error(`Save has a bad codex fix count for "${faultId}" (expected number)`);
    }
  }
  // Today's contract is null (not yet generated) or a well-typed object — the
  // UI interpolates count/progress/reward as numbers.
  if (s.contract !== null && s.contract !== undefined) {
    if (typeof s.contract !== 'object') {
      throw new Error('Save has a bad "contract" (expected object or null)');
    }
    for (const field of ['count', 'progress', 'reward']) {
      if (typeof s.contract[field] !== 'number') {
        throw new Error(`Save has a bad "contract.${field}" (expected number)`);
      }
    }
    if (typeof s.contract.machineType !== 'string' || typeof s.contract.date !== 'string') {
      throw new Error('Save has a bad "contract.machineType"/"contract.date" (expected string)');
    }
  }
  for (const tech of s.techs) {
    if (typeof tech.name !== 'string') {
      throw new Error('Save has a tech with a bad "name" (expected string)');
    }
    if (typeof tech.skill !== 'number') {
      throw new Error('Save has a tech with a bad "skill" (expected number)');
    }
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
  // Decode/parse failures produce browser errors ("URI malformed", "Unexpected
  // token") that mean nothing to a player — translate them here. Errors from
  // migrate()/validateState pass through: those messages are already written
  // for the player and say what's actually wrong with the save.
  let parsed;
  try {
    const json = decodeURIComponent(escape(atob(blob.trim())));
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "That doesn't look like a Cold Call save. Paste the whole export text, unedited."
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      "That doesn't look like a Cold Call save. Paste the whole export text, unedited."
    );
  }
  return migrate(parsed);
}
