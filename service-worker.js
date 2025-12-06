
// Service Worker for PWA & Push Notifications
const CACHE_NAME = 'ozr-pwa-v4';
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
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;
        return fetch(event.request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
            return response;
        });
      })
  );
});

// --- HANDLE MESSAGES FROM CLIENT (For Test Notifications) ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'تنبيه تجريبي';
    const options = event.data.options || {};
    
    // Force these options for better mobile experience
    const finalOptions = {
        ...options,
        icon: 'https://www.raed.net/img?id=1471924',
        badge: 'https://www.raed.net/img?id=1471924',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: { url: self.location.origin }
    };

    self.registration.showNotification(title, finalOptions);
  }
});

// --- PUSH NOTIFICATION HANDLER ---
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
    tag: 'renotify',
    renotify: true,
    data: {
      url: self.location.origin
    },
    actions: [
        {action: 'open', title: 'فتح التطبيق'},
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// --- NOTIFICATION CLICK HANDLER ---
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});