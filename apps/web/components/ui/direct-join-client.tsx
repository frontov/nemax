"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

export function DirectJoinClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void apiClient
      .request({
        path: `/invites/direct/${token}/join`,
        method: "POST",
      })
      .then(() => {
        if (!isActive) {
          return;
        }

        router.push("/");
        router.refresh();
      })
      .catch((reason) => {
        if (!isActive) {
          return;
        }

        setError(reason instanceof Error ? reason.message : "Не удалось присоединиться по ссылке");
      });

    return () => {
      isActive = false;
    };
  }, [router, token]);

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Мгновенный вход</div>
        {error ? (
          <div className="statusMessage error">{error}</div>
        ) : (
          <div className="statusMessage">Соединяем вас с семейным чатом…</div>
        )}
      </div>
    </section>
  );
}
