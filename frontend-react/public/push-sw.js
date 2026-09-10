/* Web Push handlers for LevelUp (imported into Workbox SW). */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data && event.data.text() };
    } catch {
      data = {};
    }
  }
  const title = data.title || "LevelUp";
  const options = {
    body: data.body || "Напоминание о тренировке",
    icon: data.icon || "/assets/icon-192.png",
    badge: data.badge || "/assets/icon-192.png",
    data: { url: data.url || "/" },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(url); } catch { /* ignore */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
