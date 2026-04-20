import type { ReactNode } from "react";
import Link from "next/link";

type PageShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

const routes = [
  { href: "/admin", label: "Админка" },
  { href: "/", label: "Пользовательский вход" },
  { href: "/members", label: "Участники" },
  { href: "/add-member", label: "Пригласить" },
  { href: "/devices", label: "Устройства" },
  { href: "/notifications", label: "Уведомления" },
  { href: "/create-family", label: "Создать семью" },
];

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="shell">
      <div className="frame">
        <section className="page">
          <div className="pageHeader">
            <div>
              <span className="eyebrow">администрирование</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
          </div>

          <nav className="nav" aria-label="Разделы приложения">
            {routes.map((route) => (
              <Link key={route.href} href={route.href}>
                {route.label}
              </Link>
            ))}
          </nav>

          {children}
        </section>
      </div>
    </div>
  );
}
