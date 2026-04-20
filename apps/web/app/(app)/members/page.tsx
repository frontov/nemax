import { PageShell } from "@/components/ui/page-shell";
import { MembersClient } from "@/components/members/members-client";

export default function MembersPage() {
  return (
    <PageShell
      title="Участники"
      description="Здесь видно, кто уже внутри семейного пространства и кто участвует в общем чате."
    >
      <section className="metaGrid">
        <div className="meta">
          <div className="metaLabel">Что видно сейчас</div>
          <div>Список участников, их роли и текущее состояние профиля.</div>
        </div>
        <div className="meta">
          <div className="metaLabel">Дальше по плану</div>
          <div>Управление ролями, удаление участников и более заметные семейные статусы.</div>
        </div>
      </section>
      <MembersClient />
    </PageShell>
  );
}
