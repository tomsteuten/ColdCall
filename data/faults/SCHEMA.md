# Fault JSON Schema

Faults are data, not code (GDD §2.2, CLAUDE.md rule 4). One fault per file in
`data/faults/`, filename matching the `id`. Files are validated on load; a bad
file produces a clear console error naming the file and field.

**New faults must also be listed in `data/faults/index.json`** — static hosting
can't list a directory, so that manifest is how the loader finds fault files.

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique kebab-case identifier, matches filename (`worn-scraper-blades.json`). |
| `machineType` | string | yes | Machine type id from `data/machines.json` (e.g. `"soft-serve-commercial"`). |
| `tier` | number | yes | Machine tier 1–5 this fault appears on. |
| `symptoms` | string[] | yes | Shown free when the job starts. 1–4 short player-facing lines. |
| `tests` | object | yes | Map of test id → result string the player sees when running that test on *this* fault. Only list tests that reveal something; unlisted tests show that test's generic "nothing unusual" result. **Results are evidence, not verdicts** — see "Writing test results" below. |
| `correctFix` | string | yes | Fix id that resolves the fault for full payout. |
| `wrongFixes` | string[] | yes | Plausible-but-wrong fix ids offered alongside the correct one (the traps). 1–4 entries, must not contain `correctFix`. |
| `payout` | number | yes | Base payout in $ for a correct first-time fix. Stays within the tier's range in `config/balance.js`. |
| `partsCost` | number | yes | Cost in $ of parts consumed by the correct fix. `0` for procedure-only fixes. |
| `symptomVariants` | object[] | no | 1–3 **alternative presentations** of the same fault (added 2026-07-04 to kill symptom memorisation). Each entry is `{ "symptoms": [...], "tests": {...} }`: `symptoms` follows the same rules as the base field; `tests` is optional and **overrides individual test results** (unlisted tests fall back to the base `tests`, then to the generic result). One presentation is drawn per job with the seeded job PRNG — base symptoms count as presentation 0, so a fault with 2 variants shows each roughly a third of the time. The MotD date seed makes the draw identical for every player (rule 6), and a callback replays the variant its original job presented. Write variants with the same real-equipment authenticity as the base: same underlying fault, different discriminating evidence. |
| `flavour` | string | yes | One-liner shown on the invoice. Pun-heavy, screenshot bait. |
| `lesson` | string | yes | Player-facing diagnostic reasoning shown on a **failure** receipt (GDD §2.1). Name the discriminating clue and why the obvious wrong fix is a trap, in 1–2 sentences. Plain player language — do **not** paste `authenticityNote` verbatim. |
| `authenticityNote` | string | no | Real-world note for contributors — why this fault is genuine. Never shown in game. |

## Test ids (launch set)

Defined by the diagnosis engine; faults may only reference these. Labels and
generic results are machine-specific where it matters (`TESTS[...].machine` in
`js/diagnosis.js` — e.g. inspect reads "Open the door and inspect the
evaporator" on the ice dispenser). Each test has a fixed **observation scope**;
a result may only report what that instrument or action could genuinely show:

- `error-log` — cheap, vague. What the controller logged: codes, timestamps,
  event counts. No narrative conclusions.
- `temp-probe` — medium cost. Temperatures, pressures, airflow you'd notice
  while probing. Readings, not diagnoses.
- `inspect-beater` — slow, hands-on look at the product side (beater/auger,
  barrel/bowl, door and seals, hopper, mix path — or plate/curtain/reservoir on
  the ice dispenser). It cannot see the condenser, compressor, supply wiring or
  anything behind a service panel; faults out there just show the generic.
- `continuity-test` — requires Multimeter Tier 2. Electrical readings on
  motors, sensors, coils and supply. The paid-for decisive instrument: it may
  pin a component, but phrase it as the reading ("run capacitor measures a
  fraction of its rated microfarads"), never the conclusion ("it's dead").

## Writing test results (2026-07-07, GDD §2.1)

Results are **observations the player interprets, never verdicts**. "Door
O-ring is flattened and cracked. That'll do it." names the fix; nobody deduces
anything. Instead:

- **Share evidence strings across faults.** When two faults on the same machine
  would genuinely present the same observation, use the *exact same string*
  (e.g. barrel-freeze-up and worn-scraper-blades both show "Hard ice built up
  on the barrel wall…"). A shared result stays ambiguous on its own; the
  discriminating information lives in the combination of symptoms and other
  tests. Copy the string verbatim from an existing fault — the invariant test
  matches strings exactly.
- **Out-of-scope evidence moves or dies.** If the tell lives on the condenser,
  it belongs in `temp-probe` (you'd feel the dead airflow) or `error-log`, not
  in the inspection. If a test would honestly show nothing, delete the entry
  and let the generic speak.
- **Enforced caps** (`tests/information-design.test.js`): per machine, a single
  ungated test may uniquely identify at most ~30% of that machine's fault pool
  (~60% for the tool-gated continuity test), no two faults may share both
  identical symptoms and identical full evidence, and verdict phrasing
  ("that'll do it", "replace the…", "N/A") fails the suite. If your new fault
  trips the cap, share a string or drop an entry.

## Validation rules

1. All required fields present and of the right type.
2. `id` matches the filename.
3. `wrongFixes` is non-empty and does not include `correctFix`.
4. Every key in `tests` is a known test id.
5. `payout` and `partsCost` are positive numbers (partsCost may be 0).
6. `symptomVariants`, when present, is an array of 1–3 objects; each has valid
   `symptoms` (same rules as the base field) and, if present, a valid `tests`
   override map (known test ids, non-empty result strings).

## Example

```json
{
  "id": "door-o-ring-gone",
  "machineType": "soft-serve-commercial",
  "tier": 2,
  "symptoms": ["Mix leaking from the dispense door."],
  "tests": {
    "inspect-beater": "Mix weeping around the dispense head — the seal faces are wet. The door casting itself sits true, no cracks."
  },
  "correctFix": "replace-door-o-ring",
  "wrongFixes": ["replace-dispense-door", "replace-barrel-seal"],
  "payout": 90,
  "partsCost": 10,
  "flavour": "Sealed the deal for the price of a rubber band.",
  "lesson": "A leak at the dispense door is almost always the O-ring — never the door or barrel seal. It's obvious enough that extra tests just burn job time you'll want later.",
  "authenticityNote": "Door O-rings are a routine wear item; leaks at the door are almost never anything else."
}
```

Note the inspect result is deliberately shared verbatim with
`dispense-valve-weeping` — a door-area leak looks the same until you know
*where* the mix shows up, which is what the symptoms tell you.
