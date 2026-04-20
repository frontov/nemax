import { PageShell } from "@/components/ui/page-shell";
import { JoinFamilyForm } from "@/components/ui/join-family-form";

export default async function JoinByInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <PageShell
      title="Присоединение по приглашению"
      description="Введите своё имя, проверьте код и спокойно присоединяйтесь к семейному пространству."
    >
      <section className="metaGrid">
        <div className="meta">
          <div className="metaLabel">Код приглашения</div>
          <div>{code}</div>
        </div>
        <div className="meta">
          <div className="metaLabel">Что произойдёт дальше</div>
          <div>Мы проверим приглашение, создадим участника и сразу откроем доступ к семейному чату.</div>
        </div>
        <div className="meta" style={{ gridColumn: "1 / -1" }}>
          <JoinFamilyForm code={code} />
        </div>
      </section>
    </PageShell>
  );
}
