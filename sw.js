/* Self Scale Academy — service worker (PWA install + fast repeat loads).
   Rules: same-origin GET pages/assets are cached stale-while-revalidate;
   EVERYTHING cross-origin (Supabase, Telegram bridge, Nowshin API) is
   never touched — accounts, orders and chat always go live to the server. */
var CACHE = "ssa-lms-v59";
var IMG_CACHE = "ssa-img-v1";
var CORE = [
  "./", "index.html", "courses.html", "course.html", "course-spoken.html",
  "course-phonics.html", "cart.html", "login.html", "signup.html",
  "dashboard.html", "admin.html", "lesson.html", "quiz.html", "certificate.html",
  "reset.html", "update-password.html", "support.html", "policies.html",
  "style.css", "data.js", "app.js", "auth.js", "success.js", "notices.js", "guard.js", "tour.js", "content.js",
  "nowshin.js", "score.js", "supabase-client.js", "assets/qrcode.js", "manifest.webmanifest",
  "assets/logo.png", "assets/logo-mark.png", "assets/teacher.jpg", "assets/nowshin-avatar.webp",
  "assets/icon-192.png", "assets/icon-512.png", "assets/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k !== IMG_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) {
    /* Public storage IMAGES (covers, avatars) are cache-first for speed;
       all other cross-origin traffic (APIs, data) is never touched. */
    if (url.pathname.indexOf("/storage/v1/object/public/") !== -1 && (e.request.destination === "image" || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url.pathname))) {
      e.respondWith(
        caches.open(IMG_CACHE).then(function (c) {
          return c.match(e.request).then(function (hit) {
            var fresh = fetch(e.request).then(function (res) { if (res && (res.status === 200 || res.type === "opaque")) c.put(e.request, res.clone()); return res; }).catch(function () { return hit; });
            return hit || fresh;
          });
        })
      );
    }
    return; /* live data: hands off */
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(e.request).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fresh;
    })
  );
});
