/** @file Blocky inline-SVG client portraits driven by data/clients.json. */

const SAFE_COLOUR = /^#[0-9a-f]{6}$/i;
const EXPRESSIONS = new Set(['bright', 'weary', 'stern']);

const GENERATED_PORTRAITS = {
  'kwik-stop-corner': 'assets/generated/nina-patel.webp',
  'burgertown-high-st': 'assets/generated/cheryl-voss.webp',
  'kwiktrip-servo': 'assets/generated/cheryl-voss.webp',
  'yo-go-froyo': 'assets/generated/cheryl-voss.webp',
};

/**
 * Return the generated raster portrait for a known client.
 * @param {string} clientId
 * @returns {string|null}
 */
export function clientPortraitImageSrc(clientId) {
  return GENERATED_PORTRAITS[clientId] ?? null;
}

function colour(value, fallback) {
  return typeof value === 'string' && SAFE_COLOUR.test(value) ? value : fallback;
}

/**
 * Render a simple client portrait from the portrait data in clients.json.
 * Invalid or missing portrait data returns null so the UI can use text only.
 * @param {object|null|undefined} portrait
 * @returns {string|null}
 */
export function clientPortraitSvg(portrait) {
  if (!portrait || typeof portrait !== 'object') return null;

  const skin = colour(portrait.skin, '#d6a074');
  const hair = colour(portrait.hair, '#3b2b2a');
  const shirt = colour(portrait.shirt, '#4a5470');
  const accent = colour(portrait.accent, '#7fd4f0');
  const expression = EXPRESSIONS.has(portrait.expression) ? portrait.expression : 'bright';

  const brows =
    expression === 'stern'
      ? '<path d="M18 21l7 2M39 23l7-2" stroke="#2a2020" stroke-width="2"/>'
      : expression === 'weary'
        ? '<path d="M18 22h7M39 22h7" stroke="#2a2020" stroke-width="2"/>'
        : '<path d="M18 22l7-1M39 21l7 1" stroke="#2a2020" stroke-width="2"/>';
  const mouth =
    expression === 'stern'
      ? '<path d="M27 39h10" stroke="#7a3f3f" stroke-width="2"/>'
      : expression === 'weary'
        ? '<path d="M27 40q5-3 10 0" fill="none" stroke="#7a3f3f" stroke-width="2"/>'
        : '<path d="M26 37q6 6 12 0" fill="none" stroke="#7a3f3f" stroke-width="2"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
    <rect width="64" height="64" rx="8" fill="#252d40"/>
    <path d="M8 64V52c0-8 9-13 24-13s24 5 24 13v12z" fill="${shirt}"/>
    <path d="M14 16c2-10 10-14 18-14s16 4 18 14v16c0 12-8 18-18 18s-18-6-18-18z" fill="${skin}"/>
    <path d="M13 20C13 7 21 2 32 2s19 5 19 18l-7-8-4 5-8-6-8 6-4-4z" fill="${hair}"/>
    ${brows}
    <rect x="20" y="26" width="5" height="5" rx="1" fill="#202633"/>
    <rect x="39" y="26" width="5" height="5" rx="1" fill="#202633"/>
    <path d="M32 28v6h4" fill="none" stroke="#a66f55" stroke-width="2"/>
    ${mouth}
    <path d="M22 47l10 9 10-9 7 4v13H15V51z" fill="${accent}" opacity=".35"/>
    <rect x="4" y="4" width="8" height="8" fill="${accent}"/>
  </svg>`;
}
