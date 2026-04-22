import { PageShell } from "@/components/ui/page-shell";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export default function NotificationsPage() {
  return (
    <PageShell
      title="Уведомления"
      description="Включите push-уведомления на этом устройстве, чтобы не пропускать новые сообщения."
    >
      <NotificationsClient />
    </PageShell>
  );
}
