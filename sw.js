/**
 * ============================================================================
 * Service Worker (sw.js) v4.0.0 — منظومة النقاط والإدارة المدرسية | ثانوية الصحابة الشرعية
 * - الصفحة الرئيسية (HTML Navigation): Network-First مع مهلة 3.5 ثانية وبديل من الذاكرة + صفحة Offline احتياطية
 * - الأصول الثابتة (CSS, Manifest, Icons, Fonts): Cache-First مع تحديث خلفي هادئ
 * - طلبات Google Apps Script API: لا تُخزّن أبداً (Network-Only) لضمان دقة المزامنة
 * ============================================================================
 */

const CACHE_VERSION = 'v4.0.0';
const STATIC_CACHE = 'sahaba-static-' + CACHE_VERSION;
const PAGE_CACHE = 'sahaba-pages-' + CACHE_VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/tailwind.min.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './css/styles.css',
  './index.modular.html',
  './js/utils.js',
  './js/seed-config.js',
  './js/seed-students-a.js',
  './js/seed-students-b.js',
  './js/state.js',
  './js/auth.js',
  './js/grid-view.js',
  './js/gestures.js',
  './js/student-modal.js',
  './js/reports-hall.js',
  './js/admin-dashboard.js',
  './js/admin-students.js',
  './js/admin-teachers.js',
  './js/admin-classes.js',
  './js/admin-absence-backup.js',
  './js/sync.js',
  './js/app.js'
];

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>دون اتصال | ثانوية الصحابة الشرعية</title>
  <style>
    body { margin: 0; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: #0F172A; color: #F8FAFC; font-family: 'Cairo', system-ui, sans-serif; padding: 1.5rem; text-align: center; }
    .box { max-width: 24rem; background: #1E293B; border: 1px solid #334155; border-radius: 1.5rem; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; color: #38BDF8; }
    p { font-size: 0.875rem; color: #CBD5E1; line-height: 1.6; margin: 0 0 1.25rem; }
    button { background: #2563EB; color: #FFF; border: 0; border-radius: 0.75rem; padding: 0.75rem 1.5rem; font-weight: 800; font-family: inherit; cursor: pointer; min-height: 44px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>📴 أنت تعمل في وضع عدم الاتصال</h1>
    <p>تعذر تحميل الصفحة من الشبكة حالياً. اضغط الزر أدناه لفتح النسخة المحفوظة محلياً على جهازك.</p>
    <button onclick="window.location.reload()">🔄 إعادة المحاولة / فتح النسخة المحلية</button>
  </div>
</body>
</html>`;

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url);
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
          if (key !== STATIC_CACHE && key !== PAGE_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

function fetchWithTimeout(request, timeoutMs) {
  return new Promise(function(resolve, reject) {
    const timer = setTimeout(function() {
      reject(new Error('Network timeout'));
    }, timeoutMs);
    fetch(request).then(function(response) {
      clearTimeout(timer);
      resolve(response);
    }).catch(function(err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('fetch', function(event) {
  const req = event.request;
  const url = new URL(req.url);

  // 1) عدم تخزين طلبات Google Apps Script أو الطلبات غير GET نهائياً
  if (
    req.method !== 'GET' ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com')
  ) {
    return;
  }

  // 2) استراتيجية Network-First لصفحة HTML الرئيسية (التنقل) مع بديل من الكاش ثم صفحة Offline
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetchWithTimeout(req, 3500)
        .then(function(networkRes) {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(PAGE_CACHE).then(function(cache) {
              cache.put('./index.html', copy);
            });
          }
          return networkRes;
        })
        .catch(function() {
          return caches.match('./index.html')
            .then(function(cachedPage) {
              if (cachedPage) return cachedPage;
              return caches.match('./');
            })
            .then(function(fallbackPage) {
              if (fallbackPage) return fallbackPage;
              return new Response(OFFLINE_FALLBACK_HTML, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            });
        })
    );
    return;
  }

  // 3) استراتيجية Cache-First للأصول الثابتة (CSS, الأيقونات، الخطوط، Manifest)
  event.respondWith(
    caches.match(req).then(function(cachedAsset) {
      const networkUpdate = fetch(req).then(function(netRes) {
        if (netRes && netRes.status === 200) {
          const clone = netRes.clone();
          caches.open(STATIC_CACHE).then(function(cache) {
            cache.put(req, clone);
          });
        }
        return netRes;
      }).catch(function() {
        return cachedAsset;
      });

      return cachedAsset || networkUpdate;
    })
  );
});
