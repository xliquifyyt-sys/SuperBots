// Minimal offline cache for the PWA build.
const CACHE = 'superbots-v1';
const FILES = ['./', './index.html', './style.css', './manifest.webmanifest', './src/main.js', './src/audio.js', './src/core/defs.js', './src/core/maps.js', './src/core/rng.js', './src/core/sim.js', './src/core/match.js', './src/ai/planner.js', './src/render/renderer.js', './src/ui/game.js'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {})));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request))); });
