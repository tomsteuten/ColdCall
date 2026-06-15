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
 * starts full on a blind commit and decays with those minutes — committing blind
 * keeps the full bonus but risks the callback; exhausting every test forfeits the
 * bonus but never drops below base payout. Being thorough is safe, being sharp pays.
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
  earningsPerJob: 50,
  baseSuccessRate: 0.75,
  jobsPerHour: 2,       // idle jobs completed per tech per hour on a route
  maxTechs: 2,          // GDD §9 v1.0 cap
};

/** Tool upgrade costs. Tools unlock test types, they don't just inflate numbers. */
export const TOOLS = {
  multimeterTier2Cost: 1500,
  thermalCameraCost: 8000,
};

/** Offline progress caps in hours (GDD §3.2). Simulated on load, never ticked. */
export const OFFLINE = {
  baseCapHours: 8,
  answeringServiceCapHours: 24, // "Answering Service" upgrade
};

/** Prestige ("Sell the Business", GDD §3.4). */
export const PRESTIGE = {
  lifetimeEarningsThreshold: 250000,
  // Founder Bonus gained per point of reputation held at sell time, added to the
  // permanent multiplier. 0.01 = +1% per rep (100 rep → +1.0, i.e. a doubling).
  bonusPerReputation: 0.01,
};

/**
 * Refurbishing workshop (GDD §3.3). Buy a damaged machine, diagnose+repair it
 * via the normal minigame, then sell the refurb. `tierRequired` gates which
 * machines you can buy to your unlocked client tier. Profit is the buy→sell
 * spread; the sell price is multiplied by the Founder Bonus like active work.
 * NOTE (balance debt): tier-2 spread (250) edges past a fresh tier-2 ticket's
 * best net — see the next playtest pass before treating these as final.
 */
export const WORKSHOP = {
  'slushie-machine': { buyPrice: 100, sellPrice: 200, tierRequired: 1 },
  'soft-serve-commercial': { buyPrice: 250, sellPrice: 500, tierRequired: 2 },
  'froyo-multihead': { buyPrice: 500, sellPrice: 1000, tierRequired: 3 },
};

// Van restocking is free at launch — parts are billed per job via fault.partsCost,
// so a restock charge would bill the same part twice. Slot count is STARTING.vanSlots;
// the GDD §2.3 supplier-run / express-markup cost is a v1.x knob to add here.

/** Machine of the Day. Day 1 = the launch date; used only for the share-card day number. */
export const MOTD = {
  epochDate: '2026-06-12', // Day 1 — change only on a fresh deploy, never mid-run
};
