self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* The fallback remains visible. */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Mousefy", {
      body: data.body || "Confira as novidades no painel.",
      icon: "/brand/pwa-192.png",
      tag: data.tag || "mousehot-sales",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL("/vendas", self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).pathname === destination.pathname,
      );
      if (existing) return existing.focus();
      return self.clients.openWindow(destination.href);
    })(),
  );
});
