/**
 * Firebase Client Messaging SDK — Phase 7 (Section 17.8)
 * Configured dynamically via environment variables without hardcoded credentials.
 */

export const requestPushNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop push notifications');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Push notification permission granted.');
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered with scope:', registration.scope);
      }
      return permission;
    } else {
      console.log('Push notification permission denied.');
      return permission;
    }
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return null;
  }
};
