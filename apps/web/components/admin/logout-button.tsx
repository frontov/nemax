"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (!isConfirming) {
      setIsConfirming(true);
      setError(null);
      return;
    }

    setIsLoggingOut(true);
    setError(null);

    try {
      await apiClient.request({
        path: "/auth/logout",
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выйти");
      setIsLoggingOut(false);
    }
  }

  return (
    <section className="adminDangerZone" aria-label="Выход из аккаунта">
      <div>
        <strong>Выход из аккаунта</strong>
        <p>
          Эта кнопка завершит текущую сессию только на этом устройстве. Для безопасности
          нужно нажать два раза.
        </p>
      </div>
      <button
        type="button"
        className="secondaryButton dangerButton"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Выходим…" : isConfirming ? "Да, выйти" : "Выйти"}
      </button>
      {isConfirming && !isLoggingOut ? (
        <button
          type="button"
          className="secondaryButton"
          onClick={() => setIsConfirming(false)}
        >
          Отмена
        </button>
      ) : null}
      {error ? <div className="statusMessage error">{error}</div> : null}
    </section>
  );
}
