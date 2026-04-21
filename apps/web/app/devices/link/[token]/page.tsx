import { DeviceLinkJoinClient } from "@/components/devices/device-link-join-client";
import { PageShell } from "@/components/ui/page-shell";

export default async function DeviceLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PageShell
      title="Добавляем устройство"
      description="Проверяем ссылку и подключаем этот браузер к вашему семейному чату."
    >
      <DeviceLinkJoinClient token={token} />
    </PageShell>
  );
}
