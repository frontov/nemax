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

  useEffect(() => {
    void apiClient
      .request<Member[]>({ path: "/members" })
      .then(setMembers)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить участников"),
      );
  }, []);

  return (
    <section className="metaGrid">
      <div className="meta" style={{ gridColumn: "1 / -1" }}>
        <div className="metaLabel">Состав семьи</div>
        {error ? <div className="statusMessage error">{error}</div> : null}
        <div style={{ display: "grid", gap: 12 }}>
          {members.map((member) => (
            <article key={member.id} className="card">
              <strong>{member.user.displayName}</strong>
              <span>
                {member.role} • {member.user.status === "active" ? "активен" : member.user.status}
              </span>
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
