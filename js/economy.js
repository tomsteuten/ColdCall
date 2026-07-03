/** @file All earning/spending math. Every number it uses comes from config/balance.js. */

import { JOBS, REPUTATION, TOOLS, TECHS, DIAGNOSIS, STARTING, PRESTIGE, WORKSHOP, VAN, ROUTES, CODEX } from '../config/balance.js';

const DAY_MS = 24 * 60 * 60 * 1000; // time unit, not a tunable

/**
 * UTC date string ("YYYY-MM-DD") some days from now — callback due dates.
 * @param {number} days
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {string}
 */
export function utcDateStringAfter(days, now = Date.now()) {
  return new Date(now + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The diagnosis speed bonus in whole dollars for the simulated minutes a job
 * spent on tests (GDD §2.1). Starts at DIAGNOSIS.speedBonusMax on a blind commit
 * and decays linearly, floored at 0 — so being thorough is safe (never below
 * base payout) and being sharp is rewarded. Pure; used by settleJob and the UI.
 * @param {number} minutesSpent simulated minutes the active job accumulated
 * @returns {number} bonus dollars, always >= 0
 */
export function speedBonus(minutesSpent) {
  return Math.max(
    0,
    Math.round(DIAGNOSIS.speedBonusMax - minutesSpent * DIAGNOSIS.bonusDecayPerMin)
  );
}

/**
 * The speed bonus a job actually earns: the decay curve above, gated on having
 * run at least DIAGNOSIS.minTestsForBonus tests (2026-07-04, GDD §2.1 — a
 * zero-test blind commit forfeits the bonus, so guessing can't dominate).
 * Single source of truth for settlement and every UI that previews the bonus.
 * @param {number} minutesSpent simulated minutes the active job accumulated
 * @param {number} testsCount how many tests were run before committing
 * @returns {number} bonus dollars, always >= 0
 */
export function earnedSpeedBonus(minutesSpent, testsCount) {
  if (testsCount < DIAGNOSIS.minTestsForBonus) return 0;
  return speedBonus(minutesSpent);
}

/**
 * Settle a finished job: apply cash, lifetime earnings, reputation and stats.
 *
 * Fresh job — correct: payout minus parts, plus a speed bonus that decays with
 * the simulated minutes spent on tests (GDD §2.1). Wrong: partial payout at
 * wrongFixPayoutMult, reputation hit, job queued to return (GDD §2.1).
 * No parts deduction on a wrong fix — the correct part was never fitted.
 *
 * Callback job (opts.callback set) — correct: a source-dependent rate applied to
 * the job's NET (payout minus parts), so a correct rescue can never lose money
 * however expensive the part. A player-caused obligation pays callbackJobPayoutMult
 * (GDD §6's 40%); a tech-caused rescue pays the higher rescueCallbackPayoutMult
 * (GDD §3.1, kept < 1.0 so it never beats a fresh ticket). Clean streak does NOT
 * advance, a rescue isn't a clean job. Wrong again: $0 (the partial was already
 * paid once), a dampened reputation hit, and the job re-queues — keeping its
 * source — for tomorrow.
 *
 * @param {object} state game state (mutated)
 * @param {object} fault the fault that was (or wasn't) fixed
 * @param {boolean} correct whether the committed fix was the correct one
 * @param {string} clientId for the callback queue entry
 * @param {{callback?: {misses: number, source?: string, techId?: string|null, techName?: string|null}|null, minutesSpent?: number, testsRun?: string[], variant?: number, now?: number}} [opts]
 *   callback context (source defaults to 'player' — the conservative lower rate),
 *   simulated minutes spent from the active job, the tests the player ran (saved
 *   as evidence on a wrong-fix callback so the return visit continues the
 *   investigation, GDD §2.1), the symptom-variant index the job presented (saved
 *   on a wrong-fix callback so the return visit shows the same machine, not a
 *   rerolled presentation), and an injectable clock for tests
 * @returns {{earned: number, repDelta: number, unlockedTier: number|null}} for the invoice screen
 */
export function settleJob(state, fault, correct, clientId, opts = {}) {
  const { callback = null, minutesSpent = 0, testsRun = [], variant = 0, now = Date.now() } = opts;
  // A callback with no source predates the split (old in-flight job) — treat it
  // as a player obligation, the lower rate, so the change never over-pays.
  const source = callback ? callback.source ?? 'player' : 'player';
  let earned;
  let repDelta;
  const multiplier = state.player.founderBonus || 1.0;

  if (correct) {
    if (fault.partsCost > 0) {
      const inStock = state.van.stock['generic-parts'] ?? 0;
      if (inStock < 1) throw new Error('Van is out of parts — restock before committing');
      state.van.stock['generic-parts'] = inStock - 1;
    }
    const net = fault.payout - fault.partsCost;
    // No speed bonus on a rescue — callbacks are already discounted (GDD §2.1).
    // On a fresh job the bonus is gated on having run at least one test.
    const callbackMult =
      source === 'tech' ? JOBS.rescueCallbackPayoutMult : JOBS.callbackJobPayoutMult;
    earned = callback
      ? Math.round(net * callbackMult)
      : net + earnedSpeedBonus(minutesSpent, testsRun.length);

    // Apply founderBonus to correct fix cash earned
    earned = Math.round(earned * multiplier);

    // Apply founderBonus to correct fix reputation gain
    repDelta = Math.round(REPUTATION.correctFix * multiplier);
    state.player.reputation += repDelta;

    state.stats.jobsCompleted += 1;
    if (!callback) state.stats.cleanStreak += 1;
  } else {
    earned = callback ? 0 : Math.round(fault.payout * JOBS.wrongFixPayoutMult);

    // Apply founderBonus to wrong fix cash earned (if any)
    earned = Math.round(earned * multiplier);

    repDelta = -(callback ? REPUTATION.repeatCallbackPenalty : REPUTATION.callbackPenalty);
    state.player.reputation += repDelta;
    state.stats.callbacksCaused += 1;
    state.stats.cleanStreak = 0;
    state.jobs.callbacks.push({
      faultId: fault.id,
      clientId,
      dueDay: utcDateStringAfter(JOBS.callbackDueDays, now),
      expiryDay: utcDateStringAfter(JOBS.callbackDueDays + JOBS.callbackExpiryDays, now),
      misses: callback ? callback.misses + 1 : 1,
      // A botched rescue stays a rescue; a fresh miss is the player's obligation.
      source: callback ? source : 'player',
      // Save the tests the player ran so the return visit continues the
      // investigation instead of repeating button presses (GDD §2.1). Null when
      // the player committed blind — nothing to restore, a clean start.
      evidence: testsRun.length ? testsRun.slice() : null,
      // The symptom variant this job presented — the return visit must show the
      // same machine in the same state, never a rerolled presentation.
      variant,
      ...(callback && source === 'tech'
        ? {
            techId: typeof callback.techId === 'string' ? callback.techId : null,
            techName: typeof callback.techName === 'string' ? callback.techName : null,
          }
        : {}),
    });
  }
  state.player.cash += earned;
  state.player.lifetimeEarnings += earned;
  return { earned, repDelta, unlockedTier: checkTierUnlock(state) };
}

/**
 * Record a correct diagnosis in the Fault Codex (GDD §5) and pay any newly
 * crossed completion milestones (one-time each, CODEX.milestones). Mastery
 * percent counts only faults still in the library, so a retired fault can
 * neither inflate progress nor claw back a bonus already paid.
 * Every correct diagnosis counts — fresh tickets, callbacks, workshop repairs
 * and MotD solves are all the same deduction.
 * @param {object} state game state (mutated: codex, cash on a milestone)
 * @param {string} faultId the fault just diagnosed correctly
 * @param {Object<string, object>} faults fault library keyed by id
 * @returns {{isNew: boolean, mastered: number, total: number, milestonesPaid: Array<{pct: number, bonus: number}>}}
 */
export function recordCodexFix(state, faultId, faults) {
  const fixes = state.codex.fixes;
  const isNew = !(faultId in fixes);
  fixes[faultId] = (fixes[faultId] ?? 0) + 1;

  const total = Object.keys(faults).length;
  const mastered = Object.keys(fixes).filter((id) => id in faults).length;
  const milestonesPaid = [];
  if (total > 0) {
    const pct = (mastered / total) * 100;
    for (const [pctKey, bonus] of Object.entries(CODEX.milestones)) {
      const threshold = Number(pctKey);
      if (pct >= threshold && !state.codex.milestonesPaid.includes(threshold)) {
        state.codex.milestonesPaid.push(threshold);
        state.player.cash += bonus;
        state.player.lifetimeEarnings += bonus;
        milestonesPaid.push({ pct: threshold, bonus });
      }
    }
  }
  return { isNew, mastered, total, milestonesPaid };
}

/**
 * Unlock the next client tier if reputation has reached its balance.js
 * threshold. One tier per call is plenty — thresholds are minutes apart.
 * @param {object} state game state (mutated on unlock)
 * @returns {number|null} the tier just unlocked, or null
 */
function checkTierUnlock(state) {
  const next = state.player.tierUnlocked + 1;
  const threshold = REPUTATION.tierThresholds[next];
  if (threshold !== undefined && state.player.reputation >= threshold) {
    state.player.tierUnlocked = next;
    return next;
  }
  return null;
}

/**
 * Callbacks that have come due: dueDay is today (UTC) or earlier.
 * Pure — the home screen uses it for the "callbacks waiting" count.
 * @param {object} state
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {object[]} due entries from state.jobs.callbacks
 */
export function dueCallbacks(state, now = Date.now()) {
  const today = utcDateStringAfter(0, now);
  return state.jobs.callbacks.filter((cb) => cb.dueDay <= today);
}

/**
 * Claim a specific callback the player chose from the Callbacks list, removing
 * it from the queue (GDD §3.1: claiming is a choice, never auto-claimed). The
 * index is into state.jobs.callbacks — the UI passes the position of the row it
 * rendered. Refuses an out-of-range or not-yet-due index (returns null without
 * mutating). An entry whose fault has left the library is dropped with a console
 * error and null returned — same convention main.js uses for a stranded active
 * job. The caller starts the job from the returned entry; if the player then
 * refreshes, the callback context lives on state.jobs.active, so nothing is lost.
 * @param {object} state game state (mutated: queue entry removed on success)
 * @param {Object<string, object>} faults fault library keyed by id
 * @param {number} index position in state.jobs.callbacks to claim
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{faultId: string, clientId: string, dueDay: string, expiryDay: string, misses: number, source: string, techId?: string|null, techName?: string|null, evidence?: string[]|null}|null}
 */
export function claimCallback(state, faults, index, now = Date.now()) {
  const today = utcDateStringAfter(0, now);
  const cb = state.jobs.callbacks[index];
  if (!cb || cb.dueDay > today) return null; // out of range or not yet due
  state.jobs.callbacks.splice(index, 1);
  if (!faults[cb.faultId]) {
    console.error(`Cold Call: callback references unknown fault "${cb.faultId}"; dropping it.`);
    return null;
  }
  return cb;
}

/**
 * Remove callbacks that have passed their expiry day, computed deterministically
 * on load like offline progress (GDD §3.1). Player-caused obligations expiring
 * cost reputation (you abandoned a client you owe); tech-caused rescues expire
 * silently — they were optional bonus pay, never a debt. Entries with no
 * expiryDay (shouldn't occur post-migration) are left alone.
 * @param {object} state game state (mutated: expired entries removed, rep docked)
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{count: number, playerExpired: number, techExpired: number, repPenalty: number}|null}
 *   null when nothing expired — nothing to report on the welcome-back banner
 */
export function expireCallbacks(state, now = Date.now()) {
  const today = utcDateStringAfter(0, now);
  const isExpired = (cb) => typeof cb.expiryDay === 'string' && cb.expiryDay < today;
  const expired = state.jobs.callbacks.filter(isExpired);
  if (expired.length === 0) return null;
  state.jobs.callbacks = state.jobs.callbacks.filter((cb) => !isExpired(cb));
  const playerExpired = expired.filter((cb) => cb.source !== 'tech').length;
  const techExpired = expired.length - playerExpired;
  const repPenalty = playerExpired * REPUTATION.expiredCallbackRepPenalty;
  state.player.reputation -= repPenalty;
  return { count: expired.length, playerExpired, techExpired, repPenalty };
}

/**
 * Tools for sale. Costs come from config/balance.js (rule 3); blurbs are the
 * shop copy. GDD §3.3: tools unlock test types, they don't just inflate numbers.
 * @type {Object<string, {name: string, blurb: string, cost: number, owned: function(object): boolean, apply: function(object): void}>}
 */
export const TOOL_CATALOGUE = {
  'multimeter-tier-2': {
    name: 'Multimeter Tier 2',
    blurb: 'A proper meter. Unlocks the continuity test on motors and sensors.',
    cost: TOOLS.multimeterTier2Cost,
    owned: (state) => state.tools.multimeterTier >= 2,
    apply: (state) => {
      state.tools.multimeterTier = 2;
    },
  },
  'multimeter-tier-3': {
    name: 'Multimeter Tier 3',
    blurb: 'Lab-grade meter. Definitively rules out one wrong fix option on every job.',
    cost: TOOLS.multimeterTier3Cost,
    owned: (state) => state.tools.multimeterTier >= 3,
    // Tools are a ladder: no skipping straight to tier 3.
    locked: (state) => (state.tools.multimeterTier < 2 ? 'Buy Multimeter Tier 2 first' : null),
    apply: (state) => {
      state.tools.multimeterTier = 3;
    },
  },
};

/**
 * Restock the van to full capacity. Refuses when already full.
 * Free at launch: van stock is availability, not a second parts bill — the
 * part's price is charged per job via fault.partsCost (GDD §6), so charging
 * here too would bill the player twice for the same part. The GDD §2.3
 * supplier-run time cost / express markup is a v1.x lever.
 * @param {object} state game state (mutated on success)
 * @returns {{ok: boolean, reason: string|null}}
 */
export function restockVan(state) {
  const current = state.van.stock['generic-parts'] ?? 0;
  if (current >= state.van.slots) return { ok: false, reason: 'Van already full' };
  state.van.stock['generic-parts'] = state.van.slots;
  return { ok: true, reason: null };
}

// The route included with the first hire (GDD §3.1); later routes are bought.
const BURGERTOWN_ROUTE_ID = 'burgertown-south';
const TECH_NAMES = ['Dave', 'Mike'];

/**
 * Hire a tech. Deducts the hire cost, creates the tech, ensures the included
 * Burgertown route exists, and assigns the hire to the owned route with the
 * fewest techs (ties go to the earliest-contracted route) so coverage spreads
 * across purchased routes without an assignment UI.
 * Refuses if unaffordable, already at max techs, or tier 2 not yet unlocked.
 * @param {object} state game state (mutated on success)
 * @param {number} [now] ms epoch, injectable for tests
 * @returns {{ok: boolean, reason: string|null}}
 */
export function hireTech(state, now = Date.now()) {
  if (state.techs.length >= TECHS.maxTechs) return { ok: false, reason: 'Max techs already hired' };
  if (state.player.cash < TECHS.firstHireCost) return { ok: false, reason: 'Not enough cash' };
  if (state.player.tierUnlocked < 2) return { ok: false, reason: 'Unlock Tier 2 first' };

  state.player.cash -= TECHS.firstHireCost;

  // Ensure the included contract route exists.
  if (!state.routes.find((r) => r.id === BURGERTOWN_ROUTE_ID)) {
    state.routes.push({ id: BURGERTOWN_ROUTE_ID, clientId: ROUTES[BURGERTOWN_ROUTE_ID].clientId });
  }

  // Least-covered owned route gets the new hire.
  const byLoad = state.routes
    .map((r) => ({ r, load: state.techs.filter((t) => t.routeId === r.id).length }))
    .sort((a, b) => a.load - b.load);
  const routeId = byLoad[0].r.id;

  const name = TECH_NAMES[state.techs.length] ?? `Tech ${state.techs.length + 1}`;
  state.techs.push({
    id: `tech-${state.techs.length + 1}`,
    name,
    skill: 1,
    routeId,
    hiredAt: now,
  });

  return { ok: true, reason: null };
}

/**
 * Buy a tool: spend cash, apply its effect. Refuses (without mutating) when
 * already owned or unaffordable — those are player situations, not bugs, so
 * the result carries a player-facing reason instead of throwing.
 * @param {object} state game state (mutated on success)
 * @param {string} toolId key in TOOL_CATALOGUE
 * @returns {{ok: boolean, reason: string|null}}
 */
export function buyTool(state, toolId) {
  const tool = TOOL_CATALOGUE[toolId];
  if (!tool) throw new Error(`Unknown tool id "${toolId}"`);
  if (tool.owned(state)) return { ok: false, reason: 'Already owned' };
  const lockReason = tool.locked ? tool.locked(state) : null;
  if (lockReason) return { ok: false, reason: lockReason };
  if (state.player.cash < tool.cost) return { ok: false, reason: 'Not enough cash' };
  state.player.cash -= tool.cost;
  tool.apply(state);
  return { ok: true, reason: null };
}

/**
 * Buy the next van slot upgrade (VAN.slotUpgrades, in order). Stock is not
 * granted — the free restock fills to the new capacity between jobs.
 * @param {object} state game state (mutated on success)
 * @returns {{ok: boolean, reason: string|null}}
 */
export function upgradeVan(state) {
  const next = VAN.slotUpgrades.find((u) => u.slots > state.van.slots);
  if (!next) return { ok: false, reason: 'Van already at maximum slots' };
  if (state.player.cash < next.cost) return { ok: false, reason: 'Not enough cash' };
  state.player.cash -= next.cost;
  state.van.slots = next.slots;
  return { ok: true, reason: null };
}

/**
 * Train a tech to the next skill level (raises idle success rate per
 * TECHS.successRateBySkill). One level per purchase, capped at TECHS.maxSkill.
 * @param {object} state game state (mutated on success)
 * @param {string} techId
 * @returns {{ok: boolean, reason: string|null}}
 */
export function trainTech(state, techId) {
  const tech = state.techs.find((t) => t.id === techId);
  if (!tech) return { ok: false, reason: 'No such tech' };
  if (tech.skill >= TECHS.maxSkill) return { ok: false, reason: 'Already fully trained' };
  if (state.player.cash < TECHS.trainingCost) return { ok: false, reason: 'Not enough cash' };
  state.player.cash -= TECHS.trainingCost;
  tech.skill += 1;
  return { ok: true, reason: null };
}

/**
 * Buy a contract route from ROUTES (balance.js). On purchase, techs are
 * re-spread so every owned route gets coverage: the newest tech moves onto the
 * new route if the old one had more than one tech on it. Deterministic and
 * legible — the shop staff list shows who works where.
 * @param {object} state game state (mutated on success)
 * @param {string} routeId key in ROUTES
 * @returns {{ok: boolean, reason: string|null}}
 */
export function buyRoute(state, routeId) {
  const info = ROUTES[routeId];
  if (!info) return { ok: false, reason: 'Unknown route' };
  if (state.routes.some((r) => r.id === routeId)) return { ok: false, reason: 'Already contracted' };
  if (state.player.tierUnlocked < info.tierRequired) {
    return { ok: false, reason: `Unlock Tier ${info.tierRequired} first` };
  }
  if (state.player.cash < info.cost) return { ok: false, reason: 'Not enough cash' };
  state.player.cash -= info.cost;
  state.routes.push({ id: routeId, clientId: info.clientId });
  // Re-spread: move the newest tech here if any route holds 2+ techs.
  const crowded = state.techs.filter((t, _, all) =>
    all.filter((o) => o.routeId === t.routeId).length > 1
  );
  if (crowded.length > 0) crowded[crowded.length - 1].routeId = routeId;
  return { ok: true, reason: null };
}

/**
 * The purchase ladder (2026-07-04): every buyable, cheapest first, so the shop
 * can always show what's next — including locked items and their unlock
 * conditions. Pure over state; each row's `buy` key maps to buyLadderItem.
 * Costs all come from config/balance.js.
 * @param {object} state
 * @returns {Array<{id: string, name: string, detail: string, cost: number, owned: boolean, lockReason: string|null}>}
 */
export function purchaseLadder(state) {
  const tech = (i) => state.techs[i] ?? null;
  const techName = (i, fallback) => (tech(i) ? tech(i).name : fallback);
  const successPct = (skill) => Math.round((TECHS.successRateBySkill[skill] ?? TECHS.baseSuccessRate) * 100);
  const froyo = ROUTES['froyo-strip'];
  const [van6, van8] = VAN.slotUpgrades;
  const rows = [
    {
      id: 'multimeter-tier-2',
      name: 'Multimeter Tier 2',
      detail: TOOL_CATALOGUE['multimeter-tier-2'].blurb,
      cost: TOOLS.multimeterTier2Cost,
      owned: state.tools.multimeterTier >= 2,
      lockReason: null,
    },
    {
      id: 'hire-tech-1',
      name: 'Hire a tech',
      detail: `Works your contract route while you're away (${successPct(1)}% success).`,
      cost: TECHS.firstHireCost,
      owned: state.techs.length >= 1,
      lockReason: state.player.tierUnlocked < 2 ? `Unlock Tier 2 first (rep ${REPUTATION.tierThresholds[2]})` : null,
    },
    {
      id: 'hire-tech-2',
      name: 'Hire a second tech',
      detail: 'Doubles idle coverage across your routes.',
      cost: TECHS.firstHireCost,
      owned: state.techs.length >= 2,
      lockReason:
        state.player.tierUnlocked < 2
          ? `Unlock Tier 2 first (rep ${REPUTATION.tierThresholds[2]})`
          : state.techs.length < 1
            ? 'Hire your first tech first'
            : null,
    },
    {
      id: 'van-slots-6',
      name: `Van racking — ${van6.slots} slots`,
      detail: 'Fewer restock runs between jobs.',
      cost: van6.cost,
      owned: state.van.slots >= van6.slots,
      lockReason: null,
    },
    {
      id: 'train-tech-1',
      name: `Train ${techName(0, 'your first tech')} — skill 2`,
      detail: `Success rate ${successPct(1)}% → ${successPct(2)}%: fewer botched idle jobs.`,
      cost: TECHS.trainingCost,
      owned: (tech(0)?.skill ?? 1) >= TECHS.maxSkill,
      lockReason: tech(0) ? null : 'Hire a tech first',
    },
    {
      id: 'train-tech-2',
      name: `Train ${techName(1, 'your second tech')} — skill 2`,
      detail: `Success rate ${successPct(1)}% → ${successPct(2)}%: fewer botched idle jobs.`,
      cost: TECHS.trainingCost,
      owned: (tech(1)?.skill ?? 1) >= TECHS.maxSkill,
      lockReason: tech(1) ? null : 'Hire a second tech first',
    },
    {
      id: 'route-froyo-strip',
      name: `Contract: ${froyo.name}`,
      detail: `Tier ${froyo.tier} route — techs assigned there earn $${TECHS.routeEarningsPerJob[froyo.tier]}/job.`,
      cost: froyo.cost,
      owned: state.routes.some((r) => r.id === 'froyo-strip'),
      lockReason:
        state.player.tierUnlocked < froyo.tierRequired
          ? `Unlock Tier ${froyo.tierRequired} first (rep ${REPUTATION.tierThresholds[froyo.tierRequired]})`
          : null,
    },
    {
      id: 'van-slots-8',
      name: `Van racking — ${van8.slots} slots`,
      detail: 'A full day of parts on board.',
      cost: van8.cost,
      owned: state.van.slots >= van8.slots,
      lockReason: state.van.slots < van6.slots ? `Buy the ${van6.slots}-slot racking first` : null,
    },
    {
      id: 'multimeter-tier-3',
      name: 'Multimeter Tier 3',
      detail: TOOL_CATALOGUE['multimeter-tier-3'].blurb,
      cost: TOOLS.multimeterTier3Cost,
      owned: state.tools.multimeterTier >= 3,
      lockReason: TOOL_CATALOGUE['multimeter-tier-3'].locked(state),
    },
  ];
  return rows;
}

/**
 * Buy a purchase-ladder row by id — dispatches to the specific purchase
 * function. Unknown ids throw (programmer error, not player state).
 * @param {object} state game state (mutated on success)
 * @param {string} id ladder row id
 * @param {number} [now] ms epoch, injectable for tests (tech hire timestamps)
 * @returns {{ok: boolean, reason: string|null}}
 */
export function buyLadderItem(state, id, now = Date.now()) {
  switch (id) {
    case 'multimeter-tier-2':
    case 'multimeter-tier-3':
      return buyTool(state, id);
    case 'hire-tech-1':
    case 'hire-tech-2':
      return hireTech(state, now);
    case 'van-slots-6':
    case 'van-slots-8': {
      // upgradeVan buys the NEXT tier; refuse a skip so the row is honest.
      const want = id === 'van-slots-6' ? VAN.slotUpgrades[0].slots : VAN.slotUpgrades[1].slots;
      const next = VAN.slotUpgrades.find((u) => u.slots > state.van.slots);
      if (!next || next.slots !== want) {
        return { ok: false, reason: next ? `Buy the ${next.slots}-slot racking first` : 'Van already at maximum slots' };
      }
      return upgradeVan(state);
    }
    case 'train-tech-1':
      return state.techs[0] ? trainTech(state, state.techs[0].id) : { ok: false, reason: 'Hire a tech first' };
    case 'train-tech-2':
      return state.techs[1] ? trainTech(state, state.techs[1].id) : { ok: false, reason: 'Hire a second tech first' };
    case 'route-froyo-strip':
      return buyRoute(state, 'froyo-strip');
    default:
      throw new Error(`Unknown ladder item "${id}"`);
  }
}

// Buyable refurb machines. Prices and the rule-5 margin rationale live in
// config/balance.js (rule 3); this alias keeps existing import sites working.
export const WORKSHOP_MACHINES = WORKSHOP.machines;

/**
 * Buy a damaged machine for the workshop. Refuses (without mutating) when the
 * type is unknown, tier-locked, or unaffordable.
 * @param {object} state game state (mutated on success)
 * @param {string} machineType key in WORKSHOP_MACHINES
 * @param {string} faultId the fault the machine arrives with
 * @param {string} id unique id for the workshop entry
 * @returns {{ok: boolean, reason: string|null}}
 */
export function buyWorkshopMachine(state, machineType, faultId, id) {
  const info = WORKSHOP_MACHINES[machineType];
  if (!info) return { ok: false, reason: 'Unknown machine type' };
  if (state.player.tierUnlocked < info.tierRequired) {
    return { ok: false, reason: `Unlock Tier ${info.tierRequired} first` };
  }
  if (state.player.cash < info.buyPrice) return { ok: false, reason: 'Not enough cash' };
  state.player.cash -= info.buyPrice;
  state.workshop.machines.push({ id, machineType, faultId, status: 'broken' });
  return { ok: true, reason: null };
}

/**
 * Sell a repaired workshop machine. The sale price is deliberately NOT scaled
 * by founderBonus: fresh-ticket payouts are, so flipping machines can never
 * out-earn taking tickets however many times the business has been sold
 * (CLAUDE.md rule 5 — see the WORKSHOP note in config/balance.js).
 * @param {object} state game state (mutated on success)
 * @param {string} machineId id of the workshop entry
 * @returns {{ok: boolean, reason: string|null, earned: number}}
 */
export function sellWorkshopMachine(state, machineId) {
  const index = state.workshop.machines.findIndex((m) => m.id === machineId);
  if (index === -1) return { ok: false, reason: 'No such machine', earned: 0 };
  const machine = state.workshop.machines[index];
  if (machine.status !== 'repaired') {
    return { ok: false, reason: 'Machine not repaired yet', earned: 0 };
  }
  const info = WORKSHOP_MACHINES[machine.machineType];
  if (!info) return { ok: false, reason: 'Unknown machine type', earned: 0 };
  const earned = info.sellPrice;
  state.player.cash += earned;
  state.player.lifetimeEarnings += earned;
  state.workshop.machines.splice(index, 1);
  return { ok: true, reason: null, earned };
}

/**
 * Perform prestige ("Sell the Business").
 * Resets cash, active/queued jobs, van stock, upgrades, routes, and hired techs.
 * Keeps stats (like jobsCompleted, cleanStreak, etc.) and prestigeCount/founderBonus.
 * Calculates the new founderBonus based on current reputation.
 * GDD says: "keep a Founder Bonus (permanent multiplier from lifetime reputation)".
 * @param {object} state game state (mutated)
 */
export function prestige(state) {
  if (state.player.lifetimeEarnings < PRESTIGE.lifetimeEarningsThreshold) {
    throw new Error('Cannot sell the business: lifetime earnings below threshold.');
  }

  const reputation = Math.max(0, state.player.reputation);
  const bonusIncrease = reputation * PRESTIGE.bonusPerRep;
  state.player.founderBonus = Number(((state.player.founderBonus || 1.0) + bonusIncrease).toFixed(4));
  state.player.prestigeCount = (state.player.prestigeCount || 0) + 1;

  // Reset progress variables
  state.player.cash = STARTING.cash;
  state.player.reputation = 0;
  state.player.lifetimeEarnings = 0;
  state.player.tierUnlocked = STARTING.tierUnlocked;

  // Reset tools
  state.tools.multimeterTier = STARTING.multimeterTier;
  state.tools.thermalCamera = false;

  // Reset van
  state.van.slots = STARTING.vanSlots;
  state.van.stock = { 'generic-parts': STARTING.vanSlots };

  // Reset techs & routes
  state.techs = [];
  state.routes = [];

  // Reset active and queued jobs
  state.jobs.active = null;
  state.jobs.callbacks = [];

  // Reset workshop machines
  state.workshop = { machines: [] };

  // Reset offlineJobCarry
  state.offlineJobCarry = 0;
}


