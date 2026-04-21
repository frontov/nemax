import { PageShell } from "@/components/ui/page-shell";
import { DirectJoinClient } from "@/components/ui/direct-join-client";

export default async function DirectJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PageShell
      title="Входим в Не Мах"
      description="Проверяем приглашение и сразу открываем чат, если ссылка ещё действительна."
    >
      <DirectJoinClient token={token} />
    </PageShell>
  );
}
