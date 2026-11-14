// SensiTâche — réception d'un partage Android (« Partager → SensiTâche ») : un mail depuis Nine, une photo, un .eml…
// Ce service worker ne fait QUE ça : il range le partage (titre, texte, fichiers) dans le cache « sensitache-share-cache »
// puis ouvre index.html?shared=1, qui le lit. Il ne met rien d'autre en cache et laisse passer toutes les autres
// requêtes vers le réseau : il ne peut pas bloquer l'appli.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "POST" || !url.pathname.endsWith("/share-target")) return; // tout le reste : réseau normal
  e.respondWith((async () => {
    try {
      const form = await e.request.formData();
      const cache = await caches.open("sensitache-share-cache");
      const files = form.getAll("files").filter((f) => f && typeof f === "object" && f.size);
      for (let i = 0; i < files.length; i++) await cache.put("/shared-file-" + i, new Response(files[i], { headers: { "content-type": files[i].type || "application/octet-stream" } }));
      const meta = { title: form.get("title") || "", text: form.get("text") || "", url: form.get("url") || "", filesData: files.map((f) => ({ name: f.name || "fichier" })) };
      if (meta.url && !meta.text.includes(meta.url)) meta.text = (meta.text ? meta.text + "\n" : "") + meta.url;
      await cache.put("/shared-meta", new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }));
    } catch (err) { /* partage illisible : l'appli s'ouvre simplement */ }
    return Response.redirect(new URL("./index.html?shared=1", self.registration.scope).href, 303);
  })());
});
