"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { RequireAdmin } from "../moderation/require-admin";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    search = useSearchParams().toString();
  const links = [
    ["/admin", "Огляд"],
    ["/admin/moderation", "Модерація"],
    ["/admin/moderation/reports", "Скарги"],
  ];
  return (
    <RequireAdmin
      returnTo={path + (search ? "?" + search : "")}
      deniedTitle="Доступ до адміністрування недоступний"
    >
      <div className="catalog-shell admin-shell-nav">
        <nav className="admin-shell-links" aria-label="Адміністрування">
          {links.map(([href, label]) => {
            const active =
              href === "/admin"
                ? path === href
                : href.endsWith("reports")
                  ? path.startsWith(href)
                  : path.startsWith(href) &&
                    !path.startsWith("/admin/moderation/reports");
            return (
              <Link
                key={href}
                className="button secondary compact"
                aria-current={active ? "page" : undefined}
                href={href}
                prefetch={false}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Link href="/listings" className="button secondary compact">
          До оголошень
        </Link>
      </div>
      {children}
    </RequireAdmin>
  );
}
