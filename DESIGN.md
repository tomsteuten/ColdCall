# DESIGN.md — Cold Call visual system

The design system of record for Cold Call's UI. It documents what already lives
in `css/main.css` so a session doing UI work starts from a stated visual
language instead of reverse-engineering conventions from existing markup.

**When this and the CSS disagree, the CSS wins for tokens you can see rendered —
but update this file in the same change so it stops lying.** New UI should reuse
these tokens and component patterns rather than introducing one-off colours,
sizes, or inline styles. (Structured after the community `DESIGN.md` convention —
color, type, spacing, layout, components, motion, voice, anti-patterns — but it
describes Cold Call's real system, not a generic template.)

Scope: this covers the **DOM/CSS UI chrome** — screens, panels, buttons, badges,
receipts. It deliberately does **not** govern the *machine art* (generated webp
renders + inline SVG in `js/machine-art.js`) or *character portraits*
(`js/character-art.js`), which are their own asset pipeline documented in
`assets/generated/PROMPTS.md`.

---

## 1. Brand & voice

Cold Call is a repair-tycoon × incremental game about fixing commercial ice
cream machines. The UI reads like a **field tech's tablet**: a dark, cold,
after-hours workshop with an ice-blue accent, punctuated by a warm printed
service receipt at settlement. It is clean and legible first, characterful
second — the personality comes from copy and machine art, not from decorative UI.

- **Tone:** dry, specific, competent-tradesperson. Real equipment terms treated
  as normal, not explained down. Jokes come from the world (the meme heat-treat
  lockout, the $15 fix everyone overlooks), never from UI cutesiness.
- **Register:** short, declarative. "Callback." "Fixed!" "Running cold again."
- **The receipt is the one warm surface.** Everything else is cold workshop dark;
  the invoice deliberately flips to a cream printed-paper look (`.receipt`) as the
  reward beat. Preserve that contrast — it's the payoff, don't dilute it.

## 2. Color

All colours are CSS custom properties in `:root` (`css/main.css`). Never hardcode
a hex in a component; add or reuse a token. Derive tints/shades with
`color-mix(in srgb, var(--token) N%, transparent)` — the codebase does this
everywhere rather than defining a dozen near-duplicate tokens.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0b1017` | App background — near-black cold navy |
| `--surface` | `#182331` | Panels, cards, buttons' resting fill |
| `--surface-hi` | `#213043` | Raised surface / dividers / badge default bg |
| `--text` | `#edf2f6` | Primary text |
| `--text-dim` | `#aab6c3` | Secondary text, meta, disabled |
| `--text-inv` | `#0b1017` | Text on the accent fill (primary buttons) |
| `--accent` | `#76d6ee` | **Mint ice-blue** — the brand colour. Primary actions, focus, "in progress" |
| `--warn` | `#ea806f` | **Callback salmon** — misses, callbacks, at-risk, "broken" |
| `--success` | `#8fd19a` | **Clean-job green** — correct fixes, "refurbished", solved |
| `--amber` | `#e7b557` | **Van/restock amber** — restock, prestige, one warm caution |

**Semantic mapping (keep this consistent — colour carries meaning here):**
- Accent = the core loop / neutral-positive / interactive.
- Success = you did the diagnosis right (fixes, clean streak, MotD solved).
- Warn = the failure/obligation axis (callbacks, misses, broken workshop stock).
- Amber = money-adjacent side actions (restock, prestige) — used sparingly so it
  stays a signal, not decoration.

## 3. Typography

- **Family:** `Outfit`, self-hosted variable woff2 (weights 400–700, SIL OFL
  1.1), with `system-ui` fallback. **Do not reintroduce a Google Fonts link** —
  the PWA makes zero runtime external requests. Files in `assets/fonts/`, listed
  in `sw.js` APP_SHELL.
- **Scale** (rem tokens, never raw px for text):

  | Token | Size | Typical use |
  |---|---|---|
  | `--text-xs` | 0.8125rem | Meta, badges, uppercase eyebrows, receipt fine print |
  | `--text-sm` | 0.9rem | Secondary copy, card blurbs, list rows |
  | `--text-base` | 1rem | Body, button labels |
  | `--text-lg` | 1.125rem | Sub-headers |
  | `--text-xl` | 1.25rem | Compact wordmark, section emphasis |
  | `--text-2xl` | 1.5rem | Screen titles |
  | `--text-3xl` | 2.25rem | Full brand wordmark |

- **Weights:** 400 body, 600 emphasis/labels, 700 headings & primary buttons,
  900 the wordmark. Line-height 1.5 body, ~1.3 on buttons.
- **Eyebrow pattern:** small labels use `--text-xs`, `font-weight: 700`,
  `text-transform: uppercase`, `letter-spacing: 0.04em`, `--text-dim` (see
  `.panel-label`, `.workshop-heading`). Reuse this rather than inventing a new
  small-label style.

## 4. Spacing, shape, layout

- **Spacing scale** (never raw px for layout gaps): `--space-xs` 0.25rem ·
  `--space-sm` 0.5rem · `--space` 1rem · `--space-lg` 1.5rem · `--space-xl`
  2.5rem. Screens and lists are `display:flex; flex-direction:column` with a
  `gap` from this scale — prefer `gap` over margins.
- **Radius:** `--radius-sm` 3px (chips/dots/inline) · `--radius` 6px
  (buttons, cards, panels — the default) · `--radius-lg` 9px (rare, large).
- **Accent stroke:** `--stroke-accent` 3px for the load-bearing edge on
  recommendation and operations surfaces; use the token rather than a raw
  component-specific width.
- **Layout:** mobile-first, single column, `#app` capped at **420px** and
  centred. At `min-width: 601px` the app widens to 900px, but **non-job screens
  (home, callbacks, shop, codex, MotD, invoice) stay a centred ~480px column** —
  only the two-column job/repair screens and the mature Home Operations Board
  use the full width. Keep list screens in the narrow rule: a list of buttons
  stretched to 900px reads badly.
- **Desktop job screen is a two-column grid on `.job-cols`** (2026-07-30):
  the ticket panel, machine art, and caller context form the left column; the
  diagnostics and progressive repair tray form the right. This is a height
  budget, not
  decoration — Windows browsers at 125–150% zoom leave only ~640 CSS px of
  height, and a standard job must fit it without scrolling. The evidence
  still renders first (top-left, above the controls) per the §7
  anti-pattern. Mobile (<601px) keeps the plain stacked column.

## 5. Components (reuse these — don't hand-roll)

- **`.btn`** — base: transparent fill, 1px `--text-dim` border, left-aligned.
  Variants recolour the border+text to carry meaning:
  `.btn-primary` (filled accent, centred, the one strong CTA per screen),
  `.btn-callbacks` (warn), `.btn-motd` (success), `.btn-restock`/`.btn-prestige`
  (amber), `.btn-buy`/`.btn-fix`/`.btn-callback-take` (accent), `.btn-sm`
  (compact). `:disabled` dims border and text via color-mix. **One primary
  button per screen** — it's the "what next" signal.
- **`.badge`** — small uppercase status pill. `.badge--success` / `.badge--warn`
  tint their colour at 15%. Use for state labels (MotD Solved/Missed, streaks,
  callback rate).
- **`.dot` / `.score-dot`** — status dots. `.dot--ok` (success) / `.dot--warn`
  (warn) with a soft glow; `.score-dot` (accent) is the MotD test tally.
- **`.panel`** — a `--surface` card with a `.panel-label` eyebrow. The default
  content container.
- **`.shop-card`** — list-row card (upgrades ladder, staff). `.shop-card-owned`
  dims; `.shop-card-locked` shows the item greyed with its unlock condition.
- **`.home-details`** — native `<details>` collapsible for secondary home
  sections (prestige, workshop) so the loop stays above the fold. One-line
  `<summary>`, expands on tap.
- **`.settlement-board`** (2026-07-31) — the job-result surface: physical outcome
  seal, banked cash, reputation, streak/time, bonus awards and one truthful
  network-progress meter. Success uses service green; callbacks use warning
  salmon. It is the payoff beat and must fit above both exits on a 320×640 view.
- **`.receipt-ledger` / `.receipt`** — native disclosure plus cream printed-paper
  accounting. The itemised invoice deliberately remains monospace text; it is
  collapsed after success and open after a miss, when reviewing consequences is
  more important than accelerating into the next ticket.
- **`.callback-card`** (full, for due callbacks) vs **`.callback-line`**
  (one-line, for not-yet-due). Match this due/pending split in any new queue UI.
- **`.job-ticket`** (2026-07-05, compacted 2026-07-30) — the job screen's
  symptoms-first work-order header: source/stakes, client/machine, quoted
  symptoms, then the diagnosis rail. It remains the first item in `.job-cols`
  and the first content after the status bar on every viewport, but caller flavour
  and job instruments now sit below the machine art. This keeps the report
  first while bringing the physical equipment into the first mobile viewport.
  The symptom block remains the dominant inset: 4px accent, tinted low surface,
  upright semibold symptom lines.
- **`.job-ticket--first-focus` / `.diagnostics-panel--first-choice`**
  (2026-07-31) — a one-decision teaching state used only while the untouched
  first field job has no evidence. The symptom inset gains the strongest edge
  and type weight; empty time/bonus instruments, the progress rail, caller
  flavour, and the repair tray are withheld. The right column asks for one test,
  keeps the three available labelled controls prominent, and renders a gated
  meter as a compact upgrade preview. Optional test definitions follow the
  actions. After any test, the normal diagnosis workspace returns immediately.
  This structure persists when tips are off; that setting removes coaching copy,
  not the safe information sequence.
- **`.streak-flame`** (2026-07-05) — small inline SVG icon (not emoji) marking
  an escalating clean streak at 5/10/20 via `--1`/`--2`/`--3` glow tiers.
- **`.celebration-card`** (2026-07-05) — apply to a "big deal" moment (tier
  unlock, completed daily contract) for a half-second bouncy entrance. Not an
  auto-dismissing popup; the element stays put afterward like any other line.
- **`.status-home`** (2026-07-08) — the always-there Home affordance: a small
  accent-outlined button (house glyph + "Home") in the status bar's 4th grid
  column (`.status-bar--nav` modifier) on every screen except home itself.
  Wired by ONE delegated listener in main.js (`[data-action="go-home"]`), not
  per-screen wire() functions. Navigating home mid-job pauses the job (it
  persists in state; home's primary button becomes "Resume job"). Playtest
  fix: bottom-of-screen "Back" buttons were below the fold; the status bar is
  the one surface that's always visible.
- **`.home-shift-brief`** (2026-07-12) — compact read-only recommendation above
  Home's primary action. It summarizes the most urgent existing queue,
  contract, paused-job, or unlock state; it never introduces a duplicate
  action or event hook. Keep it to one action line plus one short reason.
- **`.first-call`** (2026-07-30) — the fresh-save Home's incoming-dispatch
  surface. It makes the first field call the only primary objective, previews
  the real symptom → evidence → repair loop, states the clean-fix/callback
  consequences, and folds Today's Contract into one compact bonus strip.
  Never preview a client, machine, or fault here unless ticket selection is
  moved into durable state; accepting the call currently performs that draw.
  Machine of the Day, the manual, upgrades, and settings remain visibly
  optional in `.first-call-extras`.
- **`.operations-board`** (2026-07-28) — the mature-player Home surface after
  the first completed job. It groups existing state and actions into Work
  Queue, Field Crew, and (from Tier 2) Workshop lanes. Mobile stacks the lanes;
  desktop may use the 900px shell. It is a readout, not a real-time simulation:
  never animate fake progress or introduce duplicate actions merely to make it
  look busy. New players retain the simpler single-column Home sequence.
- **`.service-network`** (2026-07-29) — the Operations Board's compact,
  state-derived schematic. The Manual Bench is always the source and explicitly
  carries the best-pay-and-reputation promise; Field Routes and the Refurb Line
  branch from it with real crew throughput, capacity, and output states. Warn
  hatching means work is blocked or a bay is full, not generic decoration.
  Misses and workshop repairs visibly loop back to manual diagnosis. The marks
  are DOM/CSS rather than raster art because every label and state must match
  the current save. Never add cosmetic packets, spinning gears, or fake ticking.
- **`.work-order-context`** (2026-07-28) — a compact handover strip at the top
  of every active diagnosis. It names where the machine came from and what a
  correct diagnosis advances: field calls pay cash/rep, player callbacks are
  owed return visits, technician misses are optional rescues, workshop refurbs
  move to Ready for sale, and the daily is score-only. Use semantic accent,
  warn, amber, and success edge colours; keep it to one label plus one stakes
  line so it disappears with the work order instead of becoming tutorial copy.
- **Field dispatch family** (2026-07-28) — delegation is presented as one
  physical handover across screens, not as disconnected idle stats.
  `.dispatch-handover` is the transient signed docket after a hire, training,
  or route purchase; it names who has the keys, which route moved, and the
  immediate effect before leading back to Home. `.field-route-card` is the
  durable Operations Board version: route and technician stay attached to
  jobs/hour, clean-fix pay, skill success, and the miss → optional rescue
  outcome. `.field-return` brings the same language back as settled run sheets
  after an absence. These surfaces may animate a quick stamp or play the dry
  radio chirp, but must never imply real-time travel or ticking.
- **Callback source treatments** (2026-07-28) — `.callback-card--obligation`
  uses the warn edge and “Owed return visit”; `.callback-card--rescue` uses the
  dispatch accent and “Optional route rescue.” Both retain exact payout,
  expiry, and consequence copy. Pending rescue lines keep a compact source tag
  so technician attribution does not vanish while the call is waiting.
- **`.workshop-pipeline`** (2026-07-28) — the Operations Board's production
  line: Receiving, Repair, and Ready capacity bays. Phones stack them with
  static dashed conveyor links; wide Home lays them left-to-right. Machine cards
  use warn for damaged intake, accent for active diagnosis, and success only
  after QA/repair. Capacity badges state full bottlenecks in words and full bays
  gain a stationary stop hatch, never colour alone. The active job remains the
  one Repair bay; never animate progress the simulation does not actually track.
- **`.diagnosis-steps`** (2026-07-12) — the compact three-stage
  Review symptoms / Gather evidence / Authorise repair path shown to returning
  players. It is a quiet numbered rail below the symptom report, not a
  segmented control: the active step uses `aria-current="step"`; completed
  steps use success colour. It is orientation only, never a hint about the
  correct test or fix.
- **`.invoice-actions`** (2026-07-12, moved 2026-07-31) — Next ticket and Home
  share one centered two-column row immediately below `.settlement-board` and
  before the optional itemised ledger. A workshop result has one full-width
  Home action. Failure teaching follows the exits so a long lesson can never
  bury navigation.
- **`.repair-tray`** (2026-07-30, first-ticket rule 2026-07-31) — the final
  diagnosis lives in a native `<details>` tray after the evidence controls. On
  normal jobs it begins collapsed before a test and can still be opened for a
  deliberate blind fix. On the untouched first job it is not rendered at all;
  one evidence action reveals it already open. Confirmation/restocking also
  opens it. The tray is presentation only: it never changes fix availability,
  settlement, or saves.
- **Image hotspots are retired** (2026-07-11). Generated raster compositions
  move their tools and panels between states, so percentage hit regions were
  unreliable across machines and viewports. Labelled `.btn-test` controls are
  the single interaction path; machine art reflects the last completed test.
- **Diagnostic instruments** (2026-07-29) — every `.btn-test` pairs its label
  with one compact `.test-instrument` mark: controller history, temperature
  probe, captured fastener, or continuity meter. The same mark follows the
  observation into `.evidence-item`; only `.evidence-item--latest` plays the
  instrument-specific settle, then it recedes into the ledger. These marks
  clarify the nature of an action and are `aria-hidden`; they never replace the
  text label or create another hit target.
- **Repair service sequence** (2026-07-31) — a correct field repair gets two
  cosmetic, interrupt-safe phases after settlement: `.screen-repair--seal`
  keeps the rendered machine in its `ajar` state while a single hold control
  torques the panel; `.screen-repair--restart` reveals the `working` render,
  stable-operation scope and one primary “View job result” action. The
  `.repair-service-rail` describes fitted / sealed / recommissioned progress.
  “Skip sequence” goes directly to the already-settled result and never changes
  money, reputation, stock or saves.

**No emoji as UI chrome.** ✅⚠️🔥📋❌ were removed in favour of badges/dots
(2026-07-04). Emoji live **only** in flavour text and the MotD share-card grid
(🔬🔬✅), which is deliberately Wordle-shaped for shareability.

## 6. Motion

- Screens fade+rise in via `@keyframes screen-in` (0.15s). Machine art has subtle
  state motion (jolt on fault, glow/drip on working) driven by `machine-stage--*`
  classes.
- **View transitions (2026-07-07):** whole-screen changes (home → job → repair →
  invoice…) animate through the native View Transitions API — `main.js` computes a
  `viewKey()` per render and wraps the swap in `document.startViewTransition` only
  when the key changes, so intra-view re-renders (running a test, arming a confirm)
  stay instant and never double the per-element juice. Named groups in `main.css`:
  `.screen` slides out/in (`vt-screen-out`/`vt-screen-in`), `.status-bar` morphs in
  place so it reads as a fixed HUD, and `.machine-stage` morphs continuously between
  the job and repair screens. `html:active-view-transition .screen { animation: none }`
  stops the mount fade doubling under the snapshot. Unsupported browsers and
  reduced-motion players get the plain instant swap (JS gate on
  `prefersReducedMotion()` + a `::view-transition-*` off-switch in the reduced-motion
  block). A named group must stay unique per view — one `.machine-stage`, one
  `.status-bar` per screen, or the transition throws and skips.
- **Micro-interactions (2026-07-07):** every `.btn` brightens on hover
  (`filter: brightness(1.18)`, `@media (hover: hover)` only — no sticky states on
  touch) and gives 1px on press. `brightness()` composes with each variant's own
  colours; do NOT override `background`/`border-color` in a generic hover, it
  flattens `.btn-primary`/warn/success variants. Callbacks and codex list items deal
  in with capped `nth-child` stagger (same pattern as receipt lines) — render-once
  views only; the shop re-renders per purchase and would visibly re-stagger.
- **`prefers-reduced-motion: reduce` is fully honored and must stay that way** —
  it disables machine-art animation and internal keyframes. Any new animation
  ships with a reduced-motion off-switch in the same change. Motion is feedback
  and polish, never required to understand or play.
- **Game-feel pass (2026-07-05):** machine art now breathes continuously
  (`idle-breathe`, filter-based so it never fights a state's own transform
  animation) and gets a one-shot jolt only when a fault ticket's art first
  mounts (`machine-fault-jolt-once`). The earlier ambient particle layer was
  retired because it looked like unexplained controls. A correct fix gets a
  one-shot glow overlay
  (`.repair-glow`) on the repair screen; a wrong fix gets one hard shake
  (`.screen-shake`) on the invoice screen, layered onto the shared fade-in,
  not replacing it. The receipt prints its lines in sequence (`.receipt > *`
  staggered `nth-child` delays) and its settlement number counts up from $0
  with a floating `+$N` badge — driven from JS in `job.js` (`wireInvoiceJuice`),
  gated on `prefersReducedMotion()` from `utils.js` since a JS-driven tween
  needs its own check, not just a CSS media query. Test results stamp in
  (`.test-result`'s `test-result-stamp` keyframe) with a matching instrument
  sound in `js/audio.js` (`diagnostic`); tier unlock / contract completion pair
  `.celebration-card` with a `fanfare` sound.
- **Instrument-signature pass (2026-07-29):** `machine-stage--log`, `--probe`,
  `--leads`, and `--ajar` each settle differently when evidence lands.
  `.test-instrument` repeats that identity in the controls and latest evidence,
  while `audio.diagnostic()` supplies controller keys, a probe chirp, fastener
  clicks, or the meter's continuity beep. Every keyframe is suppressed in the
  reduced-motion block; no motion is required to identify a test.
- **Tactile repair pass (2026-07-31):** `.machine-telemetry` adds a tiny
  instrument signature to existing state captions. The repair fastener rotates
  only with actual hold progress; recommission adds a pulsing status lamp and
  repeating scope trace, paired with `audio.repair()`'s dry torque/compressor
  sound. All new keyframes are disabled under reduced motion. These are
  redundant confirmations: text and machine state carry the full meaning.
- **Cold-chain settlement pass (2026-07-29):** the offline report turns only
  already-settled crew output into three one-shot invoice packets, then the
  mature Home schematic may echo one returned packet along its funding bus.
  These animations mount only with a real return report; ordinary Home and the
  workshop line remain still. `.field-return-track i` and
  `.service-network-bus i` are both disabled by the reduced-motion block.

## 7. Anti-patterns (things that broke this system before — don't repeat)

- **Inline `style="…"` in JS templates.** Older home-screen code carried
  `style="display:flex;justify-content:space-between;color:var(--warn)"` inline;
  Phase 4 replaced it with `.workshop-row`, `.dot`, etc. Add a class, don't inline.
- **Hardcoded hex or px** in a component. Use a token; if none fits, add one to
  `:root` with a comment.
- **A second primary button** on a screen. Dilutes the "what next" signal.
- **Reintroducing the Google Fonts `<link>`** — breaks the offline guarantee.
- **Emoji as interface state** — use `.badge`/`.dot`.
- **New app-shell CSS/JS without bumping `sw.js`** — PWA users get stale assets.
- **Colour drift** — don't use warn/amber/success decoratively. Their meaning
  (failure / money / correctness) is load-bearing; misuse makes the UI lie.
- **Burying the evidence below the chrome.** The job screen used to put the
  reported symptoms third in the left column — below the header panel and the
  machine art — while the diagnostics buttons sat visible top-right on desktop.
  Fixed 2026-07-05 (`.job-ticket`, §5): the thing the player needs to read
  before acting renders before the controls that act on it, full-width, above
  any multi-column split.

---

*If you use an AI design tool (Claude Design, Open Design, etc.) to explore a
refresh, feed it this file as the design system so output stays on-palette and
on-voice — and remember it governs UI chrome only, not the machine art or game
feel, which have their own pipelines.*
