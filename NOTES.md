# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 6)

Read GDD.md and CLAUDE.md fully before doing anything. Sessions 1–5 are done and
pushed: state/saves with migrations to schema v2, seedable PRNG (mulberry32 in
js/rng.js, accepts string seeds), all tunables in config/balance.js, fault loader +
validator (new faults go in data/faults/index.json), diagnosis engine, playable
ticket → diagnose → fix → invoice loop, 14 faults across Tiers 1–2, tools shop
(Multimeter Tier 2 unlocks the continuity test), callbacks at the GDD §6 40% rate,
real tier gating (Tier 2 unlocks at rep 10), and Machine of the Day: seeded daily
fault (mulberry32 on UTC date string), once-per-day guard (state.motd.lastPlayedDate),
streak tracking (consecutive solves +1; skip → 1; fail → 0), Wordle-style share card
(navigator.clipboard), home entry point with played/unplayed state, result screen.
New module: js/motd.js. New UI: js/ui/motd.js. MotD reuses state.jobs.active with
motd:true flag; commitFix branches in diagnosis.js; settleMotd in motd.js (no cash,
no rep). Tests: `node tests/run.js` — 86 passing. If Node isn't on PATH, ask Tom
where it lives on this machine and save that to memory.

This is session 6: the fault library needs to grow to 40+ faults (GDD §9 launch
target; currently 14), plus parts/van stock, and 2 techs + 1 route + offline
progress (GDD §3).

Suggested order:
1. Fault library to 40+ (currently 14) — fault JSON authoring. Use the fault schema
   in data/faults/SCHEMA.md and the existing faults as examples. Spread across
   Tiers 1–2; reference the GDD §2.2 authenticity examples. Run `node tests/run.js`
   after each batch — the fault validator runs on every real fault file. Mid/cheap
   model is fine for this work.
2. Parts/van stock (GDD §2.3): van has N slots (STARTING.vanSlots = 4), parts have
   ids and costs, stock tracked in state.van.stock (partId → count), spending on
   repair deducted automatically. Keep shallow — no supplier run minigame yet, just
   track that parts are consumed and show a van stock UI. This touches state.js
   (no migration needed if stock shape stays {}) and economy.js (settleJob already
   deducts fault.partsCost; make it check stock and refuse if out).
3. 2 techs + 1 contract route + offline progress (GDD §3): the TECHS and OFFLINE
   constants are in balance.js; idle.js exists as a stub. This is the largest chunk
   — plan before coding, wait for approval.

Rules that bind everything: mutations only via state.js/economy.js; every number in
config/balance.js; saves are sacred (migrations for any state shape change); no
network calls at runtime; active play must always beat idle $/min.

Before writing code on the techs/idle chunk, summarise your plan and wait for
approval. When done: run tests, tell me exactly what to click, state what was
checked at mobile width (~380px), update this file's prompt for session 7, commit
in small logical commits, don't push until Tom says so.

Model guidance: fault authoring → mid/cheap model fine. Parts stock wiring →
mid model. Idle/tech/offline engine → strongest model (economy invariants, offline
maths, save migration risk).

---

## v1.0 scope still open after session 6

- Fault library to 40+ (currently 14) — fault JSON authoring, cheap-model work
- Parts/van stock (GDD §2.3)
- 2 techs + 1 contract route + offline progress (GDD §3)
- PWA: manifest.json + sw.js, installable
- Save export/import UI (functions exist in state.js, no screen yet)
