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

const GENERATED_MACHINES = {
  'slushie-machine': {
    fault: 'assets/generated/slushie-machine-fault.webp',
    open: 'assets/generated/slushie-machine-open.webp',
    working: 'assets/generated/slushie-machine-working.webp',
  },
  'soft-serve-commercial': {
    fault: 'assets/generated/soft-serve-commercial-fault.webp',
    open: 'assets/generated/soft-serve-commercial-open.webp',
    working: 'assets/generated/soft-serve-commercial-working.webp',
  },
  'froyo-multihead': {
    fault: 'assets/generated/froyo-multihead-fault.webp',
    open: 'assets/generated/froyo-multihead-open.webp',
    working: 'assets/generated/froyo-multihead-working.webp',
  },
  'granita-slushie': {
    fault: 'assets/generated/granita-slushie-fault.webp',
    open: 'assets/generated/granita-slushie-open.webp',
    working: 'assets/generated/granita-slushie-working.webp',
  },
  'commercial-ice-dispenser': {
    fault: 'assets/generated/commercial-ice-dispenser-fault.webp',
    open: 'assets/generated/commercial-ice-dispenser-open.webp',
    working: 'assets/generated/commercial-ice-dispenser-working.webp',
  },
};

/**
 * Returns the generated image source for a machine type and visual state.
 * @param {string} machineId
 * @param {'fault'|'open'|'working'} state
 * @returns {string|null}
 */
export function machineImageSrc(machineId, state, graphicsMode = 'vector') {
  if (typeof globalThis !== 'undefined' && globalThis.test) {
    return null;
  }
  if (graphicsMode === 'vector') {
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

// ── Froyo Multihead Machine (YogurtMaster 3000) ───────────────────────────────
//
// Front elevation of a large three-spout commercial froyo dispenser.
//
// Fault   → dark/depleted hopper/line fluid, amber screen (LOCK), amber LED
// Open    → front cover panel swung open, three glass tubes & valves visible
// Working → full cyan fluid in lines, green screen (Y-3K), green LED

function froyoSvg(state) {
  const working = state === 'working';
  const fl  = working ? P.fluidOk : P.fluidFlt;
  const flo = working ? '0.85'    : '0.35';
  const led = working ? P.ok      : P.warn;
  const sc  = working ? P.ok      : P.warn;
  const stx = working ? 'Y-3K'    : 'LOCK';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    <ellipse cx="80" cy="67" rx="56" ry="3.5" fill="${P.shadow}"/>

    <!-- main cabinet casing -->
    <rect x="28" y="3" width="104" height="61" rx="4" fill="${P.body}"/>
    <rect x="28" y="3" width="6"  height="61" rx="4" fill="${P.bodyHi}" opacity="0.5"/>
    <rect x="126" y="3" width="6" height="61" rx="4" fill="${P.shadow}" opacity="0.45"/>

    <!-- control panel zone -->
    <rect x="40" y="8" width="80" height="16" rx="2" fill="${P.panel}"/>
    <rect x="46" y="11" width="48" height="10" rx="1" fill="${P.screen}"/>
    <text x="70" y="19" text-anchor="middle" font-family="'Courier New',monospace" font-size="8" fill="${sc}" letter-spacing="1.5" class="machine-screen-text">${stx}</text>
    
    <!-- LED status bar above display -->
    <circle cx="106" cy="16" r="5.5" fill="${led}" opacity="0.2" class="machine-led--glow"/>
    <circle cx="106" cy="16" r="3.5" fill="${led}"/>
    <circle cx="114" cy="16" r="3.5" fill="${working ? '#22c55e' : '#6b7280'}"/>

    <!-- dispensers compartment or internal guts if open -->
    ${state === 'open' ? `
    <!-- open casing exposing mixing chambers -->
    <rect x="36" y="27" width="88" height="22" rx="2" fill="${P.screen}"/>
    <!-- left barrel -->
    <rect x="42" y="29" width="16" height="18" rx="1" fill="${P.glass}"/>
    <rect x="42" y="34" width="16" height="13" fill="${fl}" opacity="0.65" class="machine-fluid--left"/>
    <!-- center barrel -->
    <rect x="72" y="29" width="16" height="18" rx="1" fill="${P.glass}"/>
    <rect x="72" y="34" width="16" height="13" fill="${fl}" opacity="0.65" class="machine-fluid--center"/>
    <!-- right barrel -->
    <rect x="102" y="29" width="16" height="18" rx="1" fill="${P.glass}"/>
    <rect x="102" y="34" width="16" height="13" fill="${fl}" opacity="0.65" class="machine-fluid--right"/>
    <!-- evaporator coils and lines -->
    <line x1="58" y1="38" x2="72" y2="38" stroke="${P.metalHi}" stroke-width="1.5" class="machine-evaporator"/>
    <line x1="88" y1="38" x2="102" y2="38" stroke="${P.metalHi}" stroke-width="1.5" class="machine-evaporator"/>
    ` : `
    <!-- closed dispensers panel -->
    <rect x="36" y="27" width="88" height="22" rx="2" fill="${P.bodyHi}" opacity="0.3"/>
    
    <!-- dispenser nozzle tubes -->
    <rect x="46" y="34" width="8" height="12" rx="1" fill="${P.metal}"/>
    <rect x="76" y="34" width="8" height="12" rx="1" fill="${P.metal}"/>
    <rect x="106" y="34" width="8" height="12" rx="1" fill="${P.metal}"/>
    `}

    <!-- nozzle tips -->
    <path d="M48 46 L52 46 L50 50 Z" fill="${P.metalHi}"/>
    <path d="M78 46 L82 46 L80 50 Z" fill="${P.metalHi}"/>
    <path d="M108 46 L112 46 L110 50 Z" fill="${P.metalHi}"/>

    <!-- pull-down handles -->
    <line x1="42" y1="32" x2="42" y2="44" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="72" y1="32" x2="72" y2="44" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="102" y1="32" x2="102" y2="44" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

// ── Triple-Bowl Granita (GlacierGlide) ────────────────────────────────────────
//
// Front elevation of a triple-bowl granita countertop slushie unit.
//
// Fault   → dark/depleted fluid in central bowl, amber warning LED
// Open    → lids removed, spiral augers fully exposed
// Working → full cyan fluid in all bowls, active sloshing waves

function granitaSvg(state) {
  const working = state === 'working';
  const fl  = working ? P.fluidOk : P.fluidFlt;
  const flo = working ? '0.85'    : '0.35';
  const led = working ? P.ok      : P.warn;
  const sc  = working ? P.ok      : P.warn;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    <ellipse cx="80" cy="67" rx="66" ry="3.5" fill="${P.shadow}"/>

    <!-- base unit -->
    <rect x="10" y="41" width="140" height="24" rx="3" fill="${P.body}"/>
    <rect x="10" y="41" width="140" height="4"  rx="3" fill="${P.bodyHi}"/>

    <!-- triple bowl structure -->
    <!-- left bowl -->
    <rect x="14" y="8" width="38" height="33" rx="4" fill="${P.glass}"/>
    <rect x="14" y="20" width="38" height="21" rx="2" fill="${fl}" opacity="${flo}" class="machine-fluid--left"/>

    <!-- center bowl -->
    <rect x="61" y="8" width="38" height="33" rx="4" fill="${P.glass}"/>
    <rect x="61" y="20" width="38" height="21" rx="2" fill="${fl}" opacity="${flo}" class="machine-fluid--center"/>

    <!-- right bowl -->
    <rect x="108" y="8" width="38" height="33" rx="4" fill="${P.glass}"/>
    <rect x="108" y="20" width="38" height="21" rx="2" fill="${fl}" opacity="${flo}" class="machine-fluid--right"/>

    <!-- spiral augers (agitator spirals) inside the bowls -->
    <g class="machine-agitator-group--left">
      <path d="M 18 20 C 23 15, 28 25, 33 20 C 38 15, 43 25, 48 20" fill="none" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>
    </g>
    <g class="machine-agitator-group--center">
      <path d="M 65 20 C 70 15, 75 25, 80 20 C 85 15, 90 25, 95 20" fill="none" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>
    </g>
    <g class="machine-agitator-group--right">
      <path d="M 112 20 C 117 15, 122 25, 127 20 C 132 15, 137 25, 142 20" fill="none" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/>
    </g>

    <!-- bowl top rim strip -->
    <rect x="12" y="7" width="136" height="4" rx="2" fill="${P.bodyHi}"/>

    <!-- lid caps (removed in open state) -->
    ${state !== 'open' ? `
    <rect x="15" y="3" width="36" height="5" rx="2" fill="${P.bodyHi}"/>
    <rect x="62" y="3" width="36" height="5" rx="2" fill="${P.bodyHi}"/>
    <rect x="109" y="3" width="36" height="5" rx="2" fill="${P.bodyHi}"/>
    ` : ''}

    <!-- glass highlights / glints -->
    <rect x="16" y="10" width="6" height="2.5" rx="1" fill="white" opacity="0.2"/>
    <rect x="63" y="10" width="6" height="2.5" rx="1" fill="white" opacity="0.2"/>
    <rect x="110" y="10" width="6" height="2.5" rx="1" fill="white" opacity="0.2"/>

    <!-- control switches recess on the base -->
    <rect x="68" y="47" width="24" height="12" rx="2" fill="${P.panel}"/>
    <!-- small display screen or LEDs -->
    <rect x="71" y="49" width="18" height="8" rx="1" fill="${P.screen}"/>
    <circle cx="80" cy="53" r="3.5" fill="${led}" opacity="0.2" class="machine-led--glow"/>
    <circle cx="80" cy="53" r="2" fill="${led}"/>

    <!-- dispense taps at the bottom -->
    <rect x="23" y="48" width="12" height="10" rx="1" fill="${P.metal}"/>
    <rect x="27" y="55" width="4"  height="6"  rx="1" fill="${P.metalHi}"/>
    
    <rect x="74" y="48" width="12" height="10" rx="1" fill="${P.metal}"/>
    <rect x="78" y="55" width="4"  height="6"  rx="1" fill="${P.metalHi}"/>

    <rect x="121" y="48" width="12" height="10" rx="1" fill="${P.metal}"/>
    <rect x="125" y="55" width="4"  height="6"  rx="1" fill="${P.metalHi}"/>
  </svg>`;
}

// ── Commercial Ice Maker (IceO-Matic 9000) ────────────────────────────────────
//
// Front elevation of a large commercial ice dispenser / cube maker.
//
// Fault   → warning LED blinking, screen displays warning text (BIN!)
// Open    → front grille panel removed, ice grid plate & evaporator tube visible
// Working → green LED, screen displays 100% ice level, ice cubes suggested

function iceMakerSvg(state) {
  const working = state === 'working';
  const led = working ? P.ok : P.warn;
  const sc  = working ? P.ok : P.warn;
  const stx = working ? '100%' : 'BIN!';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 70" width="100%" height="100%" aria-hidden="true" class="machine-state-${state}">
    <ellipse cx="80" cy="67" rx="48" ry="3" fill="${P.shadow}"/>

    <!-- machine body casing -->
    <rect x="36" y="3" width="88" height="61" rx="4" fill="${P.body}"/>
    <rect x="36" y="3" width="6"  height="61" rx="4" fill="${P.bodyHi}" opacity="0.5"/>
    <rect x="118" y="3" width="6" height="61" rx="4" fill="${P.shadow}" opacity="0.45"/>

    <!-- front ventilation/cover plate or internal grid if open -->
    ${state === 'open' ? `
    <!-- open casing exposing evaporator ice cubing plate -->
    <rect x="46" y="10" width="68" height="30" rx="1" fill="${P.panel}"/>
    <!-- cubing grid vertical dividers -->
    <line x1="55" y1="12" x2="55" y2="38" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="64" y1="12" x2="64" y2="38" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="73" y1="12" x2="73" y2="38" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="82" y1="12" x2="82" y2="38" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="91" y1="12" x2="91" y2="38" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="100" y1="12" x2="100" y2="38" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <!-- cubing grid horizontal dividers -->
    <line x1="48" y1="18" x2="106" y2="18" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="48" y1="26" x2="106" y2="26" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <line x1="48" y1="34" x2="106" y2="34" stroke="${P.metalHi}" stroke-width="1" opacity="0.6"/>
    <!-- water distributor header tube -->
    <rect x="46" y="7" width="68" height="3" fill="${P.metalHi}" class="machine-evaporator"/>
    ` : `
    <!-- closed front cover ventilation grid -->
    <rect x="46" y="10" width="68" height="30" rx="1" fill="${P.panel}"/>
    <line x1="52" y1="14" x2="108" y2="14" stroke="${P.body}" stroke-width="1.5"/>
    <line x1="52" y1="18" x2="108" y2="18" stroke="${P.body}" stroke-width="1.5"/>
    <line x1="52" y1="22" x2="108" y2="22" stroke="${P.body}" stroke-width="1.5"/>
    <line x1="52" y1="26" x2="108" y2="26" stroke="${P.body}" stroke-width="1.5"/>
    <line x1="52" y1="30" x2="108" y2="30" stroke="${P.body}" stroke-width="1.5"/>
    <line x1="52" y1="34" x2="108" y2="34" stroke="${P.body}" stroke-width="1.5"/>
    `}

    <!-- status screen panel -->
    <rect x="46" y="44" width="28" height="14" rx="2" fill="${P.panel}"/>
    <rect x="49" y="47" width="22" height="8" rx="1" fill="${P.screen}"/>
    <text x="60" y="53" text-anchor="middle" font-family="'Courier New',monospace" font-size="7" fill="${sc}" letter-spacing="1" class="machine-screen-text">${stx}</text>

    <!-- LED indicator -->
    <circle cx="81" cy="51" r="5.5" fill="${led}" opacity="0.2" class="machine-led--glow"/>
    <circle cx="81" cy="51" r="3.5" fill="${led}"/>

    <!-- dispense chute mouth -->
    <rect x="92" y="44" width="22" height="14" rx="2" fill="${P.metal}"/>
    <rect x="96" y="48" width="14" height="8" fill="${P.screen}"/>
    <line x1="103" y1="46" x2="103" y2="58" stroke="${P.metalHi}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

