export const pushConfig = {
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function supportsPushNotifications() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}
