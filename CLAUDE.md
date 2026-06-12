# CLAUDE.md — Cold Call

Instructions for Claude Code working in this repo. Read GDD.md first for game design intent. When design and code conflict, GDD.md wins; flag the conflict rather than silently choosing.

## What this is
A free, open-source (MIT) browser game: repair-tycoon × incremental hybrid about fixing commercial ice cream machines. PWA on GitHub Pages. Solo dev (Tom), vibe-coded; optimise for code he can read and modify, not for cleverness.

## Stack — hard constraints
- **Vanilla JS (ES modules), HTML, CSS. No framework, no bundler, no build step.** The repo must run by opening index.html via any static server and deploy to GitHub Pages as-is.
- No npm dependencies at runtime. Dev-only tooling (e.g. a test runner) is acceptable but must never be required to play or deploy.
- DOM-first UI. Do not introduce canvas unless a feature genuinely cannot be done in DOM, and ask first.
- PWA: manifest.json + sw.js (cache-first for app shell, versioned cache name bumped on release).
- Mobile-first layout (~380px) that scales up to desktop. Test both.

## Project structure
```
/index.html
/css/            # plain CSS, custom properties for theming
/js/
  main.js        # boot, screen routing
  state.js       # single game-state object + save/load/migrations
  economy.js     # all earning/spending math
  diagnosis.js   # fault-tree minigame engine
  idle.js        # techs, routes, offline progress simulation
  ui/            # one module per screen, render-from-state
/config/
  balance.js     # EVERY tunable number lives here. No magic numbers in logic.
/data/
  faults/*.json  # fault library — data, not code
  machines.json
  clients.json
/assets/         # sprites, audio
```

## Non-negotiable engineering rules
1. **Saves are sacred.** Game state is one serialisable object. Every save includes `schemaVersion`. Any change to state shape ships with a migration function in state.js and a test that migrates a fixture of the previous version. Never wipe a player's save.
2. **Offline progress is computed, not ticked.** On load, simulate elapsed time deterministically from `lastSeen` timestamp. Cap per balance.js. No setInterval accumulation for idle earnings.
3. **All balance numbers in config/balance.js.** If you find yourself typing a payout, cost, rate, or cap inside game logic, stop and move it.
4. **Faults are data.** New faults = new JSON entries conforming to the documented schema, validated on load with a clear console error naming the bad file/field. Schema lives in data/faults/SCHEMA.md.
5. **Active > idle, always.** Any change to economy.js or balance.js must keep active play the best $/min. If a change risks violating this, say so explicitly.
6. **Deterministic where it matters.** Machine of the Day uses a seeded RNG (seed = UTC date string). Keep one small seedable PRNG in js/ and use it for anything that must reproduce.
7. **No dark patterns.** No energy systems, ads, tracking, accounts, or external network calls at runtime. localStorage only. Save export/import as a text blob is the device-transfer story.

## Code style
- Small modules, plain functions, JSDoc on exported functions. No classes unless genuinely stateful and long-lived.
- Render-from-state: UI modules take state and re-render; avoid scattering state mutations through DOM handlers. Mutations go through functions in state.js/economy.js.
- Prefer boring code. Tom maintains this solo — if a junior dev couldn't follow it, simplify.
- Comments explain *why*, not *what*. Real-world equipment authenticity notes in fault data are welcome (they're part of the game's charm).

## Testing
- Lightweight: a /tests folder of plain JS assertion files runnable with `node tests/run.js`. Priority coverage: save migrations, offline-progress maths, diagnosis fault-tree resolution, economy invariants (rule 5).
- Before declaring a feature done: run tests, then state what was manually checked on mobile-width viewport.

## Working agreements for Claude Code sessions
- Start each session by reading GDD.md §relevant + this file. Summarise the plan before writing code on any multi-file change.
- One feature per session/branch where practical. Keep commits small with imperative messages ("Add callback penalty to invoice flow").
- Update GDD.md when a design decision changes during implementation, and note it in the commit.
- **Model guidance (for Tom):** architecture, state/save design, offline-progress maths, diagnosis engine, economy changes → strongest model. Screen building, wiring, CSS, flavour text, fault JSON authoring → mid/cheap model is fine.

## Definition of done (v1.0 — see GDD §9)
Active loop + diagnosis with 40+ faults across Tiers 1–2, parts/van stock, tools to Tier 2, 2 techs + 1 route + offline progress, Machine of the Day with shareable result, installable PWA, save migrations in place.
