import { PageShell } from "@/components/ui/page-shell";

export default function NotificationsPage() {
  return (
    <PageShell
      title="Уведомления"
      description="Здесь постепенно появятся спокойные и понятные настройки уведомлений для всей семьи."
    >
      <section className="metaGrid">
        <div className="meta">
          <div className="metaLabel">Что уже сохранено</div>
          <div>Настройки уведомлений и push-подписки уже описаны в базе данных.</div>
        </div>
        <div className="meta">
          <div className="metaLabel">Что будет дальше</div>
          <div>Тихие часы, выбор важных уведомлений и более бережный режим общения.</div>
        </div>
      </section>
    </PageShell>
  );
}
