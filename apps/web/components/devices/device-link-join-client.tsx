"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { storeFamilyKeyFromLocationHash } from "@/lib/e2e-crypto";

export function DeviceLinkJoinClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void apiClient
      .request({
        path: `/devices/link/${token}/join`,
        method: "POST",
      })
      .then(() => {
        if (!isActive) {
          return;
        }

        storeFamilyKeyFromLocationHash();
        router.push("/");
        router.refresh();
      })
      .catch((reason) => {
        if (!isActive) {
          return;
        }

        setError(reason instanceof Error ? reason.message : "Не удалось добавить устройство");
      });

    return () => {
      isActive = false;
    };
  }, [router, token]);

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Подключение устройства</div>
        {error ? (
          <div className="statusMessage error">{error}</div>
        ) : (
          <div className="statusMessage">Добавляем это устройство к вашему аккаунту…</div>
        )}
      </div>
    </section>
  );
}
