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
  // GDD §2.1 says "partial payout" with no number; this knob is ours to tune.
  wrongFixPayoutMult: 0.4,
  // The returned job's rate when fixed correctly — this is GDD §6's "Callback pays 40%".
  callbackJobPayoutMult: 0.4,
  callbackDueDays: 1, // how many days until a callback job returns
};

/** Reputation deltas (GDD §3.3: earned per clean job, lost on callbacks). */
export const REPUTATION = {
  correctFix: 1,
  callbackPenalty: 2,
  // Missing the same callback again costs less than the first miss — dampened,
  // not free, so a repeat-miss spiral can't drain reputation forever.
  repeatCallbackPenalty: 1,
  // Reputation needed to unlock each tier (key = tier). Rep is +1 per clean job
  // and a focused job runs ~60–75s, so 10 rep ≈ 10–12.5 minutes — inside GDD §6's
  // "Tier 2 within 15 minutes", with slack for a couple of -2 misses.
  tierThresholds: {
    2: 10,
  },
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

/** Van stock and parts restocking. */
export const VAN = {
  // Cost per slot when restocking the van. Filling 4 empty slots = $80 — easily
  // covered by one job, but worth managing so running dry has a real cost.
  partUnitCost: 20,
};

/** Machine of the Day. Day 1 = the launch date; used only for the share-card day number. */
export const MOTD = {
  epochDate: '2026-06-12', // Day 1 — change only on a fresh deploy, never mid-run
};
