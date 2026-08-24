// Firebase Web Push Service Worker — Phase 7 (Section 17.8)
// Handles background push notifications when app is minimized/closed.

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Configuration populated via runtime environment or default placeholders
const firebaseConfig = {
  apiKey: "placeholder-api-key",
  authDomain: "campusiq-krmu.firebaseapp.com",
  projectId: "campusiq-krmu",
  storageBucket: "campusiq-krmu.appspot.com",
  messagingSenderId: "100000000000",
  appId: "1:100000000000:web:abcdef123456"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message: ', payload);

    const notificationTitle = payload.notification?.title || 'CampusIQ Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new update in CampusIQ.',
      icon: '/vite.svg',
      badge: '/vite.svg',
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Firebase init skipped in local dev:', err);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/notifications');
      }
    })
  );
});
