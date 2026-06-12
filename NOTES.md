# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 5)

Read GDD.md and CLAUDE.md fully before doing anything. Sessions 1–4 are done and
pushed: state/saves with migrations to schema v2, seedable PRNG (mulberry32 in
js/rng.js, accepts string seeds), all tunables in config/balance.js, fault loader +
validator (new faults go in data/faults/index.json), diagnosis engine, playable
ticket → diagnose → fix → invoice loop, 14 faults across Tiers 1–2, tools shop
(Multimeter Tier 2 unlocks the continuity test), callbacks that come due and return
at the GDD §6 40% rate (claimDueCallback/settleJob in economy.js; repeat misses pay
$0, re-queue, dampened rep penalty), and real tier gating (pickTicket filters to
player.tierUnlocked; Tier 2 unlocks at rep 10 via REPUTATION.tierThresholds).
Tests: `node tests/run.js` — 65 passing. If Node isn't on PATH, ask Tom where it
lives on this machine and save that to memory.

This is session 5: Machine of the Day (GDD §5 — the priority growth mechanic).

Tasks, in order:
1. Daily puzzle: one fault per UTC day, same for all players — seed mulberry32 with
   the UTC date string (the deterministic-where-it-matters rule, CLAUDE.md rule 6).
   Draw from the whole fault library regardless of tierUnlocked (it's a standalone
   puzzle, not a job). Playable once per day: state.motd.lastPlayedDate guards it.
2. Scoring: tests used + time (GDD §5). MotD pays no cash and moves no reputation —
   it must never compete with the core loop economy. Store the result in
   state.motd.lastResult ({ testsUsed, timeMs, solved }) and update streak: +1 when
   solved on consecutive days, reset to 1 (or 0 on a fail) otherwise — decide and
   document the exact rule.
3. Share card: Wordle-style emoji grid as a text blob (e.g. one row per test run,
   ✅/❌ for the fix, day number, streak) copied via navigator.clipboard. No
   external calls, no URLs required beyond a plain link to the game.
4. UI: home screen entry point ("Machine of the Day" with today's state: unplayed /
   played with result), a results view with the share button. Reuse the existing
   job screen rendering where possible — it's the same diagnosis flow.
5. State/migrations: the motd slice already exists in state v2 with the right
   shape, so aim for no migration; if a shape change proves necessary it ships
   with MIGRATIONS[2] and a fixture test per CLAUDE.md rule 1.
6. Tests: same date ⇒ same fault (and different dates usually differ), once-per-day
   guard, streak increment/reset rules across consecutive/skipped days (use
   injectable now/date strings), share-grid text formatting.

Rules that bind everything: mutations only via state.js/economy.js (or the
diagnosis engine); every number in config/balance.js; saves are sacred; no
network calls at runtime. State the active > idle check in your summary (MotD
pays nothing, so it can't violate it — say so explicitly).

Before writing code, summarise your plan — including the exact streak rule, how
the MotD diagnosis run reuses or forks the job flow, and the share-card format —
and wait for my approval. When done: run tests, tell me exactly what to click,
state what was checked at mobile width (~380px), update this file's prompt for
session 6, commit in small logical commits, don't push until I say so.

Model guidance: the seeded draw, streak logic and once-per-day guard are small but
correctness-critical — strongest model is safest; the results/share screens are
mid-model work.

---

## v1.0 scope still open after session 5

- Fault library to 40+ (currently 14) — fault JSON authoring, cheap-model work
- Parts/van stock (GDD §2.3)
- 2 techs + 1 contract route + offline progress (GDD §3)
- PWA: manifest.json + sw.js, installable
- Save export/import UI (functions exist in state.js, no screen yet)
