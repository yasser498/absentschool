
// Service Worker for PWA & Push Notifications
const CACHE_NAME = 'ozr-pwa-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clone the response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
        });
      })
  );
});

// --- PUSH NOTIFICATION HANDLER ---
// This handles notifications pushed from a server (if we implement push server later)
// or local notifications triggered via `registration.showNotification`
self.addEventListener('push', function(event) {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  let data = {};
  if (event.data) {
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'مدرسة عماد الدين زنكي', body: event.data.text() };
    }
  } else {
      data = { title: 'تنبيه جديد', body: 'لديك إشعار جديد من المدرسة' };
  }

  const title = data.title || "مدرسة عماد الدين زنكي";
  const options = {
    body: data.body,
    icon: 'https://www.raed.net/img?id=1471924',
    badge: 'https://www.raed.net/img?id=1471924',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: self.location.origin
    },
    actions: [
        {action: 'explore', title: 'عرض التفاصيل'},
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// --- NOTIFICATION CLICK HANDLER ---
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // This looks to see if the current window is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function(clientList) {
      // If a window is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});