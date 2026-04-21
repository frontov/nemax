"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { apiClient } from "@/lib/api";
import { getOrCreateFamilyKey } from "@/lib/e2e-crypto";

export function CreateFamilyForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData(form);
      const response = await apiClient.request<{ family: { name: string } }>({
        path: "/families",
        method: "POST",
        body: JSON.stringify({
          familyName: formData.get("familyName"),
          displayName: formData.get("displayName"),
          deviceName: formData.get("deviceName"),
          platform: "web",
        }),
      });

      await getOrCreateFamilyKey();
      setSuccess(`Готово! Пространство «${response.family.name}» создано.`);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать семейное пространство");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sectionStack">
      <input name="familyName" placeholder="Например: Семья Романовых" required />
      <input name="displayName" placeholder="Как вас называть в чате" required />
      <input name="deviceName" placeholder="Название устройства" defaultValue="Моё основное устройство" />
      <button type="submit">Создать пространство</button>
      {error ? <div className="statusMessage error">{error}</div> : null}
      {success ? <div className="statusMessage success">{success}</div> : null}
    </form>
  );
}
