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
};

export function HomeGate() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MePayload | null>(null);

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
