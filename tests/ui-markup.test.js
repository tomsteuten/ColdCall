/** @file Static UI-template checks for HTML attributes that must remain machine-readable. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobUi = readFileSync(join(root, 'js/ui/job.js'), 'utf8');

test('UI templates do not use smart quotes as HTML attribute delimiters', () => {
  const attributeWithSmartQuote = /\b(?:class|data-[\w-]+|aria-[\w-]+)=["“”]?[\u201c\u201d]/;
  assert(
    !attributeWithSmartQuote.test(jobUi),
    'smart quotes in HTML attributes break CSS selectors and event wiring'
  );
});

test('invoice Done button exposes the dismiss action with ASCII quotes', () => {
  assert(
    jobUi.includes('<button class="btn btn-primary" data-action="dismiss-invoice">Done</button>'),
    'invoice Done button must match the selector wired by job.js'
  );
  assert(
    jobUi.includes("root.querySelectorAll('[data-action=\"dismiss-invoice\"]')"),
    'invoice dismiss selector must remain wired'
  );
});

test('save-derived job fallbacks are escaped before innerHTML interpolation', () => {
  assert(jobUi.includes('escapeHtml(machineName)'), 'machine fallback must be escaped');
  assert(jobUi.includes('data-fix="${escapeHtml(id)}"'), 'fix ids in attributes must be escaped');
  assert(jobUi.includes('${escapeHtml(fixLabel(id))}'), 'fix labels must be escaped');
});
