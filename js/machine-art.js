/** @file Inline SVG machine illustrations for the .art-slot frame.
 *
 * States:
 *   'fault'   — machine showing symptoms, panel closed (shown before any tests run)
 *   'open'    — panel open, machine being inspected (shown after first test run)
 *   'working' — machine fixed and running (used on invoice screen / preview tool)
 *
 * Returns null for unknown machine IDs so callers can render a text fallback.
 *
 * Palette is hardcoded so art looks consistent in both the game and the standalone
 * preview tool (machine-css-preview.html) without requiring CSS custom properties.
 */

const P = {
  body:     '#354055',  // machine casing
  bodyHi:   '#4a5470',  // raised panels, lid highlights
  glass:    '#1a2f4a',  // bowl / hopper glass (dark tint)
  fluidOk:  '#38bdf8',  // product in good condition (matches --accent family)
  fluidFlt: '#1e5a7a',  // product in fault state (darker, looks frozen/depleted)
  metal:    '#5b6880',  // chrome trim, taps
  metalHi:  '#8fa3ba',  // bright chrome, drive shafts
  panel:    '#252d40',  // recessed control panel
  screen:   '#0d1525',  // display screen background
  ok:       '#22d3ee',  // ready indicator (matches --accent)
  warn:     '#f59e0b',  // fault indicator (matches --warn)
  shadow:   'rgba(0,0,0,0.35)',
};

/**
 * Returns inline SVG markup for a machine in the given display state.
 * @param {string} machineId  matches the id field in machines.json
 * @param {'fault'|'open'|'working'} state
 * @returns {string|null} SVG markup string, or null if no art for this machine
 */
export function machineSvg(machineId, state) {
  if (machineId === 'slushie-machine')       return slushieSvg(state);
  if (machineId === 'soft-serve-commercial') return softServeSvg(state);
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
  const fl  = working ? P.fluidOk : P.fluidFlt;
  const flo = working ? '0.82'    : '0.4';
  const led = working ? P.ok      : P.warn;
  const sc  = working ? P.ok      : P.warn;
  const stx = working ? 'COOL'    : 'E-04';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true">
    <ellipse cx="80" cy="67" rx="50" ry="3.5" fill="${P.shadow}"/>

    <!-- base unit -->
    <rect x="18" y="43" width="124" height="22" rx="3" fill="${P.body}"/>
    <rect x="18" y="43" width="124" height="4"  rx="3" fill="${P.bodyHi}"/>

    <!-- twin bowl outer frame -->
    <rect x="16" y="7" width="128" height="37" rx="4" fill="${P.body}"/>
    <!-- centre divider wall -->
    <rect x="77" y="7" width="6" height="37" fill="${P.bodyHi}"/>

    <!-- left bowl: glass background, then fluid fill -->
    <rect x="20" y="10" width="55" height="32" rx="3" fill="${P.glass}"/>
    <rect x="20" y="26" width="55" height="16" fill="${fl}" opacity="${flo}"/>

    <!-- right bowl -->
    <rect x="85" y="10" width="55" height="32" rx="3" fill="${P.glass}"/>
    <rect x="85" y="26" width="55" height="16" fill="${fl}" opacity="${flo}"/>

    <!-- agitator cross-paddles (open state — machine opened for inspection) -->
    ${state === 'open' ? `
    <line x1="47" y1="13" x2="47"  y2="39" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="34" y1="26" x2="60"  y2="26" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="112" y1="13" x2="112" y2="39" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="99"  y1="26" x2="125" y2="26" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    ` : ''}

    <!-- bowl top rim strip (drawn over fluid so it frames the bowls cleanly) -->
    <rect x="16" y="7" width="128" height="5" rx="3" fill="${P.bodyHi}"/>

    <!-- lid caps (not shown in open state — they've been removed) -->
    ${state !== 'open' ? `
    <rect x="21" y="3" width="53" height="7" rx="3" fill="${P.bodyHi}"/>
    <rect x="86" y="3" width="53" height="7" rx="3" fill="${P.bodyHi}"/>
    ` : ''}

    <!-- glass glints -->
    <rect x="22" y="12" width="9" height="3" rx="1" fill="white" opacity="0.18"/>
    <rect x="87" y="12" width="9" height="3" rx="1" fill="white" opacity="0.18"/>

    <!-- control panel recess -->
    <rect x="45" y="47" width="70" height="13" rx="2" fill="${P.panel}"/>

    <!-- status LED + glow halo -->
    <circle cx="54"  cy="53.5" r="5.5" fill="${led}" opacity="0.2"/>
    <circle cx="54"  cy="53.5" r="3.5" fill="${led}"/>

    <!-- fault warning dot (second indicator, right side of panel) -->
    ${!working ? `
    <circle cx="107" cy="53.5" r="3.5" fill="${P.warn}"/>
    <text x="107" y="56.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.5" font-weight="bold" fill="#1a1a2e">!</text>
    ` : ''}

    <!-- small display -->
    <rect x="63" y="48.5" width="36" height="10" rx="1" fill="${P.screen}"/>
    <text x="81" y="56.5" text-anchor="middle" font-family="'Courier New',monospace" font-size="7.5" fill="${sc}" letter-spacing="1">${stx}</text>

    <!-- left dispensing tap -->
    <rect x="27" y="58" width="15" height="6" rx="2" fill="${P.metal}"/>
    <rect x="32" y="62" width="5"  height="7" rx="1" fill="${P.metalHi}"/>

    <!-- right dispensing tap -->
    <rect x="118" y="58" width="15" height="6" rx="2" fill="${P.metal}"/>
    <rect x="123" y="62" width="5"  height="7" rx="1" fill="${P.metalHi}"/>
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
  const fl  = working ? P.fluidOk : P.fluidFlt;
  const flo = working ? '0.80'    : '0.35';
  const led = working ? P.ok      : P.warn;
  const sc  = working ? P.ok      : P.warn;
  const stx = working ? '34&#176;F' : 'E-13';  // &#176; = °

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true">
    <ellipse cx="80" cy="67" rx="36" ry="3" fill="${P.shadow}"/>

    <!-- machine body -->
    <rect x="42" y="3" width="76" height="62" rx="4" fill="${P.body}"/>
    <!-- left-edge highlight and right-edge depth shadow -->
    <rect x="42" y="3" width="6"  height="62" rx="4" fill="${P.bodyHi}" opacity="0.5"/>
    <rect x="112" y="3" width="6" height="62" rx="4" fill="${P.shadow}" opacity="0.45"/>

    <!-- mix hoppers (two transparent containers at top) -->
    <rect x="50" y="5"  width="24" height="14" rx="2" fill="${P.glass}"/>
    <rect x="86" y="5"  width="24" height="14" rx="2" fill="${P.glass}"/>
    <!-- hopper top rim -->
    <rect x="50" y="5"  width="24" height="3"  rx="2" fill="${P.bodyHi}"/>
    <rect x="86" y="5"  width="24" height="3"  rx="2" fill="${P.bodyHi}"/>
    <!-- hopper fluid level -->
    <rect x="51" y="13" width="22" height="6"  fill="${fl}" opacity="${flo}"/>
    <rect x="87" y="13" width="22" height="6"  fill="${fl}" opacity="${flo}"/>
    <!-- hopper glass glints -->
    <rect x="53" y="7"  width="7"  height="2.5" rx="1" fill="white" opacity="0.2"/>
    <rect x="89" y="7"  width="7"  height="2.5" rx="1" fill="white" opacity="0.2"/>

    <!-- status LED + glow (top-right of machine body) -->
    <circle cx="111" cy="8" r="5.5" fill="${led}" opacity="0.2"/>
    <circle cx="111" cy="8" r="3.5" fill="${led}"/>

    <!-- front service panel + display, OR internals when open -->
    ${state === 'open' ? `
    <!-- panel swung to the right (partially exits viewBox — looks natural) -->
    <rect x="118" y="18" width="58" height="22" rx="2" fill="${P.panel}" transform="rotate(18,118,18)"/>
    <!-- barrel (freeze cylinder) -->
    <ellipse cx="80" cy="31" rx="22" ry="8"  fill="${P.glass}"/>
    <ellipse cx="80" cy="31" rx="16" ry="5"  fill="${fl}" opacity="0.65"/>
    <!-- drive shaft -->
    <line x1="80" y1="23" x2="80" y2="39" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    <!-- evaporator coil suggestion -->
    <path d="M 58 37 Q 65 42 72 37 Q 79 32 86 37 Q 93 42 102 37" fill="none" stroke="${P.metalHi}" stroke-width="1.5" opacity="0.6"/>
    <!-- fault marker remains visible while the panel is open -->
    <circle cx="104" cy="30" r="4" fill="${P.warn}" opacity="0.9"/>
    <text x="104" y="33.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6" font-weight="bold" fill="#1a1a2e">!</text>
    ` : `
    <!-- front service panel (closed) -->
    <rect x="48" y="21" width="64" height="20" rx="2" fill="${P.panel}"/>
    <!-- display screen -->
    <rect x="52" y="23" width="56" height="14" rx="1" fill="${P.screen}"/>
    <text x="80" y="33" text-anchor="middle" font-family="'Courier New',monospace" font-size="8" fill="${sc}" letter-spacing="1.5">${stx}</text>
    <!-- panel corner screws (decorative) -->
    <circle cx="51"  cy="23" r="1.5" fill="${P.metalHi}" opacity="0.5"/>
    <circle cx="111" cy="23" r="1.5" fill="${P.metalHi}" opacity="0.5"/>
    <circle cx="51"  cy="39" r="1.5" fill="${P.metalHi}" opacity="0.5"/>
    <circle cx="111" cy="39" r="1.5" fill="${P.metalHi}" opacity="0.5"/>
    ${state === 'fault' ? `
    <!-- fault warning dot below display -->
    <circle cx="80" cy="39" r="0" fill="transparent"/>
    <circle cx="104" cy="30" r="4" fill="${P.warn}" opacity="0.9"/>
    <text x="104" y="33.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="6" font-weight="bold" fill="#1a1a2e">!</text>
    ` : ''}
    `}

    <!-- bezel strip separating panel zone from dispense zone -->
    <rect x="42" y="44" width="76" height="3" fill="${P.bodyHi}"/>

    <!-- left dispense housing + lever -->
    <rect x="50" y="48" width="22" height="16" rx="3" fill="${P.metal}"/>
    <rect x="57" y="54" width="8"  height="13" rx="2" fill="${P.metalHi}"/>

    <!-- right dispense housing + lever -->
    <rect x="88" y="48" width="22" height="16" rx="3" fill="${P.metal}"/>
    <rect x="95" y="54" width="8"  height="13" rx="2" fill="${P.metalHi}"/>
  </svg>`;
}
