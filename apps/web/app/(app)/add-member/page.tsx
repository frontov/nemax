import { PageShell } from "@/components/ui/page-shell";
import { InviteForm } from "@/components/qr/invite-form";

export default function AddMemberPage() {
  return (
    <PageShell
      title="Пригласить близкого"
      description="Создайте приглашение для родственника или друга семьи и поделитесь кодом, ссылкой или QR-кодом."
    >
      <section className="metaGrid">
        <div className="meta">
          <div className="metaLabel">Способы приглашения</div>
          <div>Короткий код, ссылка и QR-код для быстрого входа с телефона.</div>
        </div>
        <div className="meta">
          <div className="metaLabel">Что уже подключено</div>
          <div>Создание приглашений уже работает и связано с текущим семейным пространством.</div>
        </div>
        <div className="meta" style={{ gridColumn: "1 / -1" }}>
          <InviteForm />
        </div>
      </section>
    </PageShell>
  );
}
