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

export function MembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  async function loadMembers() {
    await apiClient
      .request<Member[]>({ path: "/members" })
      .then(setMembers)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить участников"),
      );
  }

  useEffect(() => {
    void loadMembers();
  }, []);

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
        body: JSON.stringify({ memberId: member.id }),
      });
      await loadMembers();
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
