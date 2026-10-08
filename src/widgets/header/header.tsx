"use client";
import Link from "next/link";
import { useSession } from "@/features/auth/session-provider";
export function Header() {
  const { data, isPending } = useSession();
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Лапа — на головну">
        <span className="brand-mark" aria-hidden="true">
          ✦
        </span>{" "}
        лапа<span className="brand-dot">.</span>
      </Link>
      <nav aria-label="Основна навігація">
        <Link className="nav-link" href="/listings">
          Оголошення
        </Link>
        {isPending ? (
          <span className="muted">Зачекайте…</span>
        ) : data ? (
          <>
            <Link className="nav-link" href="/pets">
              Мої тварини
            </Link>
            <Link className="button secondary compact" href="/account">
              Мій профіль
            </Link>
          </>
        ) : (
          <>
            <Link className="nav-link" href="/login">
              Увійти
            </Link>
            <Link className="button primary compact" href="/register">
              Створити акаунт
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
