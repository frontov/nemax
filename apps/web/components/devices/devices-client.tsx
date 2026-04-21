"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { appendFamilyKeyToUrl, getOrCreateFamilyKey } from "@/lib/e2e-crypto";

type Device = {
  id: string;
  deviceName: string;
  platform: string;
  isTrusted: boolean;
  lastSeenAt: string | null;
};

export function DevicesClient() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [deviceLink, setDeviceLink] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const qrAlt = useMemo(() => "QR-код для подключения нового устройства", []);

  useEffect(() => {
    void apiClient
      .request<Device[]>({ path: "/devices" })
      .then(setDevices)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить устройства"),
      );
  }, []);

  useEffect(() => {
    if (!deviceLink) {
      setQrDataUrl(null);
      return;
    }

    let isActive = true;

    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(deviceLink, {
          width: 280,
          margin: 1,
          color: {
            dark: "#2d2a26",
            light: "#fffaf7",
          },
        }),
      )
      .then((dataUrl) => {
        if (isActive) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isActive) {
          setQrDataUrl(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [deviceLink]);

  async function handleCreateDeviceLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkError(null);
    setDeviceLink(null);

    try {
      const formData = new FormData(event.currentTarget);
      const familyKey = await getOrCreateFamilyKey();
      const response = await apiClient.request<{ token: string; expiresInSeconds: number }>({
        path: "/devices/link",
        method: "POST",
        body: JSON.stringify({
          deviceName: formData.get("deviceName"),
          platform: "web",
        }),
      });
      const url = `${window.location.origin}/devices/link/${response.token}`;
      setDeviceLink(appendFamilyKeyToUrl(url, familyKey));
    } catch (reason) {
      setLinkError(reason instanceof Error ? reason.message : "Не удалось создать ссылку для устройства");
    }
  }

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Добавить своё устройство</div>
        <form onSubmit={handleCreateDeviceLink} className="sectionStack">
          <input
            name="deviceName"
            placeholder="Например: мой iPhone или рабочий ноутбук"
            defaultValue="Моё новое устройство"
          />
          <button type="submit">Создать QR и ссылку</button>
        </form>
        {linkError ? <div className="statusMessage error">{linkError}</div> : null}
        {deviceLink ? (
          <div className="inviteShareCard" style={{ marginTop: 12 }}>
            <div className="inviteShareContent">
              <div className="inviteResultLabel">Ссылка для нового устройства</div>
              <div className="inviteResultLink">{deviceLink}</div>
              <p className="qrHint">
                Откройте эту ссылку или отсканируйте QR на втором устройстве. Ссылка живёт 15 минут.
              </p>
            </div>
            {qrDataUrl ? (
              <div className="qrCard">
                <img src={qrDataUrl} alt={qrAlt} className="qrImage" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Мои устройства</div>
        {error ? <div className="statusMessage error">{error}</div> : null}
        <div style={{ display: "grid", gap: 12 }}>
          {devices.map((device) => (
            <article key={device.id} className="card">
              <strong>{device.deviceName}</strong>
              <span>
                {device.platform} • {device.isTrusted ? "доверенное" : "отозвано"}
              </span>
            </article>
          ))}
          {devices.length === 0 && !error ? (
            <div className="statusMessage">Пока ни одного устройства не найдено.</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
