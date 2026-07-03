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
| `--bg` | `#10141c` | App background — near-black cold navy |
| `--surface` | `#1a2230` | Panels, cards, buttons' resting fill |
| `--surface-hi` | `#202c3e` | Raised surface / dividers / badge default bg |
| `--text` | `#e8edf5` | Primary text |
| `--text-dim` | `#8a96a8` | Secondary text, meta, disabled |
| `--text-inv` | `#10141c` | Text on the accent fill (primary buttons) |
| `--accent` | `#7fd4f0` | **Mint ice-blue** — the brand colour. Primary actions, focus, "in progress" |
| `--warn` | `#f0917f` | **Callback salmon** — misses, callbacks, at-risk, "broken" |
| `--success` | `#a8d8a8` | **Clean-job green** — correct fixes, "refurbished", solved |
| `--amber` | `#f0b84a` | **Van/restock amber** — restock, prestige, one warm caution |

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
  | `--text-xs` | 0.75rem | Meta, badges, uppercase eyebrows, receipt fine print |
  | `--text-sm` | 0.875rem | Secondary copy, card blurbs, list rows |
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
- **Radius:** `--radius-sm` 4px (chips/dots/inline) · `--radius` 8px
  (buttons, cards, panels — the default) · `--radius-lg` 12px (rare, large).
- **Layout:** mobile-first, single column, `#app` capped at **380px** and
  centred. At `min-width: 601px` the app widens to 900px, but **non-job screens
  (home, callbacks, shop, codex, MotD, invoice) stay a centred ~480px column** —
  only the two-column job/repair screens use the full width. Keep new screens in
  that rule: a list of buttons stretched to 900px reads badly.

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
- **`.receipt`** — the settlement surface. Cream printed-paper look, monospace-y
  line items, `--total` bold row. The single warm surface; the payoff beat.
- **`.callback-card`** (full, for due callbacks) vs **`.callback-line`**
  (one-line, for not-yet-due). Match this due/pending split in any new queue UI.

**No emoji as UI chrome.** ✅⚠️🔥📋❌ were removed in favour of badges/dots
(2026-07-04). Emoji live **only** in flavour text and the MotD share-card grid
(🔬🔬✅), which is deliberately Wordle-shaped for shareability.

## 6. Motion

- Screens fade+rise in via `@keyframes screen-in` (0.15s). Machine art has subtle
  state motion (jolt on fault, glow/drip on working) driven by `machine-stage--*`
  classes.
- **`prefers-reduced-motion: reduce` is fully honored and must stay that way** —
  it disables machine-art animation and internal keyframes. Any new animation
  ships with a reduced-motion off-switch in the same change. Motion is feedback
  and polish, never required to understand or play.

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

---

*If you use an AI design tool (Claude Design, Open Design, etc.) to explore a
refresh, feed it this file as the design system so output stays on-palette and
on-voice — and remember it governs UI chrome only, not the machine art or game
feel, which have their own pipelines.*
