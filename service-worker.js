const CACHE_NAME = "sensitache-cache-v2";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Incoming share from another app (e.g. sharing a photo from the gallery)
  if (event.request.method === "POST" && url.pathname.endsWith("index.html")) {
    event.respondWith(handleShareTarget(event));
    return;
  }

  // Never intercept cross-origin requests (Google OAuth, html2canvas/jsPDF CDN, Drive API) —
  // only cache the app's own files so the app opens even without a connection.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const title = formData.get("title") || "";
    const text = formData.get("text") || "";
    const files = formData.getAll("photos").filter((f) => f && f.size > 0);
    const shareCache = await caches.open("sensitache-share-cache");
    const filesData = files.map((f) => ({ name: f.name, type: f.type }));
    await shareCache.put("/shared-meta", new Response(JSON.stringify({ title, text, filesData })));
    for (let i = 0; i < files.length; i++) {
      await shareCache.put("/shared-file-" + i, new Response(files[i]));
    }
  } catch (e) {
    // if anything goes wrong, just fall through to opening the app normally
  }
  return Response.redirect("./index.html?shared=1", 303);
}
