const CACHE = "campfire-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch("/");
      if (!shell.ok) throw new Error("App shell unavailable");
      const html = await shell.clone().text();
      const assets = [
        ...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g),
      ].map((m) => m[1].replaceAll("&amp;", "&"));
      await cache.addAll([
        ...new Set(["/icon.svg", "/manifest.webmanifest", ...assets]),
      ]);
      await cache.put("/", shell);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("campfire-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
