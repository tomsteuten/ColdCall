/** @file Service worker — cache-first for all app assets, fully offline after first load. */

const CACHE = 'coldcall-v7';

// Derive the base path from the SW registration scope so this works on both
// local dev (/) and GitHub Pages (/ColdCall/).
const BASE = self.registration.scope; // e.g. https://host/ColdCall/

const APP_SHELL = [
  '',               // same as index.html at scope root
  'index.html',
  'manifest.json',
  'css/main.css',
  'js/main.js',
  'js/state.js',
  'js/economy.js',
  'js/diagnosis.js',
  'js/idle.js',
  'js/faults.js',
  'js/rng.js',
  'js/tickets.js',
  'js/motd.js',
  'js/utils.js',
  'js/machine-art.js',
  'js/ui/job.js',
  'js/ui/shop.js?v=2',
  'js/ui/motd.js',
  'config/balance.js',
  'assets/icon.svg',
  'data/machines.json',
  'data/clients.json',
  'data/faults/index.json',
  'data/faults/air-injector-blocked.json',
  'data/faults/barrel-freeze-up.json',
  'data/faults/beater-motor-capacitor.json',
  'data/faults/brushless-drive-position-fault.json',
  'data/faults/compressor-start-relay-failed.json',
  'data/faults/condenser-fan-seized.json',
  'data/faults/display-controller-failed.json',
  'data/faults/dispense-valve-weeping.json',
  'data/faults/door-gasket-deteriorated.json',
  'data/faults/door-o-ring-gone.json',
  'data/faults/draw-valve-microswitch-fault.json',
  'data/faults/expansion-valve-iced.json',
  'data/faults/heat-exchanger-scaled.json',
  'data/faults/heat-treat-cycle-failed.json',
  'data/faults/heat-treat-lid-left-open.json',
  'data/faults/heat-treat-sensor-fault.json',
  'data/faults/hopper-lid-magnet-missing.json',
  'data/faults/hopper-thermistor-drift.json',
  'data/faults/mix-feed-valve-stuck-closed.json',
  'data/faults/mix-level-sensor-failed.json',
  'data/faults/mix-pump-failed.json',
  'data/faults/overheat-cutout-tripped.json',
  'data/faults/rear-shaft-seal-leaking.json',
  'data/faults/refrigerant-low.json',
  'data/faults/scale-blocked-mix-line.json',
  'data/faults/slushie-agitator-belt-worn.json',
  'data/faults/slushie-bowl-gasket-leak.json',
  'data/faults/slushie-condenser-clogged.json',
  'data/faults/slushie-condenser-fan-failed.json',
  'data/faults/slushie-drain-valve-stuck-open.json',
  'data/faults/slushie-evaporator-iced-over.json',
  'data/faults/slushie-float-switch-stuck-high.json',
  'data/faults/slushie-lid-interlock-fault.json',
  'data/faults/slushie-mix-too-weak.json',
  'data/faults/slushie-motor-brushes-worn.json',
  'data/faults/slushie-spout-partially-blocked.json',
  'data/faults/slushie-thermostat-stuck.json',
  'data/faults/staff-didnt-prime-it.json',
  'data/faults/voltage-sag-resets.json',
  'data/faults/worn-scraper-blades.json',
].map((path) => BASE + path);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately — no need to wait for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Delete any caches from previous versions.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept same-origin GET requests.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      // Not in cache yet — fetch, cache, return.
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
