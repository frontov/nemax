"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

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

  useEffect(() => {
    void apiClient
      .request<Device[]>({ path: "/devices" })
      .then(setDevices)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить устройства"),
      );
  }, []);

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Устройства семьи</div>
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
