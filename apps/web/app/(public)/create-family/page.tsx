import { PageShell } from "@/components/ui/page-shell";
import { CreateFamilyForm } from "@/components/ui/create-family-form";

export default function CreateFamilyPage() {
  return (
    <PageShell
      title="Создайте своё семейное пространство"
      description="Придумайте название, выберите, как подписать себя, и начните общее пространство для близких."
    >
      <section className="metaGrid">
        <div className="meta">
          <div className="metaLabel">Что уже работает</div>
          <div>Создание семьи и автоматический вход в новую семейную сессию уже подключены.</div>
        </div>
        <div className="meta">
          <div className="metaLabel">Для кого это</div>
          <div>Для первого участника семьи, который создаёт общее пространство и приглашает остальных.</div>
        </div>
        <div className="meta" style={{ gridColumn: "1 / -1" }}>
          <CreateFamilyForm />
        </div>
      </section>
    </PageShell>
  );
}
