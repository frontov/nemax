"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChatClient } from "@/components/chat/chat-client";
import { apiClient } from "@/lib/api";

type MePayload = {
  user: {
    id: string;
    displayName: string;
  };
  family?: {
    id: string;
    name: string;
  } | null;
  memberships: Array<{
    id: string;
    role: string;
    family: {
      id: string;
      name: string;
    };
  }>;
};

export function HomeGate() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MePayload | null>(null);
  const [switchingFamily, setSwitchingFamily] = useState(false);

  useEffect(() => {
    void apiClient
      .request<MePayload>({ path: "/auth/me" })
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = inviteCode.trim();

    if (!normalizedCode) {
      setError("Введите код приглашения, чтобы войти.");
      return;
    }

    setError(null);
    router.push(`/join/${encodeURIComponent(normalizedCode)}`);
  }

  async function handleFamilyChange(familyId: string) {
    if (!familyId || familyId === me?.family?.id) {
      return;
    }

    setError(null);
    setSwitchingFamily(true);

    try {
      await apiClient.request({
        path: "/families/active",
        method: "POST",
        body: JSON.stringify({ familyId }),
      });
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось переключить чат");
      setSwitchingFamily(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <div className="frame">
          <section className="hero heroCompact">
            <span className="eyebrow">семейный чат</span>
            <h1>Подготавливаем пространство…</h1>
            <p>Проверяем, есть ли у вас активная семейная сессия.</p>
          </section>
        </div>
      </main>
    );
  }

  if (me) {
    return (
      <main className="shell">
        <div className="frame">
          <div className="page pageTight chatPageFrame">
            {me.memberships.length > 1 ? (
              <div className="chatFamilyPicker">
                <label htmlFor="familyPicker">Чат</label>
                <select
                  id="familyPicker"
                  value={me.family?.id ?? ""}
                  onChange={(event) => void handleFamilyChange(event.target.value)}
                  disabled={switchingFamily}
                >
                  {me.memberships.map((membership) => (
                    <option key={membership.id} value={membership.family.id}>
                      {membership.family.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {error ? <div className="statusMessage error">{error}</div> : null}
            <ChatClient />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="frame">
        <section className="hero heroCompact">
          <span className="eyebrow">вход по приглашению</span>
          <h1>Введите код и войдите в семейный чат.</h1>
          <p>Только код приглашения. Без лишних кнопок и сложных шагов.</p>

          <form onSubmit={handleSubmit} className="inviteEntry">
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Например: 7f4c91ab3e"
              aria-label="Код приглашения"
            />
            <button type="submit">Продолжить</button>
          </form>

          {error ? <div className="statusMessage error">{error}</div> : null}

          <p className="adminHint">
            Если вы настраиваете пространство для семьи, откройте{" "}
            <Link href="/admin">админку</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
