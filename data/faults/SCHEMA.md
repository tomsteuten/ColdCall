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
| `tests` | object | yes | Map of test id → result string the player sees when running that test on *this* fault. Only list tests that reveal something; unlisted tests show that test's generic "nothing unusual" result. |
| `correctFix` | string | yes | Fix id that resolves the fault for full payout. |
| `wrongFixes` | string[] | yes | Plausible-but-wrong fix ids offered alongside the correct one (the traps). 1–4 entries, must not contain `correctFix`. |
| `payout` | number | yes | Base payout in $ for a correct first-time fix. Stays within the tier's range in `config/balance.js`. |
| `partsCost` | number | yes | Cost in $ of parts consumed by the correct fix. `0` for procedure-only fixes. |
| `flavour` | string | yes | One-liner shown on the invoice. Pun-heavy, screenshot bait. |
| `lesson` | string | yes | Player-facing diagnostic reasoning shown on a **failure** receipt (GDD §2.1). Name the discriminating clue and why the obvious wrong fix is a trap, in 1–2 sentences. Plain player language — do **not** paste `authenticityNote` verbatim. |
| `authenticityNote` | string | no | Real-world note for contributors — why this fault is genuine. Never shown in game. |

## Test ids (launch set)

Defined by the diagnosis engine; faults may only reference these:

- `error-log` — cheap, vague
- `temp-probe` — medium cost
- `inspect-beater` — slow, very informative
- `continuity-test` — requires Multimeter Tier 2

## Validation rules

1. All required fields present and of the right type.
2. `id` matches the filename.
3. `wrongFixes` is non-empty and does not include `correctFix`.
4. Every key in `tests` is a known test id.
5. `payout` and `partsCost` are positive numbers (partsCost may be 0).

## Example

```json
{
  "id": "door-o-ring-gone",
  "machineType": "soft-serve-commercial",
  "tier": 2,
  "symptoms": ["Mix leaking from the dispense door."],
  "tests": {
    "inspect-beater": "Door O-ring is flattened and cracked. That'll do it."
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
