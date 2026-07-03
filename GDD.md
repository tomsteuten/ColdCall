# COLD CALL — Game Design Document

**Working title:** Cold Call (alternates: Soft Served, Frozen Assets, Machine Down)
**Genre:** Repair tycoon × incremental/idle hybrid
**Platform:** Browser (PWA, installable on mobile), GitHub Pages
**Price:** Free, open source (MIT)
**One-sentence pitch:** You're the field tech who fixes the burger chain's eternally broken ice cream machines — diagnose faults by hand for big money, then build a service empire that grinds jobs while you sleep.

---

## 1. Design Pillars

1. **Diagnosis is the game.** The active minigame must always be the most profitable and most interesting thing you can do. Idle income is the convenience layer, never the star.
2. **Real faults, funny framing.** Fault scenarios are grounded in how this equipment actually fails (scale, sensors, seals, the infamous overnight heat-treat cycle). Comedy comes from the world, not from fake slapstick failures.
3. **Specific beats generic.** Soft serve machines are the icon and the recurring villain. Variety comes from the cold-side ladder, not from "repair anything."
4. **Respect the player's time.** No energy systems, no ads, no dark patterns. Offline progress is generous. Sessions of 2 minutes or 2 hours both feel rewarding.

---

## 2. Core Loop (60–90 second active job)

```
Ticket arrives → Accept job → DIAGNOSE → Repair → Invoice → Spend
     ↑                                                        |
     └──────────── reputation unlocks bigger clients ─────────┘
```

> **Decision of record (2026-07-04) — loop and home tightening.** The loop was
> leaking taps: the invoice now chains straight into the **Next ticket**
> (primary button; Home is secondary), the status bar shows rep progress to
> the next tier ("Rep 18 · 7 to Tier 3"), and the receipt lists the rep change
> and the clean streak when it grew. The home screen is ordered
> status → notices/offline report → Next ticket → Callbacks/MotD → one-line
> prestige banner (expands on tap) → one-line workshop summary (expands) →
> Codex → shop/settings, with the brand block shrunk once `jobsCompleted > 0`.
> The offline report's per-tech lines reconcile arithmetically with its total
> ("Dave: 8 fixed · 4 missed · $400"). Not-yet-due callbacks collapse to one
> line each. On desktop, non-job screens hold a centered ~480px column. Emoji
> were removed from UI chrome in favour of design-system badges/dots — emoji
> live on only in flavour text and the share card.

### 2.1 The Diagnosis Minigame (the make-or-break mechanic)

A deduction puzzle. Each machine has a hidden fault drawn from its fault tree. The player sees **symptoms**, runs **tests**, and commits to a **fix**.

**Flow:**
1. **Symptoms shown free** — e.g. *"Mix icy at barrel. Hopper temp reads high. Compressor running constantly."*
2. **Run tests** — each test costs job time (and sometimes a consumable). Tests reveal clues that eliminate branches of the fault tree:
   - Check error log (cheap, vague)
   - Temp probe readings (medium)
   - Pull and inspect beater assembly (slow, very informative)
   - Megger/continuity test on motor (requires Multimeter Tier 2)
3. **Commit to a fix** — pick the part/procedure. Correct → full payout + speed bonus. Wrong → "callback" penalty: partial payout, reputation hit, and the job returns tomorrow at reduced rate.

**Why it works:** It's Wordle-shaped — narrow a hidden answer with limited probes. Skilled players learn real-ish fault patterns and get faster, which makes mastery feel earned rather than stat-gated.

**Decisions of record (v1.0):**
- Job time is a **simulated clock**, never wall-clock. Each test has a time cost in fictional minutes (in `config/balance.js`); the clock only advances when the player acts, so a phone interruption never punishes, and every run is deterministic and testable.
- Payout = **base payout + speed bonus**. The bonus decays with simulated minutes spent on tests, and **requires at least one test run** (2026-07-04, superseding "committing blind keeps the full bonus": playtesting showed experienced players memorised symptom→fix pairs and blind-committed for the maximum bonus, which hollowed out the deduction). Running every test forfeits the bonus but never drops below base payout — being thorough is safe, being sharp is rewarded, guessing is neither.
- **Symptom variants** (2026-07-04): a fault may carry 2–3 alternative symptom sets (`symptomVariants` in the fault JSON — same underlying fault, different discriminating evidence, optional per-test result overrides). One presentation is drawn per job with the seeded job PRNG, so the same fault stops being a memorisable flash card after hour two. The MotD seed keeps the daily puzzle identical for every player (rule 6), and a callback replays the variant its original job presented. The 15 most-common Tier 1–2 faults ship with 2 variants each; new faults should get variants whenever their symptoms are distinctive enough to memorise.
- Economy invariant: informed diagnosis (a few targeted tests, correct fix) must beat both blind guessing and exhaustive testing in expected $/min.

**Difficulty levers:** number of plausible faults per machine, ambiguous/overlapping symptoms, intermittent faults (symptom only appears on a re-test), red herrings ("operator error — the staff just didn't run the cleaning cycle," a free fix and a joke that doubles as the meme payoff).

### 2.2 Fault Library (launch content)

Faults are data, not code — JSON entries with: id, machine type, symptoms, test results table, correct fix, plausible wrong fixes, payout, flavour text.

Launch target: **40–60 faults** across the Tier 1–2 machines. Authenticity examples to seed:

| Fault | Symptoms | The trap |
|---|---|---|
| Failed overnight heat-treat cycle | "Machine locked out, cryptic error at open" | The meme made mechanical — it's often just a re-run, but sometimes a real sensor fault |
| Hopper thermistor drift | Temp reads high, product fine | Looks like refrigeration failure; replacing the compressor is the expensive wrong answer |
| Worn scraper blades | Icy/soft product, motor amps high | Cheap fix everyone overlooks |
| Scale-blocked mix line | Low mix alarm with full hopper | Coffee-tech crossover joke |
| Door O-ring gone | Leaking from dispense door | Trivially cheap; greedy players run tests they don't need |
| Beater motor capacitor | Hums, won't start | Classic — test before you swap the motor |
| Staff didn't prime it | "It's broken again" | Free fix, reputation bonus, comedy |

### 2.3 Repair & Parts

After correct diagnosis, repair is a quick satisfying interaction (hold-to-tighten, sequence taps — light, not a second minigame). Parts come from **van stock**; out-of-stock means a supplier run (time cost) or paying express markup. Inventory management is deliberately shallow at launch: a van with N slots, restocked between jobs.

---

## 3. Idle Layer (the tycoon empire)

### 3.1 Hired Techs
- Hire techs and assign them to **contract routes** (a client cluster, e.g. "Burgertown South Side — 6 stores").
- Each tech has a skill level → success rate and jobs/hour. Failed idle jobs become callbacks the *player* can rescue for bonus pay (feeds idle back into active play).
- Techs earn ~40–60% of what active play earns per job. **Hard rule: active play is always the best $/min.**

**Decision of record (v1.0) — callbacks are a choice, and there are two kinds:**
- **Tech-caused (rescue):** your idle tech botched it and the client never paid — rescuing pays near fresh-ticket net (`rescueCallbackPayoutMult`, always < 1.0 so farming rescues never beats taking new tickets). This is the §3.1 "bonus pay" loop feeding idle back into active. Left unclaimed past its expiry it falls off the board too, but with **no reputation penalty** — it was optional bonus pay, never a debt you owed.
- **Player-caused (obligation, from §2.1):** you misdiagnosed and already took the partial — the return visit pays the 40%-of-net callback rate. Left unclaimed past its expiry (`callbackExpiryDays`) it's gone *with* a reputation hit (`expiredCallbackRepPenalty`) — you abandoned a client you owed.
- Both kinds carry an `expiryDay` and are claimed from their own "Callbacks (n)" entry on the home screen, which shows each one's rate and source. "Next ticket" never auto-claims one.

### 3.2 Offline Progress
- Simulated on load from elapsed time (no background timers). Capped at 8h base, upgradeable to 24h ("Answering Service" upgrade).
- Welcome-back screen shows a tabloid-style report: jobs done, cash earned, "Tech Dave got stuck behind a delivery truck for 2 hours."

### 3.3 Upgrade Tracks
1. **Tools** — unlock new test types (better multimeter, thermal camera, laptop with service software). Tools deepen diagnosis, not just numbers.
2. **Van** — stock slots, travel speed (more jobs/day), eventually a second van.
3. **Workshop** — refurbish ruined machines bought cheap, sell refurbed (idle money sink/converter).
   - **Decision of record (v1.0, as implemented; margins playtested session 22):** the workshop is an *active* converter, not an idle one. You buy a damaged machine (`config/balance.js` `WORKSHOP`, gated by `tierRequired` to your unlocked client tier), diagnose+repair it through the **normal diagnosis minigame**, then sell the refurb for the flat `sellPrice` — deliberately **not** multiplied by founderBonus, so fresh tickets (which are) pull further ahead with every prestige. The repair job itself pays $0 and no reputation — the profit is the buy→sell spread, tuned below each tier's average fresh-ticket net ($60/$90/$150; the session-15 "flagged" spreads had the tier-2/3 flips beating fresh tickets and were cut). No rep, no callback risk: a sink/converter that never competes with tickets or reputation progression (§3.1 rule, pinned by an economy test). The panel is hidden until Tier 2.
4. **Techs** — hire, train (raises success rate), specialise (soft serve / coffee / ovens).
5. **Reputation** — earned per clean job, lost on callbacks. Gates client tiers and contract offers.

> **Decision of record (2026-07-04) — the purchase ladder.** Playtesting showed
> the wanting engine died after the second tech (~$2k): nothing left to save
> for until prestige at $30k. The shop is now a single **purchase ladder**
> (`purchaseLadder()` in economy.js, every cost in `config/balance.js`) shown
> in full — locked rungs display their unlock conditions, so the next goal is
> always visible at roughly 2–5× the current wallet: Multimeter T2 $1.5k →
> tech hires $2k → van 6 slots $2.5k → tech training $4k each (skill 2 = 90%
> idle success, `TECHS.successRateBySkill`; rule 5 re-proved by test with both
> techs trained on the best route) → **Froyo Strip contract route** $6k at
> Tier 3 (`ROUTES` — techs there draw tier-3 faults and earn $70/job; hires
> auto-spread to the least-covered route) → van 8 slots $9k → **Multimeter
> Tier 3** $12k (definitively rules out one wrong fix option on every job —
> a diagnosis deepener per §3.3's tools rule; disabled on MotD so the shared
> puzzle stays tool-fair, and seeded per job so a refresh never re-rolls it).
> This promotes a second contract route from v1.x into the live build; tech
> specialisation remains v1.x.

### 3.4 Prestige: "Sell the Business"
- Sell the company, keep a **Founder Bonus** (permanent multiplier from lifetime reputation), restart in a new region with a new client mix and remixed fault frequencies.
- Unlocks at first ~2–4 hours of play. Classic incremental hook: each run is faster and pushes one tier deeper.
- **Decision of record (v1.0, as implemented; threshold playtested session 22):** prestige unlocks at `PRESTIGE.lifetimeEarningsThreshold` (**$30k** — measured active pace is ~$7–10k/hour, landing the first sale at the 2–4h target above; the original $250k guess was 25+ hours). Selling adds `reputation × PRESTIGE.bonusPerRep` (0.01 = +1% per rep held at sell time) to the permanent `founderBonus`, which accumulates across prestiges and resets everything else (cash, rep, tier, tools, van, techs, routes, jobs, workshop, offline carry). The Founder Bonus multiplies **active** earnings *and* reputation gain — so each post-prestige run reaches the next tier faster — but is applied neither to idle tech income (`idle.js`) nor to workshop sales, so the active>idle rule (§3.1) is preserved. (The bonus derives from *current* reputation at sell time, not a separate lifetime-reputation total; because it accumulates each prestige the effect matches the "from lifetime reputation" intent.)

---

## 4. Progression Ladder (machine tiers)

| Tier | Machines | Clients | Notes |
|---|---|---|---|
| 1 | Home soft serve units, slushie machines | Corner shops, school fetes | Tutorial tier, 2–3 step fault trees |
| 2 | **Commercial soft serve** (the star), shake machines | **Burgertown** franchise | The meme tier — Burgertown calls *constantly* |
| 3 | Frozen yoghurt multiheads, granita, ice machines | Froyo chains, pubs, servos | Intermittent faults introduced |
| 4 | Espresso machines, grinders | Café chains | Coffee crossover tier, scale faults everywhere |
| 5 | Blast chillers, walk-in freezers, combi ovens | Supermarkets, commercial kitchens | "The Cursed Combi" endgame boss machine |

**Burgertown** (fictional parody chain — no real branding anywhere in art or text) is the narrative spine: their machines break weekly, their store managers have recurring personalities, and an over-arching joke-mystery ("why do they *always* break?") pays off in late game when you discover the heat-treat lockout design and can finally sell them the fix.

---

## 5. Viral / Retention Hooks

- **Machine of the Day:** one daily seeded diagnosis puzzle, same for all players, scored on tests used first, then simulated diagnostic minutes (never wall-clock time — interruptions must not worsen a shared result; see session 20). Shareable emoji-grid result (Wordle pattern). This is the single cheapest growth mechanic available — prioritise it for launch.
- **Callback shame / clean-streak stats** on the share card.
- **Pun-heavy job flavour text** — screenshot bait.
- **The Fault Codex** (decision of record 2026-07-04): the long-horizon goal the
  game lacked. A home-screen collection listing every fault in the library;
  an entry fills in the first time the player diagnoses that fault correctly
  (fresh ticket, callback, workshop or MotD — the deduction counts wherever it
  happens) and shows the fault name, machine, the lesson text, and times fixed.
  Header reads "23/47 faults mastered". One-time cash bonuses at 25/50/75/100%
  completion (`CODEX.milestones` in balance.js — one-time by definition, so
  rule 5 is untouched). Only per-fault fix counts are persisted
  (`state.codex.fixes`, schema v14); names/lessons are derived from the library
  at render, retired fault ids neither count toward mastery nor claw back paid
  milestones, and the codex **survives prestige** — it's the player's knowledge,
  not the business's assets.

---

## 6. Economy (starting numbers — all live in `config/balance.js`)

- Start: $500, basic multimeter, 4 van slots, Tier 1 clients only.
- Tier 1 job payout: $80–150 (correct first time), minus parts cost ($10–40). Callback pays 40% — implemented as the *returned callback job* paying 40% of the job's **net** (payout minus parts) when fixed correctly, so a correct rescue can never lose money however expensive the part. The instant partial payout on the wrong fix itself is a separate tunable (also 40% of gross payout at launch). Missing the same callback again pays $0 and re-queues it with a dampened reputation penalty.
- Parts model: `partsCost` is the price of the fitted part, charged once at settlement. Van stock is availability only — restocking at launch is free (a supplier run between jobs); the §2.3 express markup / time cost is a v1.x lever. Stock must never be a second bill for the same part.
- First tech hire: $2,000 one-off; earns ~$50/job at 75% success. **No running wage at launch (v1.0):** the idle layer is deliberately generous and active play is always the better $/min (§3.1), so techs cost only their hire price — a recurring wage adds debt / insufficient-cash edge cases not worth it pre-launch. `balance.js` keeps a `dailyWage` knob (unused at runtime) reserved for a v1.x cost sink.
- Tool Tier 2 (proper multimeter): $1,500. Thermal camera: $8,000.
- Prestige available around lifetime earnings of **$30k** (session 22: playtest measured active pace at ~$7–10k/hour, so the original $250k guess meant 25+ hours; $30k lands the first sale at §3.4's 2–4 hour target).
- Workshop flips (v1.x feature, shipped early): margins sit below the same tier's average fresh-ticket net ($60/$90/$150 for T1/T2/T3), sales are *not* founderBonus-scaled, and the panel is hidden until Tier 2 — a money converter, never the best $/min (§3.1 rule).
- Tuning rule: a focused player should hit Tier 2 (Burgertown unlock) inside the **first 15 minutes** — the meme is the hook, don't gate it deep.

All numbers are first guesses; balance via config, never hard-coded.

---

## 7. Art & Audio Direction

- **Rendered raster machines by default, animated SVG as the alternate mode.** (Session 22 decision, superseding the SVG-first plan below.) All five machines have generated 640×640 webp renders for every state (fault/open/working — pipeline documented in `assets/generated/PROMPTS.md`); new games start on `'rendered'`, and the Settings toggle switches to the blocky animated SVGs. Both modes share the CSS machine-state motion (jolt on fault, glow on working).
- **Blocky inline SVG illustrations with a limited palette** remain the fully-supported vector mode: crisp at every size, state variants without asset files, editable in the dependency-free codebase. Characters use simple illustrated portraits in ticket dialogs — cheap to produce, big personality return.
- UI is clean DOM/CSS, not pixel-rendered — readable on mobile, fast to build.
- Audio: light, shipped in session 22 as generated WebAudio (button blip, correct-fix jingle, wrong-fix thunk — no assets, gated on the Settings toggle). A chiptune loop remains a someday item.

---

## 8. Technical Summary (details in CLAUDE.md)

- Vanilla JS, DOM-first UI with inline SVG illustrations (canvas only if a feature genuinely needs it later)
- PWA: manifest + service worker, installable, fully offline
- Saves: versioned JSON in localStorage with migration functions
- Hosted on GitHub Pages, zero build step preferred (ES modules)

---

## 9. Scope: Launch (v1.0) vs Later

**v1.0 (the smallest game that's actually fun):**
- Active loop with diagnosis minigame, Tiers 1–3, 40+ faults
- Van stock + parts, tools track to Tier 2
- 2 hireable techs, one contract route, offline progress
- Machine of the Day with shareable result
- Prestige ("Sell the Business", §3.4) and the refurbishing workshop (§3.3)
- PWA install + save migration scaffolding

> **Scope note (2026-06-15):** Tier 3, prestige, and the workshop were originally
> listed under v1.x but shipped into the main build during the post-session-20
> recovery and have been promoted into v1.0 (Tom's call). Tier 3 now unlocks in
> normal play at `REPUTATION.tierThresholds[3]` (25 rep). The remaining v1.x items
> are below.

**v1.x:** Tier 4, tech specialisation, tech wages (deferred in session 13)
**v2 dreams:** Tier 5 + Cursed Combi storyline, regional prestige maps, community-contributed fault packs (it's open source — the fault library as JSON makes player-authored content trivially possible)

**Cut list (explicitly not doing):** multiplayer, real-money anything, energy systems, ad SDKs, account systems. Saves are local; an export-save-as-text button covers device transfer.

---

## 10. Success Criteria

- A first-time player understands the loop and laughs at least once within 3 minutes.
- Day-2 return driven by Machine of the Day, not guilt mechanics.
- The diagnosis minigame is fun *with all numbers set to 1* — if it only works because of upgrade dopamine, redesign it.
