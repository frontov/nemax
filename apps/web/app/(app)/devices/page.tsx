import { PageShell } from "@/components/ui/page-shell";
import { DevicesClient } from "@/components/devices/devices-client";

export default function DevicesPage() {
  return (
    <PageShell
      title="Устройства"
      description="Раздел для понимания, с каких устройств семья входит в пространство и где активны сессии."
    >
      <section className="metaGrid">
        <div className="meta">
          <div className="metaLabel">Что отслеживается</div>
          <div>Устройства, сессии и будущая поддержка push-подписок.</div>
        </div>
        <div className="meta">
          <div className="metaLabel">Поддержка инфраструктуры</div>
          <div>Redis и MinIO уже подключены, чтобы дальше расширять семейные сценарии.</div>
        </div>
      </section>
      <DevicesClient />
    </PageShell>
  );
}
