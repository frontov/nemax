self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: "Не Мах",
        body: event.data.text(),
      };
    }
  }

  const title = payload.title || "Не Мах";
  const options = {
    body: payload.body || "Новое сообщение",
    icon: "/app-icon.svg",
    badge: "/favicon.svg",
    data: {
      url: payload.url || "/chat",
      familyId: payload.familyId,
      messageId: payload.messageId,
    },
    tag: payload.familyId || "family-chat",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => "focus" in client);

      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
