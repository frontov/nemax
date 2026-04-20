"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

type InviteValidation = {
  valid: boolean;
  family: {
    id: string;
    name: string;
  };
  role: string;
  expiresAt: string;
  remainingUses: number;
};

export function JoinFamilyForm({ code }: { code: string }) {
  const [invite, setInvite] = useState<InviteValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    void apiClient
      .request<InviteValidation>({ path: `/invites/${code}` })
      .then(setInvite)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось проверить приглашение"),
      );
  }, [code]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData(event.currentTarget);
      await apiClient.request({
        path: `/invites/${code}/join`,
        method: "POST",
        body: JSON.stringify({
          displayName: formData.get("displayName"),
          deviceName: formData.get("deviceName"),
          platform: "web",
        }),
      });

      setSuccess("Готово. Открываем семейный чат…");
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось присоединиться");
    }
  }

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Проверка приглашения</div>
        {invite ? (
          <div className="statusMessage">
            Семья: <strong>{invite.family.name}</strong> • роль: {invite.role} • осталось использований:{" "}
            {invite.remainingUses}
          </div>
        ) : null}
        {error ? <div className="statusMessage error">{error}</div> : null}
      </div>

      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Присоединиться</div>
        <form onSubmit={handleSubmit} className="sectionStack">
          <input name="displayName" placeholder="Ваше имя в чате" required />
          <input name="deviceName" placeholder="Название устройства" defaultValue="Моё устройство" />
          <button type="submit">Присоединиться по коду</button>
        </form>
        {success ? <div className="statusMessage success">{success}</div> : null}
      </div>
    </section>
  );
}
