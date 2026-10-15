"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationActive } from "./navigation-active";
import { MobileNavigation } from "./mobile-navigation";
import { useSession } from "@/features/auth/session-provider";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { MessageNavigation } from "@/features/conversations/message-navigation";
export function Header() {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Лапа — на головну">
        <span className="brand-mark" aria-hidden="true">
          ✦
        </span>{" "}
        лапа<span className="brand-dot">.</span>
      </Link>
      <div className="header-actions">
        <nav className="desktop-navigation" aria-label="Основна навігація">
          <Link
            className="nav-link"
            href="/listings"
            aria-current={
              navigationActive(pathname, "/listings") ? "page" : undefined
            }
          >
            Оголошення
          </Link>
          <Link
            className="nav-link"
            href="/mating"
            aria-current={
              pathname === "/mating" || pathname.startsWith("/mating/")
                ? "page"
                : undefined
            }
          >
            В’язка
          </Link>
          {isPending ? (
            <span className="muted">Зачекайте…</span>
          ) : data ? (
            <>
              <Link
                className="nav-link"
                href="/favorites"
                aria-current={
                  navigationActive(pathname, "/favorites") ? "page" : undefined
                }
              >
                Обране
              </Link>
              <Link
                className="nav-link"
                href="/my-listings"
                aria-current={
                  navigationActive(pathname, "/my-listings")
                    ? "page"
                    : undefined
                }
              >
                Мої оголошення
              </Link>
              <Link
                className="nav-link"
                href="/pets"
                aria-current={
                  navigationActive(pathname, "/pets") ? "page" : undefined
                }
              >
                Мої тварини
              </Link>
              <Link
                className="button neutral compact"
                href="/account"
                aria-current={
                  navigationActive(pathname, "/account") ? "page" : undefined
                }
              >
                Мій профіль
              </Link>
            </>
          ) : (
            <>
              <Link
                className="nav-link"
                href="/login"
                aria-current={
                  navigationActive(pathname, "/login") ? "page" : undefined
                }
              >
                Увійти
              </Link>
              <Link className="button primary compact" href="/register">
                Створити акаунт
              </Link>
            </>
          )}
        </nav>
        <MessageNavigation
          key={`messages:${pathname}`}
          active={pathname === "/messages" || pathname.startsWith("/messages/")}
        />
        <NotificationBell key={`notifications:${pathname}`} />
        <MobileNavigation
          key={pathname}
          pathname={pathname}
          authenticated={Boolean(data)}
          pending={isPending}
        />
      </div>
    </header>
  );
}
