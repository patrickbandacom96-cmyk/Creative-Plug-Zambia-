// Shows phone alerts for new orders, even when the app is closed.
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(
    self.registration.showNotification(d.title || "Creative Plug Zambia", {
      body: d.body || "You have a new order",
      tag: d.tag || "cpz-order",
      renotify: true,
      data: { url: d.url || "./" }
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      return clients.openWindow((e.notification.data && e.notification.data.url) || "./");
    })
  );
});
