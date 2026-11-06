/**
 * ============================================================================
 * Service Worker (sw.js) v3.0.0 - منظومة النقاط والإدارة المدرسية الشاملة
 * يدعم العمل بدون اتصال بالإنترنت 100% (بما في ذلك خط Cairo و Tailwind CDN)
 * مع دعم إشعار "تحديث متاح" والترقية الفورية عبر SKIP_WAITING
 * ============================================================================
 */

const CACHE_NAME = 'school-points-pwa-v3.0.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com/3.4.17',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        CORE_ASSETS.map(function(assetUrl) {
          return cache.add(assetUrl);
        })
      );
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  const req = event.request;
  const url = new URL(req.url);

  // استثناء طلبات محرك Google Apps Script من التخزين المؤقت الثابت
  if (req.method !== 'GET' || url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return;
  }

  // استراتيجية Cache-First مع تحديث خلفي (Stale-While-Revalidate) للخطوط ومكتبة Tailwind والواجهة
  event.respondWith(
    caches.match(req).then(function(cachedResponse) {
      const fetchPromise = fetch(req).then(function(networkResponse) {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return cachedResponse || caches.match('./index.html');
      });

      return cachedResponse || fetchPromise;
    })
  );
});
