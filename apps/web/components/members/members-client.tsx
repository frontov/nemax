"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type Member = {
  id: string;
  role: string;
  user: {
    id: string;
    displayName: string;
    status: string;
  };
};

type MePayload = {
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

export function MembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<MePayload | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  async function loadMembers(familyId: string) {
    if (!familyId) {
      setMembers([]);
      return;
    }

    await apiClient
      .request<Member[]>({ path: `/members?familyId=${encodeURIComponent(familyId)}` })
      .then(setMembers)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить участников"),
      );
  }

  useEffect(() => {
    void apiClient
      .request<MePayload>({ path: "/auth/me" })
      .then((payload) => {
        const familyId = payload.family?.id ?? payload.memberships[0]?.family.id ?? "";
        setMe(payload);
        setSelectedFamilyId(familyId);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить список чатов"),
      );
  }, []);

  useEffect(() => {
    setError(null);
    void loadMembers(selectedFamilyId);
  }, [selectedFamilyId]);

  async function handleRemoveMember(member: Member) {
    const confirmed = window.confirm(`Удалить участника ${member.user.displayName} из чата?`);

    if (!confirmed) {
      return;
    }

    setError(null);
    setRemovingMemberId(member.id);

    try {
      await apiClient.request({
        path: "/members/remove",
        method: "POST",
        body: JSON.stringify({
          memberId: member.id,
          familyId: selectedFamilyId,
        }),
      });
      await loadMembers(selectedFamilyId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить участника");
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Состав семьи</div>
        <div className="sectionStack" style={{ marginBottom: 12 }}>
          <label className="fieldLabel" htmlFor="membersFamilyId">
            Чат
          </label>
          <select
            id="membersFamilyId"
            value={selectedFamilyId}
            onChange={(event) => setSelectedFamilyId(event.target.value)}
            disabled={!me?.memberships.length}
          >
            {me?.memberships.map((membership) => (
              <option key={membership.id} value={membership.family.id}>
                {membership.family.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <div className="statusMessage error">{error}</div> : null}
        <div style={{ display: "grid", gap: 12 }}>
          {members.map((member) => (
            <article key={member.id} className="card memberCard">
              <div>
                <strong>{member.user.displayName}</strong>
                <span>
                  {member.role} • {member.user.status === "active" ? "активен" : member.user.status}
                </span>
              </div>
              <button
                type="button"
                className="secondaryButton dangerButton"
                onClick={() => void handleRemoveMember(member)}
                disabled={removingMemberId === member.id}
              >
                {removingMemberId === member.id ? "Удаляем…" : "Удалить"}
              </button>
            </article>
          ))}
          {members.length === 0 && !error ? (
            <div className="statusMessage">Пока здесь нет участников.</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
