// Remplace l'ancien service worker de « Sort my stuffs » (adresse /Sort-your-stuffs/) : il se désinscrit,
// efface les fichiers de l'ancienne version mis en cache, puis recharge les pages ouvertes, qui sont redirigées
// vers /rank-it-all/. Les données (base locale, compte) ne sont pas touchées : elles restent au même site.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      for (const key of await caches.keys()) if (key.includes('/Sort-your-stuffs/')) await caches.delete(key);
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
