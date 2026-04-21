import { PageShell } from "@/components/ui/page-shell";
import { ChatClient } from "@/components/chat/chat-client";

export default function ChatPage() {
  return (
    <PageShell
      title="Не Мах"
      description="Здесь можно делиться новостями, договариваться о планах и просто быть на связи."
    >
      <div className="chatPageFrame">
        <ChatClient />
      </div>
    </PageShell>
  );
}
