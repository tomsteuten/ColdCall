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
  // Wrong fix -> callback: partial payout now, job returns tomorrow at reduced rate.
  callbackPayoutMult: 0.4,
  callbackDueDays: 1, // how many days until a callback job returns
};

/** Reputation deltas (GDD §3.3: earned per clean job, lost on callbacks). */
export const REPUTATION = {
  correctFix: 1,
  callbackPenalty: 2,
};

/** Hired techs (GDD §3.1). Hard rule: active play must always beat these per minute. */
export const TECHS = {
  firstHireCost: 2000,
  dailyWage: 300,
  earningsPerJob: 50,
  baseSuccessRate: 0.75,
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

/** Prestige ("Sell the Business", v1.x — threshold tracked from launch). */
export const PRESTIGE = {
  lifetimeEarningsThreshold: 250000,
};
