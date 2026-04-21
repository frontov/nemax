import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";

const adminCards = [
  {
    href: "/create-family",
    title: "Создание семьи",
    body: "Запустить новое семейное пространство и создать первую сессию владельца.",
  },
  {
    href: "/add-member",
    title: "Приглашения",
    body: "Создавать коды и приглашать новых участников в уже существующую семью.",
  },
  {
    href: "/members",
    title: "Участники",
    body: "Смотреть состав семьи, роли и постепенно добавлять модерацию.",
  },
  {
    href: "/devices",
    title: "Устройства",
    body: "Проверять активные устройства и будущие настройки безопасности.",
  },
  {
    href: "/notifications",
    title: "Уведомления",
    body: "Настраивать уведомления, тихие часы и поведение для семьи.",
  },
  {
    href: "/chat",
    title: "Открыть чат",
    body: "Быстро перейти в сам чат, если нужно проверить работу живой переписки.",
  },
];

export default function AdminPage() {
  return (
    <main className="shell">
      <div className="frame">
        <section className="page">
          <div className="pageHeader">
            <div>
              <span className="eyebrow">админка</span>
              <h1>Управление семейным пространством</h1>
              <p>
                Здесь собраны служебные разделы: создание семьи, приглашения, участники,
                устройства и настройки. Обычным пользователям достаточно главной страницы
                с кодом приглашения.
              </p>
            </div>
          </div>

          <nav className="nav" aria-label="Административные разделы">
            <Link href="/">Пользовательский вход</Link>
            <Link href="/chat">Чат</Link>
          </nav>

          <section className="grid">
            {adminCards.map((card) => (
              <Link key={card.href} href={card.href} className="card cardLink">
                <strong>{card.title}</strong>
                <span>{card.body}</span>
              </Link>
            ))}
          </section>

          <LogoutButton />
        </section>
      </div>
    </main>
  );
}
