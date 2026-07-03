/** @file EVERY tunable number lives here (CLAUDE.md rule 3). First guesses from GDD §6 — tune freely. */

/** New-game starting loadout (GDD §6: "$500, basic multimeter, 4 van slots, Tier 1 clients"). */
export const STARTING = {
  cash: 500,
  multimeterTier: 1,
  vanSlots: 4,
  tierUnlocked: 1,
};

/** Job payouts and parts costs by machine tier. */
export const JOBS = {
  tier1: {
    payoutMin: 80, // correct first time
    payoutMax: 150,
    partsCostMin: 10,
    partsCostMax: 40,
  },
  tier2: {
    payoutMin: 80, // low end stays cheap: trivial fixes (door O-ring) are part of the joke
    payoutMax: 200,
    partsCostMin: 5,
    partsCostMax: 60,
  },
  tier3: {
    payoutMin: 150,
    payoutMax: 350,
    partsCostMin: 10,
    partsCostMax: 120,
  },
  // Wrong fix -> callback: partial payout now, job returns tomorrow at reduced rate.
  // GDD §2.1 says "partial payout" with no number; this knob is ours to tune.
  wrongFixPayoutMult: 0.4,
  // Player-caused (obligation) callback rate when fixed correctly — GDD §6's
  // "Callback pays 40%". Applied to the job's net (payout - parts) so a correct
  // rescue never loses money. You misdiagnosed and already took the partial.
  callbackJobPayoutMult: 0.4,
  // Tech-caused (rescue) callback rate — GDD §3.1: your idle tech botched it and
  // the client never paid, so rescuing pays NEAR fresh-ticket net. MUST stay < 1.0
  // (and below a fresh fix's net) so farming rescues never beats taking new tickets.
  rescueCallbackPayoutMult: 0.9,
  callbackDueDays: 1, // how many days until a callback job returns (becomes due)
  // Days a callback stays claimable after it comes due before it expires off the
  // board (GDD §3.1). Player-caused obligations expiring cost reputation (below);
  // tech-caused rescues just disappear — they were optional bonus pay, not a debt.
  callbackExpiryDays: 3,
};

/**
 * Diagnosis test costs and the speed bonus (GDD §2.1 decisions of record).
 * The job clock is a SIMULATED clock, never wall-clock: each test adds its
 * `testMinutes` to the active job's minutesSpent, so a phone interruption never
 * costs anything and every run is deterministic. The correct-fresh-fix bonus
 * decays with those minutes and requires at least minTestsForBonus tests —
 * a zero-test blind commit forfeits it (2026-07-04), so the sharp play is a few
 * targeted tests, not a guess. Exhausting every test forfeits the bonus but
 * never drops below base payout. Being thorough is safe, being sharp pays.
 */
export const DIAGNOSIS = {
  // Fictional minutes each test costs. Cheap/vague tests are quick; the slow,
  // very-informative ones (pull the beater) cost the most (GDD §2.1).
  testMinutes: {
    'error-log': 2,
    'temp-probe': 5,
    'inspect-beater': 15,
    'continuity-test': 8,
  },
  // Speed bonus in whole dollars: speedBonusMax on a blind commit (0 minutes),
  // decaying bonusDecayPerMin each simulated minute, floored at 0. $40 is ~30% of
  // a tier-1 payout (80–150). Reaches $0 at 20 minutes: running all four tests
  // (30 min) forfeits it entirely, a targeted couple keeps most of it.
  speedBonusMax: 40,
  bonusDecayPerMin: 2,
  // The bonus is only earned when at least this many tests were run before
  // committing (2026-07-04: blind-commit dominance removed, GDD §2.1). A
  // zero-test commit forfeits the bonus entirely — sharp play means reading
  // evidence fast, not skipping evidence.
  minTestsForBonus: 1,
};

/** Reputation deltas (GDD §3.3: earned per clean job, lost on callbacks). */
export const REPUTATION = {
  correctFix: 1,
  callbackPenalty: 2,
  // Missing the same callback again costs less than the first miss — dampened,
  // not free, so a repeat-miss spiral can't drain reputation forever.
  repeatCallbackPenalty: 1,
  // Letting a player-caused obligation expire off the board (GDD §3.1) costs more
  // than a single miss — abandoning a client you owe is worse than getting it
  // wrong twice. Tech-caused rescues expire with no penalty (they weren't a debt).
  expiredCallbackRepPenalty: 3,
  // Reputation needed to unlock each tier (key = tier). Rep is +1 per clean job
  // and a focused job runs ~60–75s, so 10 rep ≈ 10–12.5 minutes — inside GDD §6's
  // "Tier 2 within 15 minutes", with slack for a couple of -2 misses.
  tierThresholds: {
    2: 10,
    3: 25,
  },
};

/** Hired techs (GDD §3.1). Hard rule: active play must always beat these per minute. */
export const TECHS = {
  firstHireCost: 2000,
  dailyWage: 300,       // tracked in balance.js for v1.x; not yet deducted at runtime
  earningsPerJob: 50,   // legacy fallback; per-route values in routeEarningsPerJob
  baseSuccessRate: 0.75,
  // Success rate by tech skill level (2026-07-04 purchase ladder). Skill 2 is
  // bought via trainingCost below. Even both techs at skill 2 on the best
  // routes must stay below active $/min — pinned by an economy test.
  successRateBySkill: { 1: 0.75, 2: 0.9 },
  trainingCost: 4000,
  maxSkill: 2,
  // What a tech earns per successful idle job, by the route's client tier.
  // Kept well under ~60% of the tier's average fresh-ticket net (GDD §3.1).
  routeEarningsPerJob: { 2: 50, 3: 70 },
  jobsPerHour: 2,       // idle jobs completed per tech per hour on a route
  maxTechs: 2,          // GDD §9 v1.0 cap
};

/**
 * Contract routes (GDD §3.1). Burgertown is included with the first hire;
 * later routes are purchase-ladder items. `tier` drives both the fault pool a
 * tech draws from and their per-job earnings (TECHS.routeEarningsPerJob).
 */
export const ROUTES = {
  'burgertown-south': {
    name: 'Burgertown South Side',
    clientId: 'burgertown-high-st',
    tier: 2,
    cost: 0, // included with the first tech hire
    tierRequired: 2,
  },
  'froyo-strip': {
    name: 'Froyo Strip — Yo-Go cluster',
    clientId: 'yo-go-froyo',
    tier: 3,
    cost: 6000,
    tierRequired: 3,
  },
};

/** Tool upgrade costs. Tools unlock test types, they don't just inflate numbers. */
export const TOOLS = {
  multimeterTier2Cost: 1500,
  // Tier 3 deepens diagnosis (GDD §3.3): the meter definitively rules out one
  // wrong fix option on every non-MotD job (MotD stays tool-fair, GDD §5).
  multimeterTier3Cost: 12000,
  thermalCameraCost: 8000,
};

/** Van slot upgrades (2026-07-04 purchase ladder). Bought in order. */
export const VAN = {
  slotUpgrades: [
    { slots: 6, cost: 2500 },
    { slots: 8, cost: 9000 },
  ],
};

/** Offline progress caps in hours (GDD §3.2). Simulated on load, never ticked. */
export const OFFLINE = {
  baseCapHours: 8,
  answeringServiceCapHours: 24, // "Answering Service" upgrade
};

/** Prestige ("Sell the Business", GDD §3.4: unlocks after the first ~2–4 hours). */
export const PRESTIGE = {
  // Session-22 playtest: focused active play earns ~$105–120/job Tier 1 and
  // ~$140–160/job Tier 2 at ~45–75s a job → roughly $7–10k/hour. $30k lands the
  // first sale at ~3–4 focused hours; the old $250k would have taken 25+ hours.
  lifetimeEarningsThreshold: 30000,
  // Founder Bonus gained per reputation point held at the moment of sale.
  bonusPerRep: 0.01,
};

/**
 * Workshop refurb flips (GDD §3.3: an active-play money converter, never the
 * best earner). Rule-5 invariant: each margin (sell − buy) sits below the same
 * tier's average fresh-ticket net (T1 ≈ $110, T2 ≈ $135, T3 ≈ $210 measured),
 * and sales are deliberately NOT scaled by founderBonus — fresh tickets are,
 * so active ticket play pulls further ahead with every prestige.
 */
export const WORKSHOP = {
  machines: {
    'slushie-machine': {
      name: 'Polar Twister Twin-Bowl Slushie',
      buyPrice: 100,
      sellPrice: 160,
      tierRequired: 1,
    },
    'soft-serve-commercial': {
      name: 'FrostKing 4500 Soft Serve',
      buyPrice: 250,
      sellPrice: 340,
      tierRequired: 2,
    },
    'froyo-multihead': {
      name: 'YogurtMaster 3000 Multihead Froyo',
      buyPrice: 500,
      sellPrice: 650,
      tierRequired: 3,
    },
  },
};

// Van restocking is free at launch — parts are billed per job via fault.partsCost,
// so a restock charge would bill the same part twice. Slot count is STARTING.vanSlots;
// the GDD §2.3 supplier-run / express-markup cost is a v1.x knob to add here.

/** Machine of the Day. Day 1 = the launch date; used only for the share-card day number. */
export const MOTD = {
  epochDate: '2026-06-12', // Day 1 — change only on a fresh deploy, never mid-run
};
