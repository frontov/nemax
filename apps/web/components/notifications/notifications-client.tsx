"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  pushConfig,
  serializePushSubscription,
  supportsPushNotifications,
  urlBase64ToUint8Array,
} from "@/lib/push";

type NotificationSettings = {
  pushEnabled: boolean;
  showPreview: boolean;
  muteUntil?: string | null;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
};

type PushPublicConfig = {
  vapidPublicKey: string;
};

function isConfiguredVapidKey(value: string | null | undefined) {
  return Boolean(value && value !== "development-public-key");
}

function getPermissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") {
    return "разрешены";
  }

  if (permission === "denied") {
    return "запрещены в браузере";
  }

  if (permission === "unsupported") {
    return "не поддерживаются";
  }

  return "ещё не запрошены";
}

export function NotificationsClient() {
  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    showPreview: false,
    muteUntil: null,
    quietHoursFrom: null,
    quietHoursTo: null,
  });
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolveVapidPublicKey() {
    if (isConfiguredVapidKey(pushConfig.vapidPublicKey)) {
      return pushConfig.vapidPublicKey;
    }

    const runtimeConfig = await apiClient.request<PushPublicConfig>({
      path: "/push/public-key",
    });

    return runtimeConfig.vapidPublicKey;
  }

  useEffect(() => {
    if (!supportsPushNotifications() || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => setError("Не удалось подготовить уведомления в браузере."));
  }, []);

  useEffect(() => {
    void apiClient
      .request<NotificationSettings | null>({ path: "/notifications/settings" })
      .then((payload) => {
        if (payload) {
          setSettings(payload);
        }
      })
      .catch(() => {
        setError("Не удалось загрузить настройки уведомлений.");
      });
  }, []);

  async function saveSettings(nextSettings: NotificationSettings) {
    const saved = await apiClient.request<NotificationSettings>({
      path: "/notifications/settings",
      method: "PUT",
      body: JSON.stringify(nextSettings),
    });
    setSettings(saved);
  }

  async function enableNotifications() {
    setIsBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!supportsPushNotifications() || !("Notification" in window)) {
        throw new Error("Этот браузер не поддерживает push-уведомления.");
      }

      const vapidPublicKey = await resolveVapidPublicKey();

      if (!isConfiguredVapidKey(vapidPublicKey)) {
        throw new Error("VAPID ключ не настроен на сервере. Проверьте VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY в .env.");
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error("Браузер не дал разрешение на уведомления.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const serialized = serializePushSubscription(subscription);

      if (!serialized.endpoint || !serialized.p256dh || !serialized.auth) {
        throw new Error("Браузер вернул неполную push-подписку.");
      }

      await apiClient.request({
        path: "/push/subscriptions",
        method: "POST",
        body: JSON.stringify(serialized),
      });
      await saveSettings({
        ...settings,
        pushEnabled: true,
      });

      setIsSubscribed(true);
      setMessage("Уведомления включены для этого устройства.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось включить уведомления.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disableNotifications() {
    setIsBusy(true);
    setError(null);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await apiClient.request({
          path: "/push/subscriptions",
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      await saveSettings({
        ...settings,
        pushEnabled: false,
      });

      setIsSubscribed(false);
      setMessage("Уведомления выключены для этого устройства.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выключить уведомления.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Статус</div>
        <div className="sectionStack">
          <div>
            Разрешение браузера: <strong>{getPermissionLabel(permission)}</strong>
          </div>
          <div>
            Подписка устройства: <strong>{isSubscribed ? "активна" : "не активна"}</strong>
          </div>
          <div>
            Настройка чата: <strong>{settings.pushEnabled ? "включена" : "выключена"}</strong>
          </div>
        </div>
      </div>

      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Управление</div>
        <div className="notificationActions">
          <button type="button" onClick={enableNotifications} disabled={isBusy || permission === "unsupported"}>
            {isSubscribed ? "Обновить подписку" : "Включить уведомления"}
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={disableNotifications}
            disabled={isBusy || !isSubscribed}
          >
            Выключить
          </button>
        </div>
        {message ? <div className="statusMessage success">{message}</div> : null}
        {error ? <div className="statusMessage error">{error}</div> : null}
      </div>
    </section>
  );
}
