# Session handover

Working pattern: each session ends by updating this file with a prompt the next
session (possibly on another machine) can start from cold. Paste the prompt below
into Claude Code after cloning/pulling. Machine-specific details (like where Node
lives) belong in each machine's own Claude memory, not here.

---

## Next session prompt (session 8)

Model: Claude Sonnet is fine — both remaining tasks (PWA wiring and save
export/import UI) are screen-building and config work. The economy/save-integrity
fixes from the Codex review were done in session 7 on the strongest model.

Read GDD.md and CLAUDE.md fully before doing anything. Sessions 1–7 are done and
committed (not pushed). State is at schema v4. Here's what's in:

- state/saves with migrations to schema v4; strict validation: future-version
  saves rejected, structural validation after every migrate (validateState in
  state.js, throws naming the bad field)
- corrupt-save protection: main.js builds its save fn via makePersist(error) —
  when load() failed, NO save this session writes, the corrupt blob is preserved
- seedable PRNG (mulberry32 in js/rng.js, accepts string seeds)
- all tunables in config/balance.js (JOBS, REPUTATION, TOOLS, STARTING, TECHS, OFFLINE)
- fault loader + validator (new faults go in data/faults/index.json)
- diagnosis engine, playable ticket → diagnose → fix → invoice loop
- 40 faults across Tiers 1–2 (GDD §9 launch target met)
- tools shop (Multimeter Tier 2 unlocks continuity test)
- economy model of record (GDD §6, decided session 7): partsCost is charged once
  at settlement; van restock is FREE (stock = availability, not a second bill);
  correct callback fix pays callbackJobPayoutMult × net (payout − parts), so it
  can never go negative — there's an all-faults profitability invariant test
- Machine of the Day: rendezvous-hash daily draw (adding faults only remaps
  dates the new fault wins), results pin their faultId, streak, share card
- Parts/van stock, techs + routes + offline progress (8h cap, deterministic)

Tests: `node tests/run.js` — 114 passing.

This is session 8. Two v1.0 items remain (GDD §9):

1. PWA — manifest.json + sw.js. Cache-first for app shell (index.html, css/, js/,
   config/), pre-cache data/faults/*.json (~40 files + index.json), machines.json,
   clients.json. Versioned cache name, bumped on release. Must be installable on
   Android Chrome and iOS Safari. No runtime network calls exist, so cache-first
   over the whole repo is fine.
2. Save export/import UI — state.js has exportSave()/importSave() (importSave
   validates and throws with a player-readable message — surface it in the UI).
   Small settings panel or shop addition: "Export save" (clipboard, with prompt()
   fallback like shareMotd), "Import save" textarea + button. Bonus: when boot
   detects a corrupt save (main.js `error` is set), offer the raw localStorage
   blob for copy before any reset — that's the recovery story the persist gate
   left open.

Suggested order: PWA first, then export/import.

Rules that bind everything: mutations only via state.js/economy.js; every number in
config/balance.js; saves are sacred (migrations for any state shape change); no
network calls at runtime; active play must always beat idle $/min.

When done: run tests, verify installable at ~380px mobile width, update this file
for session 9, commit in small logical commits, don't push until Tom says so.

---

## Open design questions for Tom (from the Codex review, not blockers for v1.0 build)

- Diagnosis tests have no time/cost trade-off yet (review #4, GDD §2.1 says tests
  cost job time). Needs a design call on how time pressure should feel on mobile —
  its own session, before launch.
- Due callbacks are auto-claimed by "Next ticket" (review #7). GDD §3.1 frames
  callbacks as optional rescues. Decide: mandatory queue or player choice.

## v1.0 scope still open after session 7

- PWA: manifest.json + sw.js, installable
- Save export/import UI (functions exist in state.js, no screen yet)
