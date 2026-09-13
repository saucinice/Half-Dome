const CACHE = "halfdome-v6";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    // Bundle every shipped guide photo so one online visit = offline forever
    try {
      const m = await (await fetch("./img/manifest.json")).json();
      const files = Object.values(m).flat().map((f) => "./img/" + f);
      if (files.length) await c.addAll(files);
    } catch {}
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for app shell (so refresh picks up edits), cache-first for icons.
// Offline: fall back to cache.
function isAppShell(path) {
  return path.endsWith("/index.html") || path.endsWith("/app.js") ||
    path.endsWith("/styles.css") || path.endsWith("/manifest.webmanifest") ||
    path === "/" || path.endsWith("/half-dome-pwa/") || path.endsWith("/half-dome-pwa");
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // Shared photo list + shared food list: network-first, cache fallback
  if (url.pathname.endsWith("/api/photos") || url.pathname.endsWith("/api/list")) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  // Shared photo bytes: cache-first (immutable), so trail offline works
  if (url.pathname.endsWith("/api/photo")) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  if (isAppShell(url.pathname)) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
