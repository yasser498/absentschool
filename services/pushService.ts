
import { supabase } from '../supabaseClient';

// Public VAPID Key (This is a generic test key. For production, generate your own pair)
const PUBLIC_VAPID_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeToPushNotifications = async (userId: string) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications not supported on this browser');
  }

  // 1. Request Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission denied');
  }

  // 2. Register Service Worker (if not already)
  const registration = await navigator.serviceWorker.ready;

  // 3. Subscribe to Push Manager
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
  });

  // 4. Save Subscription to Database
  const { error } = await supabase.from('push_subscriptions').insert({
      user_id: userId,
      subscription: subscription
  });

  if (error) {
      // If error is duplicate key, ignore (already subscribed)
      console.warn('Subscription DB Error:', error);
  }

  return subscription;
};

export const checkPushPermission = () => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
};
