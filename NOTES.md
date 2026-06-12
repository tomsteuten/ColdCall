# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 7)

Read GDD.md and CLAUDE.md fully before doing anything. Sessions 1–6 are done and
committed (not pushed). State is at schema v3. Here's what's in:

- state/saves with migrations to schema v3
- seedable PRNG (mulberry32 in js/rng.js, accepts string seeds)
- all tunables in config/balance.js (JOBS, REPUTATION, TOOLS, VAN, STARTING, TECHS, OFFLINE)
- fault loader + validator (new faults go in data/faults/index.json)
- diagnosis engine, playable ticket → diagnose → fix → invoice loop
- 40 faults across Tiers 1–2 (GDD §9 launch target met)
- tools shop (Multimeter Tier 2 unlocks continuity test)
- callbacks at GDD §6 40% rate; real tier gating (Tier 2 unlocks at rep 10)
- Machine of the Day: seeded daily fault, once-per-day guard, streak tracking,
  Wordle-style share card, home entry + result screen (js/motd.js, js/ui/motd.js)
- Parts/van stock (GDD §2.3): state.van.stock tracks generic-parts, consumed on
  correct fix (partsCost > 0), van status in header, restock from home and job screens
- Techs + routes + offline progress (GDD §3): hireTech (tier-2 gate, $2000,
  auto-creates burgertown-south route, Dave then Mike), simulateOfflineProgress
  (deterministic mulberry32 seed per tech+lastSeen, 8h cap, callbacks for failures,
  updates cash/lifetimeEarnings/jobsCompleted), offline report banner on home screen

Tests: `node tests/run.js` — 105 passing.

This is session 7. The v1.0 scope still open:
- PWA: manifest.json + sw.js, installable (GDD §9)
- Save export/import UI (functions exist in state.js, no screen yet)

That's the full v1.0 checklist (GDD §9). Pick whichever you think is most impactful
and plan before coding anything multi-file.

Rules that bind everything: mutations only via state.js/economy.js; every number in
config/balance.js; saves are sacred (migrations for any state shape change); no
network calls at runtime; active play must always beat idle $/min.

When done: run tests, verify at ~380px mobile width, update this file for session 8,
commit in small logical commits, don't push until Tom says so.

---

## v1.0 scope still open after session 7

- PWA: manifest.json + sw.js, installable
- Save export/import UI (functions exist in state.js, no screen yet)
