/** @file Inline SVG machine illustrations for the .art-slot frame.
 *
 * Base states (used by the game today):
 *   'fault'   — machine showing symptoms, panel closed (shown before any tests run)
 *   'open'    — mid-teardown: lids/panels off, internals exposed (after first test)
 *   'working' — machine fixed and running (invoice / repair beat / preview tool)
 *
 * Interaction states used as feedback after labelled diagnostic tests:
 *   'probe'   — a lid is off and the temp probe is in the product
 *   'leads'   — an access cover is off with meter leads clipped to terminals
 *   'ajar'    — the service panel is cracked open, screwdriver still out
 *
 * Returns null for unknown machine IDs so callers can render a text fallback.
 *
 * Palette is hardcoded so art looks consistent in both the game and the standalone
 * preview tool (machine-css-preview.html) without requiring CSS custom properties.
 */

const P = {
  // Stainless steel (three tones, lit from the top left).
  steelHi:  '#a9bacf',
  steel:    '#67788f',
  steelLo:  '#43506a',
  steelEdge:'#2e3950',
  // Dark structural plastic / powder-coat trim.
  trim:     '#303a52',
  trimHi:   '#46536f',
  trimLo:   '#20283a',
  // Glass and product.
  glass:    '#152238',
  glassHi:  'rgba(210,230,255,0.16)',
  fluidOk:  '#38bdf8',
  fluidOkHi:'#7dd3fc',
  fluidFlt: '#2a4f68',
  // Panels and displays.
  panel:    '#1b2234',
  screen:   '#0a1120',
  ok:       '#34d399',
  okCyan:   '#22d3ee',
  warn:     '#f59e0b',
  // Meter lead colours for the 'leads' interaction state.
  leadRed:  '#ef6a6a',
  leadBlk:  '#111827',
  shadow:   'rgba(0,0,0,0.4)',
};

/**
 * Shared <defs> gradients, id-prefixed per SVG instance so several machines
 * can sit inline in one document (preview tool, codex) without id collisions.
 * @param {string} p unique prefix, e.g. 'sl-fault'
 */
function defs(p) {
  return `<defs>
    <linearGradient id="${p}-steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.steelHi}"/>
      <stop offset="0.25" stop-color="${P.steel}"/>
      <stop offset="1" stop-color="${P.steelLo}"/>
    </linearGradient>
    <linearGradient id="${p}-steelH" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${P.steelHi}"/>
      <stop offset="0.5" stop-color="${P.steel}"/>
      <stop offset="1" stop-color="${P.steelLo}"/>
    </linearGradient>
    <linearGradient id="${p}-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d3252"/>
      <stop offset="1" stop-color="${P.glass}"/>
    </linearGradient>
    <linearGradient id="${p}-fluid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.fluidOkHi}"/>
      <stop offset="1" stop-color="#0c8ecb"/>
    </linearGradient>
    <linearGradient id="${p}-trim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.trimHi}"/>
      <stop offset="1" stop-color="${P.trimLo}"/>
    </linearGradient>
  </defs>`;
}

/** Soft ground shadow so the machine sits on something instead of floating. */
function ground(cx, rx) {
  return `<ellipse cx="${cx}" cy="66.5" rx="${rx}" ry="3" fill="${P.shadow}"/>`;
}

/** Status LED with halo. cls hooks the CSS pulse/blink animations. */
function led(cx, cy, colour, cls = '') {
  return `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${colour}" opacity="0.18"${cls ? ` class="${cls}"` : ''}/>
    <circle cx="${cx}" cy="${cy}" r="2.4" fill="${colour}"${cls ? ` class="${cls}"` : ''}/>
    <circle cx="${cx - 0.8}" cy="${cy - 0.8}" r="0.7" fill="white" opacity="0.7"/>`;
}

/** Amber warning triangle for fault/open panels. */
function warnBadge(cx, cy) {
  return `<path d="M ${cx} ${cy - 3.4} L ${cx + 3.2} ${cy + 2.6} L ${cx - 3.2} ${cy + 2.6} Z"
      fill="${P.warn}" class="machine-warn-led"/>
    <rect x="${cx - 0.45}" y="${cy - 1.6}" width="0.9" height="2.6" rx="0.4" fill="#1a1a2e"/>
    <circle cx="${cx}" cy="${cy + 1.7}" r="0.55" fill="#1a1a2e"/>`;
}

/** Handheld temp probe stuck into the product, for the 'probe' interaction state. */
function tempProbe(x, y) {
  return `<g>
    <line x1="${x}" y1="${y}" x2="${x + 9}" y2="${y - 17}" stroke="${P.steelHi}" stroke-width="2" stroke-linecap="round"/>
    <g transform="rotate(28 ${x + 9} ${y - 17})">
      <rect x="${x + 5.4}" y="${y - 30}" width="7.2" height="13.5" rx="2.6" fill="${P.trimHi}"/>
      <rect x="${x + 5.4}" y="${y - 30}" width="7.2" height="2" rx="1" fill="white" opacity="0.2"/>
      <rect x="${x + 6.8}" y="${y - 27.6}" width="4.4" height="5" rx="0.8" fill="${P.screen}"/>
      <rect x="${x + 7.5}" y="${y - 26.4}" width="3" height="2.6" rx="0.5" fill="${P.okCyan}" opacity="0.9"/>
    </g>
    <path d="M ${x + 12} ${y - 26} C ${x + 20} ${y - 24}, ${x + 24} ${y - 14}, ${x + 30} ${y - 10}"
      fill="none" stroke="${P.trimLo}" stroke-width="1.2"/>
  </g>`;
}

/** Red/black multimeter leads clipped onto exposed terminals ('leads' state). */
function meterLeads(x, y) {
  return `<g>
    <path d="M ${x} ${y} C ${x + 9} ${y + 7}, ${x + 18} ${y + 9}, ${x + 30} ${y + 12}"
      fill="none" stroke="${P.leadRed}" stroke-width="1.3"/>
    <path d="M ${x + 4} ${y + 1.5} C ${x + 12} ${y + 9}, ${x + 20} ${y + 12}, ${x + 30} ${y + 15}"
      fill="none" stroke="${P.leadBlk}" stroke-width="1.3"/>
    <rect x="${x - 2.4}" y="${y - 3.4}" width="4.4" height="4.4" rx="1" fill="${P.leadRed}"/>
    <rect x="${x + 2}" y="${y - 1.6}" width="4.4" height="4.4" rx="1" fill="${P.leadBlk}"/>
  </g>`;
}

/** Small product swirl in a cone — the universal "it runs again" money shot. */
function miniSwirl(cx, baseY, colour = '#f0e6d2') {
  const y = baseY;
  return `<g>
    <path d="M ${cx} ${y} L ${cx - 2.6} ${y - 5.6} L ${cx + 2.6} ${y - 5.6} Z" fill="#e8b96a"/>
    <path d="M ${cx - 2.4} ${y - 5.6} Q ${cx} ${y - 4.2} ${cx + 2.4} ${y - 5.6} L ${cx + 2} ${y - 4.4} Q ${cx} ${y - 3.4} ${cx - 2} ${y - 4.4} Z" fill="#d9a44a" opacity="0.6"/>
    <path d="M ${cx - 2.4} ${y - 5.7} Q ${cx - 3.1} ${y - 7.4} ${cx} ${y - 7.6} Q ${cx + 3.1} ${y - 7.4} ${cx + 2.4} ${y - 5.7} Z" fill="${colour}"/>
    <path d="M ${cx - 1.9} ${y - 7.6} Q ${cx - 2.4} ${y - 9.2} ${cx} ${y - 9.3} Q ${cx + 2.4} ${y - 9.2} ${cx + 1.9} ${y - 7.6} Z" fill="${colour}"/>
    <path d="M ${cx - 1.2} ${y - 9.3} Q ${cx - 1.3} ${y - 10.6} ${cx} ${y - 11} Q ${cx + 1.3} ${y - 10.4} ${cx + 1.2} ${y - 9.3} Z" fill="${colour}"/>
    <path d="M ${cx - 1.3} ${y - 5.9} Q ${cx - 1.8} ${y - 7.7} ${cx - 0.6} ${y - 9.4}" stroke="white" stroke-width="0.55" fill="none" opacity="0.5"/>
  </g>`;
}

// Each machine has three base states (fault/open/working) plus the three
// interaction states (probe/leads/ajar) that labelled diagnostic controls swap
// to — all scale-/camera-matched to the fault render so the swap never
// jumps (see assets/generated/PROMPTS.md for how the interaction set was made).
const RENDER_STATES = ['fault', 'open', 'working', 'probe', 'leads', 'ajar'];
const GENERATED_MACHINES = Object.fromEntries(
  ['slushie-machine', 'soft-serve-commercial', 'froyo-multihead', 'granita-slushie', 'commercial-ice-dispenser']
    .map((id) => [id, Object.fromEntries(RENDER_STATES.map((s) => [s, `assets/generated/${id}-${s}.webp`]))])
);

/**
 * Returns the generated raster render for a machine type and visual state, or
 * null to fall back to the inline SVG (`machineSvg`). Rendered raster is the
 * one art lane now that every machine has all six states (2026-07-08); the SVG
 * survives only as the fallback for the test environment (globalThis.test —
 * webp paths don't resolve headless) and any machine without a render.
 * @param {string} machineId
 * @param {'fault'|'open'|'working'|'probe'|'leads'|'ajar'} state
 * @returns {string|null}
 */
export function machineImageSrc(machineId, state) {
  if (typeof globalThis !== 'undefined' && globalThis.test) {
    return null;
  }
  return GENERATED_MACHINES[machineId]?.[state] ?? null;
}


/**
 * Returns inline SVG markup for a machine in the given display state.
 * @param {string} machineId  matches the id field in machines.json
 * @param {'fault'|'open'|'working'} state
 * @returns {string|null} SVG markup string, or null if no art for this machine
 */
export function machineSvg(machineId, state) {
  if (machineId === 'slushie-machine')       return slushieSvg(state);
  if (machineId === 'soft-serve-commercial') return softServeSvg(state);
  if (machineId === 'froyo-multihead')          return froyoSvg(state);
  if (machineId === 'granita-slushie')          return granitaSvg(state);
  if (machineId === 'commercial-ice-dispenser') return iceMakerSvg(state);
  return null;
}

// ── Slushie Machine (Polar Twister Twin-Bowl) ────────────────────────────────
//
// Front elevation of a twin-bowl countertop slushie unit. Two transparent
// bowls side by side with a central divider, agitator paddles inside each
// bowl, control panel on the base, two dispensing taps at the bottom.
//
// Fault   → darker / depleted fluid, amber LED, amber screen text, warning dot
// Open    → lids removed, agitator cross-paddles visible in both bowls
// Working → full cyan fluid, green LED, green screen text

function slushieSvg(state) {
  const working = state === 'working';
  const open = state === 'open';
  const p = `sl-${state}`;

  // Interaction states ('probe' | 'leads' | 'ajar') build on the fault look.
  const fluidTop = working ? 14 : 30;
  const scText = working ? 'COOL' : 'E-04';
  const scFill = working ? P.ok : P.warn;
  const ledCol = working ? P.ok : P.warn;

  /** One bowl: glass, product, auger helix, rim and specular streaks. */
  const bowl = (x, side) => {
    const cx = x + 21;
    // Auger: centre shaft + a continuous spiral ribbon (S-wave wrapped around
    // the shaft). Pulled half out of the bowl when open for inspection.
    const lift = open ? -9 : 0;
    const spiralTop = 13 + lift;
    const auger = `
      <line x1="${cx}" y1="${11 + lift}" x2="${cx}" y2="38" stroke="${P.steelHi}" stroke-width="1.7"/>
      <path d="M ${cx - 5.5} ${spiralTop}
               C ${cx + 7} ${spiralTop + 3}, ${cx - 7} ${spiralTop + 6.5}, ${cx + 5.5} ${spiralTop + 9.5}
               C ${cx - 7} ${spiralTop + 12.5}, ${cx + 7} ${spiralTop + 16}, ${cx - 5.5} ${spiralTop + 19}
               ${lift ? '' : `C ${cx + 7} ${spiralTop + 22}, ${cx - 5} ${spiralTop + 24.5}, ${cx + 4.5} ${spiralTop + 25.5}`}"
        fill="none" stroke="${P.steelHi}" stroke-width="1.5" stroke-linecap="round" opacity="0.95"/>
      <path d="M ${cx - 5.5} ${spiralTop + 0.8}
               C ${cx + 6} ${spiralTop + 3.8}, ${cx - 6} ${spiralTop + 7}, ${cx + 5.5} ${spiralTop + 10.3}"
        fill="none" stroke="${P.steelLo}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`;
    const fluid = working
      ? `<path class="machine-fluid--${side}" d="M ${x} ${fluidTop + 1.5}
           Q ${x + 10} ${fluidTop - 1.5} ${x + 21} ${fluidTop + 1}
           Q ${x + 32} ${fluidTop + 3} ${x + 42} ${fluidTop}
           L ${x + 42} 39 L ${x} 39 Z" fill="url(#${p}-fluid)" opacity="0.9"/>`
      : `<rect x="${x}" y="${fluidTop}" width="42" height="9" fill="${P.fluidFlt}" opacity="0.6"/>
         <rect x="${x}" y="${fluidTop}" width="42" height="1.2" fill="#3a6a84" opacity="0.5"/>
         <rect x="${x}" y="${fluidTop - 5}" width="42" height="0.9" fill="#3a6a84" opacity="0.22"/>
         <rect x="${x}" y="${fluidTop - 10}" width="42" height="0.9" fill="#3a6a84" opacity="0.14"/>`;
    return `
      <rect x="${x - 1.5}" y="8" width="45" height="33" rx="2.5" fill="${P.steelEdge}"/>
      <rect x="${x}" y="9.5" width="42" height="30" rx="1.8" fill="url(#${p}-glass)"/>
      ${fluid}
      ${auger}
      <rect x="${x}" y="9.5" width="5" height="30" fill="white" opacity="0.07"/>
      <path d="M ${x + 4} 12 L ${x + 9} 12 L ${x + 5} 36 L ${x + 2.5} 36 Z" fill="white" opacity="0.10"/>
      <rect x="${x + 34}" y="9.5" width="8" height="30" fill="black" opacity="0.16"/>`;
  };

  /** Domed lid with handle knob; omitted (removed) in the open state. */
  const lid = (x) => `
    <path d="M ${x - 1} 9 Q ${x - 1} 3.5 ${x + 6} 3.2 L ${x + 37} 3.2 Q ${x + 44} 3.5 ${x + 44} 9 Z"
      fill="url(#${p}-trim)"/>
    <rect x="${x + 16.5}" y="1" width="10" height="3.4" rx="1.6" fill="${P.trimHi}"/>
    <rect x="${x - 1}" y="3.4" width="8" height="2" rx="1" fill="white" opacity="0.10"/>`;

  // Lids removed: one leaning against the cabinet, one flat on the ground,
  // plus a couple of thumbscrews on the deck — mid-teardown, not vanished.
  const lidsAside = `
    <g transform="rotate(-64 133 62)">
      <path d="M 133 62 Q 133 56.5 140 56.2 L 164 56.2 Q 171 56.5 171 62 Z" fill="url(#${p}-trim)"/>
      <rect x="146" y="54.4" width="9" height="2.6" rx="1.3" fill="${P.trimHi}"/>
    </g>
    <g transform="translate(2 0)">
      <ellipse cx="16" cy="63.5" rx="12.5" ry="2.6" fill="${P.trimLo}"/>
      <path d="M 4 63.5 Q 4 60.8 8 60.6 L 24 60.6 Q 28 60.8 28 63.5 Z" fill="url(#${p}-trim)"/>
    </g>
    <circle cx="70" cy="6.2" r="1.1" fill="${P.steelHi}"/>
    <circle cx="74" cy="7" r="1.1" fill="${P.steelHi}"/>`;

  /** Dispense tap: chrome body with spout, pull-paddle hanging in front. */
  const tap = (cx) => `
    <rect x="${cx - 6}" y="41.5" width="12" height="6.5" rx="1.6" fill="url(#${p}-steelH)"/>
    <rect x="${cx - 6}" y="41.5" width="12" height="1.2" rx="0.6" fill="white" opacity="0.25"/>
    <rect x="${cx - 1.6}" y="47.6" width="3.2" height="3.4" fill="${P.steelLo}"/>
    <rect x="${cx - 2.6}" y="50.4" width="5.2" height="1.6" rx="0.8" fill="${P.steelEdge}"/>
    <rect x="${cx - 2.1}" y="36.2" width="4.2" height="6" rx="2" fill="${P.trimHi}"/>
    <rect x="${cx - 2.1}" y="36.2" width="4.2" height="1.4" rx="0.7" fill="white" opacity="0.2"/>`;

  // Lower service panel — cracked open in 'ajar', removed in 'leads'.
  const serviceBay =
    state === 'ajar'
      ? `<rect x="58" y="52.5" width="44" height="9" fill="${P.trimLo}"/>
         <g transform="rotate(-8 58 61.5)">
           <rect x="58" y="52.5" width="44" height="9" rx="1.2" fill="url(#${p}-trim)"/>
           ${[0, 1, 2, 3].map((i) => `<rect x="${63 + i * 10}" y="55.5" width="6.5" height="1.1" rx="0.55" fill="${P.trimLo}"/>`).join('')}
         </g>
         <rect x="104" y="57" width="12" height="2" rx="1" fill="#d9a44a"/>
         <rect x="114.5" y="56.4" width="4.5" height="3.2" rx="1" fill="${P.trimHi}"/>`
      : state === 'leads'
        ? `<rect x="58" y="52.5" width="44" height="9" fill="${P.trimLo}"/>
           <rect x="63" y="54.5" width="10" height="5" rx="0.8" fill="${P.panel}"/>
           ${[0, 1, 2].map((i) => `<rect x="${64.5 + i * 3}" y="55.5" width="1.6" height="3" fill="${P.steelHi}"/>`).join('')}
           <rect x="78" y="55" width="14" height="4" rx="1" fill="${P.trimHi}"/>
           ${meterLeads(66, 53)}`
        : `<rect x="58" y="52.5" width="44" height="9" rx="1.2" fill="url(#${p}-trim)"/>
           ${[0, 1, 2, 3].map((i) => `<rect x="${63 + i * 10}" y="55.5" width="6.5" height="1.1" rx="0.55" fill="${P.trimLo}"/>`).join('')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    ${defs(p)}
    ${ground(80, 47)}

    <!-- base cabinet -->
    <rect x="33" y="40" width="94" height="24" rx="2.5" fill="url(#${p}-steel)"/>
    <rect x="33" y="61.5" width="94" height="2.5" rx="1.2" fill="${P.steelEdge}"/>
    <rect x="33" y="40" width="94" height="1.6" rx="0.8" fill="white" opacity="0.22"/>
    <rect x="118" y="40" width="9" height="24" rx="2.5" fill="black" opacity="0.12"/>

    <!-- side vents -->
    ${[0, 1, 2].map((i) => `<rect x="${38 + i * 4}" y="53" width="1.6" height="8" rx="0.8" fill="${P.steelLo}"/>`).join('')}

    <!-- control strip: LED, display, warning -->
    <rect x="55" y="41.5" width="50" height="9.5" rx="1.6" fill="${P.panel}"/>
    ${led(61, 46.2, ledCol, 'machine-led--glow')}
    <rect x="66.5" y="43" width="27" height="6.6" rx="1" fill="${P.screen}"/>
    <text x="80" y="48.2" text-anchor="middle" font-family="'Courier New',monospace" font-size="5.4" font-weight="bold" fill="${scFill}" letter-spacing="1.2">${scText}</text>
    ${working ? '' : warnBadge(99.5, 46.2)}

    <!-- lower service bay / drip area -->
    ${serviceBay}

    <!-- bowls on top of the cabinet -->
    ${bowl(36, 'left')}
    ${bowl(82, 'right')}

    <!-- centre drive pillar between the bowls -->
    <rect x="77" y="7" width="6" height="34" fill="url(#${p}-steelH)"/>
    <rect x="77" y="7" width="1.4" height="34" fill="white" opacity="0.18"/>

    <!-- lids (removed during inspection; left one off while probing) -->
    ${open ? lidsAside : state === 'probe' ? lid(81) : `${lid(35)}${lid(81)}`}

    <!-- dispense taps in front of the cabinet -->
    ${tap(47)}
    ${tap(113)}

    <!-- interaction overlays -->
    ${state === 'probe' ? tempProbe(50, 34) : ''}
  </svg>`;
}

// ── Soft Serve Commercial (FrostKing 4500) ────────────────────────────────────
//
// Front elevation of a tall commercial soft serve unit. Two mix hoppers at
// the top, front service panel with digital display in the middle, status LED,
// two dispensing levers at the bottom.
//
// Fault   → depleted/darker hopper fluid, amber LED, amber screen (E-13), warning dot
// Open    → front panel removed to the side, barrel internals + evaporator coil visible
// Working → full cyan hopper fluid, green LED, temperature readout

function softServeSvg(state) {
  const working = state === 'working';
  const open = state === 'open';
  const p = `ss-${state}`;
  const scText = working ? '34°F' : 'E-13';
  const scFill = working ? P.ok : P.warn;
  const ledCol = working ? P.ok : P.warn;

  // Cream product colour — soft serve is the one machine whose product isn't
  // slush-cyan; the swirl on the drip tray is the "it works" money shot.
  const cream = '#f0e6d2';
  const creamLo = '#cfc0a4';

  /** Hopper lid on the top deck, seen face-on as a raised cap. */
  const hopperLid = (x) => `
    <rect x="${x}" y="4.5" width="23" height="8" rx="2.4" fill="url(#${p}-trim)"/>
    <rect x="${x + 7}" y="2.6" width="9" height="3" rx="1.4" fill="${P.trimHi}"/>
    <rect x="${x}" y="4.5" width="23" height="1.4" rx="0.7" fill="white" opacity="0.14"/>`;

  /** Dispense door: bolted steel plate with a spout under it. */
  const door = (x) => `
    <rect x="${x}" y="30.5" width="20" height="12.5" rx="1.6" fill="url(#${p}-steel)"/>
    <rect x="${x}" y="30.5" width="20" height="1.2" rx="0.6" fill="white" opacity="0.28"/>
    ${[[2.2, 32.7], [17.8, 32.7], [2.2, 41], [17.8, 41]]
      .map(([dx, dy]) => `<circle cx="${x + dx}" cy="${dy}" r="0.9" fill="${P.steelEdge}"/>`)
      .join('')}
    <rect x="${x + 7.6}" y="43" width="4.8" height="4" fill="${P.steelLo}"/>
    <rect x="${x + 6.6}" y="46.4" width="6.8" height="1.8" rx="0.9" fill="${P.steelEdge}"/>`;

  /** Pull lever hanging over each door plate. */
  const lever = (cx) => `
    <line x1="${cx}" y1="31" x2="${cx}" y2="34.5" stroke="${P.steelHi}" stroke-width="1.5"/>
    <rect x="${cx - 2.4}" y="34.5" width="4.8" height="7" rx="2.2" fill="${P.trimHi}"/>
    <rect x="${cx - 2.4}" y="34.5" width="4.8" height="1.5" rx="0.75" fill="white" opacity="0.22"/>`;

  // Behind the removable door plate: freeze barrel, beater, coil, wiring loom.
  const internals = `
    <rect x="56" y="29" width="48" height="20" rx="1.5" fill="#0c1322"/>
    <circle cx="72" cy="38.5" r="8.2" fill="url(#${p}-steelH)"/>
    <circle cx="72" cy="38.5" r="5.6" fill="${P.trimLo}"/>
    <path d="M 68.5 35.5 Q 72 38.5 75.5 41.5 M 75.5 35.5 Q 72 38.5 68.5 41.5"
      stroke="${P.steelHi}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <circle cx="72" cy="38.5" r="1.5" fill="${P.steelHi}"/>
    <path d="M 84 32 q 3 3 0 6 q -3 3 0 6 q 3 3 0 6" fill="none" stroke="#7ea4c4" stroke-width="1.4" opacity="0.8"/>
    <path d="M 89 32 q 3 3 0 6 q -3 3 0 6 q 3 3 0 6" fill="none" stroke="#7ea4c4" stroke-width="1.4" opacity="0.55"/>
    <path d="M 97 30 C 99 36, 96 42, 99 48" stroke="#b7793f" stroke-width="1.2" fill="none"/>
    <path d="M 99.5 30 C 101 36, 98.5 42, 101 48" stroke="${P.trimHi}" stroke-width="1.2" fill="none"/>`;

  // The removed door plate leaning against the machine's right flank.
  const plateAside = `
    <g transform="rotate(9 122 62)">
      <rect x="112" y="34" width="22" height="27" rx="1.6" fill="url(#${p}-steel)"/>
      <rect x="112" y="34" width="22" height="1.4" rx="0.7" fill="white" opacity="0.25"/>
      ${[[3, 4], [19, 4], [3, 23], [19, 23]]
        .map(([dx, dy]) => `<circle cx="${112 + dx}" cy="${34 + dy}" r="1" fill="${P.steelEdge}"/>`)
        .join('')}
    </g>
    <circle cx="47" cy="63" r="1.1" fill="${P.steelHi}"/>
    <circle cx="50.5" cy="64" r="1.1" fill="${P.steelHi}"/>`;

  // Fault storytelling: a sad drip under the left door; working earns a swirl.
  const drip = `
    <ellipse cx="67" cy="52.8" rx="4.5" ry="1" fill="${creamLo}" opacity="0.55"/>
    <circle cx="67" cy="49.5" r="0.9" fill="${cream}" opacity="0.8"/>`;
  const swirl = `
    <path d="M 74 52.5 L 70.5 45 L 77.5 45 Z" fill="#e8b96a"/>
    <path d="M 70.8 45 Q 74 47 77.2 45 L 76.6 46.8 Q 74 48.4 71.4 46.8 Z" fill="#d9a44a" opacity="0.6"/>
    <path d="M 71 44.9 Q 70 42.5 74 42.2 Q 78 42.5 77 44.9 Z" fill="${cream}"/>
    <path d="M 71.6 42.3 Q 70.8 39.9 74 39.7 Q 77.2 39.9 76.4 42.3 Z" fill="${cream}"/>
    <path d="M 72.4 39.8 Q 72 37.8 74 37.6 Q 76 37.8 75.6 39.8 Z" fill="${cream}"/>
    <path d="M 73.2 37.7 Q 73.4 36 74 35.6 Q 74.6 36.4 74.8 37.7 Z" fill="${cream}"/>
    <path d="M 72 44.5 Q 71.4 42.9 73 41.2" stroke="white" stroke-width="0.7" fill="none" opacity="0.5"/>`;

  // Lower louvred grille; a small access cover comes off for the leads state.
  const grille =
    state === 'leads'
      ? `${[0, 1, 2].map((i) => `<rect x="60" y="${56.5 + i * 2.4}" width="18" height="1.1" rx="0.55" fill="${P.steelLo}"/>`).join('')}
         <rect x="82" y="55.5" width="18" height="8" fill="${P.trimLo}"/>
         <rect x="84" y="57" width="7" height="5" rx="0.8" fill="${P.panel}"/>
         ${[0, 1, 2].map((i) => `<rect x="${85 + i * 2.2}" y="58" width="1.3" height="3" fill="${P.steelHi}"/>`).join('')}
         ${meterLeads(87, 55)}`
      : `${[0, 1, 2].map((i) => `<rect x="60" y="${56.5 + i * 2.4}" width="40" height="1.1" rx="0.55" fill="${P.steelLo}"/>`).join('')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    ${defs(p)}
    ${ground(80, 38)}

    <!-- tall body -->
    <rect x="52" y="3" width="56" height="62" rx="3" fill="url(#${p}-steel)"/>
    <rect x="52" y="3" width="3.5" height="62" rx="1.7" fill="white" opacity="0.14"/>
    <rect x="100" y="3" width="8" height="62" rx="3" fill="black" opacity="0.14"/>
    <rect x="52" y="62.5" width="56" height="2.5" rx="1.2" fill="${P.steelEdge}"/>

    <!-- top deck with hopper lids (left lid off while probing) -->
    <rect x="53.5" y="12" width="53" height="3" fill="${P.steelLo}"/>
    ${state === 'probe'
      ? `${hopperLid(83)}
         <rect x="57" y="8.5" width="21" height="4.5" rx="1" fill="#0c1322"/>
         <rect x="57.8" y="9.2" width="19.4" height="3.1" fill="${creamLo}" opacity="0.5"/>`
      : `${hopperLid(56)}${hopperLid(83)}`}

    <!-- brand strip -->
    <rect x="55" y="16.5" width="50" height="4.5" rx="1" fill="${P.trimLo}"/>
    <text x="80" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="3.2" font-weight="bold" fill="${P.steelHi}" letter-spacing="1.6">FROSTKING</text>

    <!-- control strip: LED / screen / warn -->
    <rect x="55" y="22.5" width="50" height="6.5" rx="1.2" fill="${P.panel}"/>
    ${led(60, 25.7, ledCol, 'machine-led--glow')}
    <rect x="65.5" y="23.5" width="21" height="4.6" rx="0.8" fill="${P.screen}"/>
    <text x="76" y="27.3" text-anchor="middle" font-family="'Courier New',monospace" font-size="4" font-weight="bold" fill="${scFill}" letter-spacing="0.8">${scText}</text>
    ${working ? `<circle cx="99" cy="25.7" r="1.7" fill="${P.ok}" opacity="0.85"/>` : warnBadge(98.5, 25.7)}

    <!-- dispense zone: bolted doors, or the exposed barrel when open -->
    ${open ? internals : `${door(58)}${door(82)}${lever(68)}${lever(92)}`}

    <!-- drip tray -->
    <rect x="60" y="51.5" width="40" height="3.4" rx="1.4" fill="${P.trimLo}"/>
    <rect x="61.5" y="52.3" width="37" height="1.6" rx="0.8" fill="${P.panel}"/>

    <!-- lower grille -->
    ${grille}

    <!-- state dressing -->
    ${open ? plateAside : ''}
    ${working ? swirl : ''}
    ${['fault', 'probe', 'leads'].includes(state) ? drip : ''}
    ${state === 'ajar'
      ? `<rect x="58" y="30.5" width="20" height="12.5" rx="1.6" fill="#0c1322"/>
         <g transform="rotate(-16 58 44)">
           <rect x="56.5" y="32.5" width="20" height="12.5" rx="1.6" fill="url(#${p}-steel)"/>
           <rect x="56.5" y="32.5" width="20" height="1.2" rx="0.6" fill="white" opacity="0.28"/>
           <circle cx="59" cy="35" r="0.9" fill="${P.steelEdge}"/>
           <circle cx="74" cy="35" r="0.9" fill="${P.steelEdge}"/>
         </g>
         <rect x="84" y="52" width="12" height="1.9" rx="0.95" fill="#d9a44a"/>
         <rect x="94.5" y="51.3" width="4.5" height="3.3" rx="1.1" fill="${P.trimHi}"/>`
      : ''}
    ${state === 'probe' ? tempProbe(64, 12) : ''}
  </svg>`;
}

// ── Froyo Multihead (YogurtMaster 3000) ──────────────────────────────────────
//
// Wide counter unit with three dispense heads in a row, hopper covers on the
// top deck, digital panel, full-width drip tray. The face plate over the head
// zone is the removable service panel.

function froyoSvg(state) {
  const working = state === 'working';
  const open = state === 'open';
  const p = `fy-${state}`;
  const scText = working ? 'Y-3K' : 'LOCK';
  const scFill = working ? P.ok : P.warn;
  const ledCol = working ? P.ok : P.warn;

  /** Hopper cover on the top deck. */
  const cover = (x) => `
    <path d="M ${x} 11 Q ${x} 4.5 ${x + 6} 4.2 L ${x + 18} 4.2 Q ${x + 24} 4.5 ${x + 24} 11 Z" fill="url(#${p}-trim)"/>
    <rect x="${x + 8}" y="2.2" width="8" height="3" rx="1.4" fill="${P.trimHi}"/>
    <rect x="${x + 1}" y="4.8" width="5" height="1.6" rx="0.8" fill="white" opacity="0.12"/>`;

  /** One dispense head: housing, nozzle, pull handle. */
  const head = (cx) => `
    <rect x="${cx - 11}" y="27" width="22" height="14" rx="2.2" fill="url(#${p}-trim)"/>
    <rect x="${cx - 11}" y="27" width="22" height="1.4" rx="0.7" fill="white" opacity="0.16"/>
    <rect x="${cx - 2.4}" y="41" width="4.8" height="4.4" fill="${P.steelLo}"/>
    <rect x="${cx - 3.2}" y="44.8" width="6.4" height="1.7" rx="0.85" fill="${P.steelEdge}"/>
    <line x1="${cx + 7}" y1="33" x2="${cx + 7}" y2="36" stroke="${P.steelHi}" stroke-width="1.4"/>
    <rect x="${cx + 4.9}" y="36" width="4.2" height="6.2" rx="2" fill="${P.trimHi}"/>
    <circle cx="${cx - 5.5}" cy="31" r="1" fill="${P.steelEdge}"/>`;

  // Open: face plate off — three barrels, solenoid blocks, manifold line.
  const barrel = (cx, side) => `
    <rect x="${cx - 7}" y="27.5" width="14" height="17" rx="1.4" fill="url(#${p}-glass)"/>
    ${working
      ? `<rect x="${cx - 7}" y="31" width="14" height="13.5" fill="url(#${p}-fluid)" opacity="0.85"${side ? ` class="machine-fluid--${side}"` : ''}/>`
      : `<rect x="${cx - 7}" y="38" width="14" height="6.5" fill="${P.fluidFlt}" opacity="0.6"/>`}
    <rect x="${cx - 7}" y="27.5" width="2.5" height="17" fill="white" opacity="0.08"/>
    <rect x="${cx - 4}" y="45.5" width="8" height="3.6" rx="0.8" fill="${P.trimHi}"/>`;
  const internals = `
    <rect x="32" y="25.5" width="96" height="24.5" rx="1.5" fill="#0c1322"/>
    <rect x="34" y="26.5" width="92" height="2" rx="1" fill="${P.steelLo}"/>
    ${barrel(48, 'left')}${barrel(80, '')}${barrel(112, 'right')}
    <path d="M 60 30 L 71 30 M 92 30 L 103 30" stroke="#7ea4c4" stroke-width="1.3" opacity="0.7"/>`;
  const plateAside = `
    <g transform="rotate(10 146 62)">
      <rect x="136" y="30" width="16" height="32" rx="1.8" fill="url(#${p}-steel)"/>
      <rect x="136" y="30" width="16" height="1.4" rx="0.7" fill="white" opacity="0.25"/>
    </g>
    <circle cx="36" cy="62.5" r="1.1" fill="${P.steelHi}"/>
    <circle cx="40" cy="63.5" r="1.1" fill="${P.steelHi}"/>`;

  const grate = `${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${40 + i * 11}" y="53" width="7" height="1.2" rx="0.6" fill="${P.panel}"/>`).join('')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    ${defs(p)}
    ${ground(80, 55)}

    <!-- cabinet -->
    <rect x="26" y="13" width="108" height="51" rx="3" fill="url(#${p}-steel)"/>
    <rect x="26" y="13" width="3.5" height="51" rx="1.7" fill="white" opacity="0.13"/>
    <rect x="126" y="13" width="8" height="51" rx="3" fill="black" opacity="0.14"/>
    <rect x="26" y="61.5" width="108" height="2.5" rx="1.2" fill="${P.steelEdge}"/>

    <!-- top deck + hopper covers (middle cover off while probing) -->
    <rect x="28" y="10" width="104" height="4" fill="${P.steelLo}"/>
    ${state === 'probe'
      ? `${cover(32)}${cover(104)}
         <rect x="70" y="6.5" width="20" height="6" rx="1" fill="#0c1322"/>
         <rect x="70.8" y="8" width="18.4" height="4" fill="${P.fluidFlt}" opacity="0.5"/>`
      : `${cover(32)}${cover(68)}${cover(104)}`}

    <!-- control strip -->
    <rect x="54" y="16.5" width="52" height="8" rx="1.4" fill="${P.panel}"/>
    ${led(60, 20.5, ledCol, 'machine-led--glow')}
    <rect x="66" y="17.8" width="27" height="5.4" rx="0.9" fill="${P.screen}"/>
    <text x="79.5" y="22.2" text-anchor="middle" font-family="'Courier New',monospace" font-size="4.6" font-weight="bold" fill="${scFill}" letter-spacing="1.4">${scText}</text>
    ${working ? '' : warnBadge(100, 20.5)}

    <!-- head zone: three heads, or the exposed barrels when open -->
    ${open ? internals : `${head(44)}${head(80)}${head(116)}`}

    <!-- drip tray -->
    <rect x="36" y="51.5" width="88" height="4" rx="1.6" fill="${P.trimLo}"/>
    ${grate}

    <!-- lower vents / leads access -->
    ${state === 'leads'
      ? `${[0, 1].map((i) => `<rect x="${40 + i * 5}" y="58" width="2" height="4.5" rx="1" fill="${P.steelLo}"/>`).join('')}
         <rect x="56" y="57" width="20" height="6.5" fill="${P.trimLo}"/>
         <rect x="58" y="58.2" width="8" height="4.2" rx="0.8" fill="${P.panel}"/>
         ${[0, 1, 2].map((i) => `<rect x="${59.5 + i * 2.4}" y="59.2" width="1.4" height="2.4" fill="${P.steelHi}"/>`).join('')}
         ${meterLeads(61, 56.5)}`
      : `${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${40 + i * 5}" y="58" width="2" height="4.5" rx="1" fill="${P.steelLo}"/>`).join('')}`}

    <!-- state dressing -->
    ${open ? plateAside : ''}
    ${working ? `${miniSwirl(44, 51)}${miniSwirl(80, 51)}${miniSwirl(116, 51)}` : ''}
    ${['fault', 'probe', 'leads'].includes(state)
      ? `<circle cx="80" cy="48.8" r="0.9" fill="#e6d9f2" opacity="0.7"/>
         <ellipse cx="80" cy="51.4" rx="3.6" ry="0.9" fill="#9a8fb5" opacity="0.4"/>`
      : ''}
    ${state === 'ajar'
      ? `<rect x="105" y="27" width="22" height="14" rx="2.2" fill="#0c1322"/>
         <g transform="rotate(-14 105 41)">
           <rect x="103.5" y="29" width="22" height="14" rx="2.2" fill="url(#${p}-trim)"/>
           <rect x="103.5" y="29" width="22" height="1.4" rx="0.7" fill="white" opacity="0.16"/>
         </g>
         <rect x="46" y="51.7" width="12" height="1.9" rx="0.95" fill="#d9a44a"/>
         <rect x="56.5" y="51" width="4.5" height="3.3" rx="1.1" fill="${P.trimHi}"/>`
      : ''}
    ${state === 'probe' ? tempProbe(76, 10) : ''}
  </svg>`;
}

// ── Granita / Slushie Triple-Bowl (GlacierGlide) ─────────────────────────────
//
// Three tall tapered bowls of granita over a stainless base, spiral augers,
// a tap under each bowl, compact control pod on the left end of the base.
// Outer augers reuse the CSS agitator classes (origins 47px / 112px).

function granitaSvg(state) {
  const working = state === 'working';
  const open = state === 'open';
  const p = `gr-${state}`;
  const scText = working ? 'CHILL' : 'E-21';
  const scFill = working ? P.ok : P.warn;
  const ledCol = working ? P.ok : P.warn;

  /** Tapered bowl with granita, auger, rim; auger lifted when open. */
  const bowl = (cx, augerCls, side) => {
    const lift = open ? -8 : 0;
    const st = 12 + lift;
    const fluid = working
      ? `<path d="M ${cx - 13} 16 L ${cx + 13} 16 L ${cx + 9.5} 40 L ${cx - 9.5} 40 Z" fill="url(#${p}-fluid)" opacity="0.88"${side ? ` class="machine-fluid--${side}"` : ''}/>
         ${[[-6, 21], [3, 25], [-2, 31], [6, 34], [-7, 35]].map(([dx, dy]) => `<circle cx="${cx + dx}" cy="${dy}" r="0.7" fill="white" opacity="0.55"/>`).join('')}`
      : `<path d="M ${cx - 11.2} 30 L ${cx + 11.2} 30 L ${cx + 9.5} 40 L ${cx - 9.5} 40 Z" fill="${P.fluidFlt}" opacity="0.6"/>
         <rect x="${cx - 11.5}" y="30" width="23" height="1.1" fill="#3a6a84" opacity="0.5"/>
         <rect x="${cx - 12.2}" y="24" width="24.4" height="0.9" fill="#3a6a84" opacity="0.2"/>`;
    const auger = `
      <g${augerCls && working ? ` class="${augerCls}"` : ''}>
        <line x1="${cx}" y1="${10 + lift}" x2="${cx}" y2="38.5" stroke="${P.steelHi}" stroke-width="1.6"/>
        <path d="M ${cx - 4.5} ${st}
                 C ${cx + 6} ${st + 3}, ${cx - 6} ${st + 6}, ${cx + 4.5} ${st + 9}
                 C ${cx - 6} ${st + 12}, ${cx + 6} ${st + 15}, ${cx - 4.5} ${st + 18}
                 ${lift ? '' : `C ${cx + 6} ${st + 21}, ${cx - 4} ${st + 23.5}, ${cx + 3.5} ${st + 24.5}`}"
          fill="none" stroke="${P.steelHi}" stroke-width="1.4" stroke-linecap="round" opacity="0.95"/>
      </g>`;
    return `
      <path d="M ${cx - 15.5} 9 L ${cx + 15.5} 9 L ${cx + 12} 41.5 L ${cx - 12} 41.5 Z" fill="${P.steelEdge}"/>
      <path d="M ${cx - 14} 10.5 L ${cx + 14} 10.5 L ${cx + 10.8} 40 L ${cx - 10.8} 40 Z" fill="url(#${p}-glass)"/>
      ${fluid}
      ${auger}
      <path d="M ${cx - 12.5} 11 L ${cx - 8.5} 11 L ${cx - 10.5} 38 L ${cx - 11.8} 38 Z" fill="white" opacity="0.09"/>
      <path d="M ${cx + 7} 11 L ${cx + 13} 11 L ${cx + 10.5} 39 L ${cx + 9} 39 Z" fill="black" opacity="0.15"/>`;
  };

  /** Flat lid cap; removed during open/probe states. */
  const cap = (cx) => `
    <rect x="${cx - 15}" y="5" width="30" height="5" rx="2" fill="url(#${p}-trim)"/>
    <rect x="${cx - 4.5}" y="3" width="9" height="2.8" rx="1.3" fill="${P.trimHi}"/>`;

  /** Tap under a bowl, in front of the base. */
  const tap = (cx) => `
    <rect x="${cx - 5.5}" y="44" width="11" height="6" rx="1.5" fill="url(#${p}-steelH)"/>
    <rect x="${cx - 5.5}" y="44" width="11" height="1.1" rx="0.55" fill="white" opacity="0.25"/>
    <rect x="${cx - 1.5}" y="49.6" width="3" height="3.2" fill="${P.steelLo}"/>
    <rect x="${cx - 2.4}" y="52.2" width="4.8" height="1.5" rx="0.75" fill="${P.steelEdge}"/>
    <rect x="${cx - 2}" y="38.8" width="4" height="5.6" rx="1.9" fill="${P.trimHi}"/>`;

  const capsAside = `
    <g transform="rotate(-62 146 63)">
      <rect x="146" y="60" width="26" height="5" rx="2" fill="url(#${p}-trim)"/>
    </g>
    <ellipse cx="14" cy="64" rx="10" ry="2.2" fill="${P.trimLo}"/>
    <rect x="5" y="61.2" width="18" height="3.4" rx="1.6" fill="url(#${p}-trim)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    ${defs(p)}
    ${ground(80, 57)}

    <!-- base -->
    <rect x="24" y="42" width="112" height="22" rx="2.5" fill="url(#${p}-steel)"/>
    <rect x="24" y="42" width="112" height="1.5" rx="0.75" fill="white" opacity="0.2"/>
    <rect x="24" y="61.5" width="112" height="2.5" rx="1.2" fill="${P.steelEdge}"/>
    <rect x="128" y="42" width="8" height="22" rx="2.5" fill="black" opacity="0.12"/>

    <!-- control pod (left end of the base) -->
    <rect x="27" y="44" width="17" height="16" rx="1.6" fill="${P.panel}"/>
    ${led(35.5, 47.5, ledCol, 'machine-led--glow')}
    <rect x="29" y="50.5" width="13" height="4.8" rx="0.8" fill="${P.screen}"/>
    <text x="35.5" y="54.4" text-anchor="middle" font-family="'Courier New',monospace" font-size="3.4" font-weight="bold" fill="${scFill}" letter-spacing="0.4">${scText}</text>
    ${working ? '' : warnBadge(35.5, 58.2)}

    <!-- bowls (CSS agitator origins expect 47 / 112) -->
    ${bowl(47, 'machine-agitator-group--left', 'left')}
    ${bowl(80, 'machine-agitator-group--center', '')}
    ${bowl(112, 'machine-agitator-group--right', 'right')}

    <!-- lid caps -->
    ${open ? capsAside : state === 'probe' ? `${cap(80)}${cap(112)}` : `${cap(47)}${cap(80)}${cap(112)}`}

    <!-- taps -->
    ${tap(53)}${tap(86)}${tap(118)}

    <!-- drip channel -->
    <rect x="46" y="56.5" width="80" height="3" rx="1.4" fill="${P.trimLo}"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${50 + i * 10.5}" y="57.3" width="6.5" height="1.3" rx="0.6" fill="${P.panel}"/>`).join('')}

    <!-- interaction dressing -->
    ${state === 'leads'
      ? `<rect x="98" y="44.5" width="18" height="7" fill="${P.trimLo}"/>
         <rect x="100" y="45.8" width="7" height="4.4" rx="0.8" fill="${P.panel}"/>
         ${[0, 1, 2].map((i) => `<rect x="${101.2 + i * 2.2}" y="46.8" width="1.3" height="2.4" fill="${P.steelHi}"/>`).join('')}
         ${meterLeads(103, 44)}`
      : ''}
    ${state === 'ajar'
      ? `<rect x="52" y="44.5" width="26" height="8" fill="${P.trimLo}"/>
         <g transform="rotate(-10 52 52.5)">
           <rect x="51" y="45.5" width="26" height="8" rx="1.2" fill="url(#${p}-steelH)"/>
         </g>
         <rect x="96" y="53.4" width="11" height="1.8" rx="0.9" fill="#d9a44a"/>
         <rect x="105.5" y="52.8" width="4" height="3" rx="1" fill="${P.trimHi}"/>`
      : ''}
    ${state === 'probe' ? tempProbe(42, 30) : ''}
  </svg>`;
}

// ── Commercial Ice Dispenser (IceO-Matic 9000) ───────────────────────────────
//
// Hotel-corridor style floor unit: louvred bin section up top, dark dispense
// alcove with a push paddle and chute, drip grate, vented kick panel.

function iceMakerSvg(state) {
  const working = state === 'working';
  const open = state === 'open';
  const p = `im-${state}`;
  const scText = working ? 'ICE' : 'BIN!';
  const scFill = working ? P.ok : P.warn;
  const ledCol = working ? P.ok : P.warn;

  const louvres = `${[0, 1, 2, 3].map((i) => `
    <rect x="57" y="${9 + i * 4.2}" width="46" height="2.4" rx="1.2" fill="url(#${p}-trim)"/>
    <rect x="57" y="${9 + i * 4.2}" width="46" height="0.8" rx="0.4" fill="white" opacity="0.10"/>`).join('')}`;

  // Open: louvre panel off, bin interior with a horizontal delivery auger.
  const binInterior = `
    <rect x="55" y="7.5" width="50" height="18.5" rx="1.5" fill="#0c1322"/>
    ${[[60, 22], [66, 23], [73, 21.5], [81, 23], [88, 22], [95, 23], [63, 19.5], [78, 19], [92, 19.5]]
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="3" rx="1" fill="#bcd9f0" opacity="0.75"/>`)
      .join('')}
    <line x1="58" y1="14" x2="102" y2="14" stroke="${P.steelHi}" stroke-width="1.4"/>
    <path d="M 60 11.5 C 66 16.5, 70 11.5, 76 16.5 C 82 11.5, 86 16.5, 92 11.5 C 96 15, 99 12, 101 14.5"
      fill="none" stroke="${P.steelHi}" stroke-width="1.2" opacity="0.85"/>
    <g transform="rotate(78 128 58)">
      <rect x="118" y="52" width="34" height="12" rx="1.6" fill="url(#${p}-steel)"/>
      ${[0, 1, 2].map((i) => `<rect x="${121 + i * 10}" y="${56}" width="7" height="1.6" rx="0.8" fill="${P.trimLo}"/>`).join('')}
    </g>`;

  // Working: cubes tumbling into the alcove + a small pile.
  const iceOut = `
    ${[[74, 47.5], [79, 48], [84, 47.6], [77, 45.6], [82, 45.8]]
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="4.2" height="3.4" rx="1" fill="#cfe6f7" opacity="0.9"/>`)
      .join('')}
    <rect x="79" y="41.5" width="3.6" height="3" rx="0.9" fill="#e4f2fb" opacity="0.8"/>
    <circle cx="76" cy="43" r="0.5" fill="white" opacity="0.8"/>
    <circle cx="85" cy="44.5" r="0.5" fill="white" opacity="0.7"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    ${defs(p)}
    ${ground(80, 36)}

    <!-- tall body -->
    <rect x="52" y="3" width="56" height="61" rx="3" fill="url(#${p}-steel)"/>
    <rect x="52" y="3" width="3.5" height="61" rx="1.7" fill="white" opacity="0.14"/>
    <rect x="100" y="3" width="8" height="61" rx="3" fill="black" opacity="0.14"/>
    <rect x="52" y="61.5" width="56" height="2.5" rx="1.2" fill="${P.steelEdge}"/>
    <rect x="55" y="4.5" width="50" height="2.4" rx="1.2" fill="${P.steelLo}"/>

    <!-- bin section: louvres, or interior when open -->
    ${open ? binInterior : louvres}

    <!-- control strip -->
    <rect x="55" y="27.5" width="50" height="6.5" rx="1.2" fill="${P.panel}"/>
    ${led(60, 30.7, ledCol, 'machine-led--glow')}
    <rect x="65.5" y="28.5" width="21" height="4.6" rx="0.8" fill="${P.screen}"/>
    <text x="76" y="32.3" text-anchor="middle" font-family="'Courier New',monospace" font-size="4" font-weight="bold" fill="${scFill}" letter-spacing="0.8">${scText}</text>
    ${working ? `<circle cx="99" cy="30.7" r="1.7" fill="${P.ok}" opacity="0.85"/>` : warnBadge(98.5, 30.7)}

    <!-- dispense alcove -->
    <rect x="58" y="36" width="44" height="16" rx="2" fill="#0c1322"/>
    <rect x="58" y="36" width="44" height="16" rx="2" fill="url(#${p}-glass)" opacity="0.4"/>
    <rect x="73" y="36" width="14" height="4.5" fill="${P.steelLo}"/>
    <rect x="74.5" y="40.5" width="11" height="7.5" rx="1.2" fill="${P.trimHi}"/>
    <rect x="74.5" y="40.5" width="11" height="1.4" rx="0.7" fill="white" opacity="0.2"/>
    ${working ? iceOut : ''}

    <!-- drip grate -->
    <rect x="58" y="54" width="44" height="4" rx="1.4" fill="${P.trimLo}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${61 + i * 8}" y="55" width="5" height="1.6" rx="0.8" fill="${P.panel}"/>`).join('')}

    <!-- kick vents / leads access -->
    ${state === 'leads'
      ? `<rect x="58" y="59.5" width="20" height="4" fill="${P.trimLo}"/>
         <rect x="60" y="59.8" width="7" height="3.4" rx="0.7" fill="${P.panel}"/>
         ${[0, 1, 2].map((i) => `<rect x="${61.2 + i * 2.2}" y="60.4" width="1.3" height="2.2" fill="${P.steelHi}"/>`).join('')}
         ${meterLeads(63, 58.5)}`
      : `${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${59 + i * 6.4}" y="59.5" width="3.6" height="1.4" rx="0.7" fill="${P.steelLo}"/>`).join('')}`}

    <!-- fault storytelling: melt puddle creeping out from under the unit -->
    ${['fault', 'probe', 'leads', 'ajar'].includes(state)
      ? `<ellipse cx="94" cy="65.6" rx="9" ry="1.6" fill="#3d6a8f" opacity="0.45"/>
         <ellipse cx="99" cy="66" rx="4" ry="1" fill="#4d7ba0" opacity="0.4"/>`
      : ''}
    ${state === 'ajar'
      ? `<rect x="57" y="21.6" width="46" height="4.6" fill="#0c1322"/>
         <g transform="rotate(-5 57 26)">
           <rect x="56" y="22.4" width="46" height="3.4" rx="1.2" fill="url(#${p}-trim)"/>
         </g>
         <rect x="86" y="52.4" width="11" height="1.8" rx="0.9" fill="#d9a44a"/>
         <rect x="95.5" y="51.8" width="4" height="3" rx="1" fill="${P.trimHi}"/>`
      : ''}
    ${state === 'probe'
      ? `<rect x="57" y="9" width="46" height="2.6" fill="#0c1322"/>
         ${tempProbe(66, 12)}`
      : ''}
  </svg>`;
}
