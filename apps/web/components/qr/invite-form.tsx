"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { appendFamilyKeyToUrl, getOrCreateFamilyKey } from "@/lib/e2e-crypto";

type InviteResponse = {
  code: string;
  expiresAt: string;
  maxUses: number;
  directJoinToken?: string | null;
};

export function InviteForm() {
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [familyKey, setFamilyKey] = useState<string | null>(null);

  const inviteLink = useMemo(() => {
    if (!invite || typeof window === "undefined") {
      return null;
    }

    const url = `${window.location.origin}/join/${invite.code}`;
    return familyKey ? appendFamilyKeyToUrl(url, familyKey) : url;
  }, [familyKey, invite]);

  const directJoinLink = useMemo(() => {
    if (!invite?.directJoinToken || typeof window === "undefined") {
      return null;
    }

    const url = `${window.location.origin}/join/direct/${invite.directJoinToken}`;
    return familyKey ? appendFamilyKeyToUrl(url, familyKey) : url;
  }, [familyKey, invite]);

  useEffect(() => {
    if (!directJoinLink) {
      setQrDataUrl(null);
      return;
    }

    let isActive = true;

    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(directJoinLink, {
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
  }, [directJoinLink]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const key = await getOrCreateFamilyKey();
      const response = await apiClient.request<InviteResponse>({
        path: "/invites",
        method: "POST",
        body: JSON.stringify({
          role: formData.get("role"),
          maxUses: Number(formData.get("maxUses") || 1),
          expiresInDays: Number(formData.get("expiresInDays") || 7),
          directJoinDisplayName: formData.get("directJoinDisplayName"),
          directJoinDeviceName: formData.get("directJoinDeviceName"),
        }),
      });

      setFamilyKey(key);
      setInvite(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать приглашение");
    }
  }

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Приглашение для близких</div>
        <form onSubmit={handleSubmit} className="sectionStack">
          <input name="role" defaultValue="member" placeholder="Роль участника" />
          <input name="maxUses" type="number" min={1} max={100} defaultValue={1} />
          <input name="expiresInDays" type="number" min={1} max={30} defaultValue={7} />
          <input
            name="directJoinDisplayName"
            placeholder="Имя для мгновенного входа по ссылке или QR"
          />
          <input
            name="directJoinDeviceName"
            placeholder="Название устройства для мгновенного входа"
            defaultValue="Телефон по приглашению"
          />
          <button type="submit">Создать приглашение</button>
        </form>
        {error ? <div className="statusMessage error">{error}</div> : null}
        {invite ? (
          <div className="inviteResultStack" style={{ marginTop: 12 }}>
            <div className="inviteResultCard inviteResultCardAccent">
              <div className="inviteResultLabel">Код приглашения</div>
              <div className="inviteResultValue">{invite.code}</div>
            </div>
            {inviteLink ? (
              <div className="inviteResultCard">
                <div className="inviteResultLabel">Ссылка с полем ввода кода</div>
                <div className="inviteResultLink">{inviteLink}</div>
              </div>
            ) : null}
            {directJoinLink ? (
              <div className="inviteShareCard">
                <div className="inviteShareContent">
                  <div className="inviteResultLabel">Мгновенный вход в чат</div>
                  <div className="inviteResultLink">{directJoinLink}</div>
                  <p className="qrHint">
                    По этой ссылке или QR-коду человек сразу войдёт в чат без ручного ввода кода.
                  </p>
                </div>
                {qrDataUrl ? (
                  <div className="qrCard">
                    <img
                      src={qrDataUrl}
                      alt={`QR-код для приглашения ${invite.code}`}
                      className="qrImage"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
