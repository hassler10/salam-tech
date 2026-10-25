const CACHE = "salam-library-v3";
const SHELL = ["/", "/borne", "/offline", "/logo.png", "/manifest.webmanifest"];

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.png" ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:png|jpe?g|svg|webp|avif|ico|woff2?)$/i.test(url.pathname)
  );
}

function isPrivate(response) {
  return /(?:no-store|private)/i.test(response.headers.get("cache-control") || "");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Ne met jamais en cache les pages authentifiées ni les réponses privées.
        if (
          res.ok &&
          res.type === "basic" &&
          !url.pathname.startsWith("/api/") &&
          isCacheableAsset(url) &&
          !isPrivate(res)
        ) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return (await caches.match("/offline")) || Response.error();
        }
        return Response.error();
      }),
  );
});
