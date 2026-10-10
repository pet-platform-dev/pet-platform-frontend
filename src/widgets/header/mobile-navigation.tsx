"use client";
import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useNavigationDismiss } from "./use-navigation-dismiss";
export function MobileNavigation({
  authenticated,
  pending,
  pathname,
}: {
  authenticated: boolean;
  pending: boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false),
    id = useId();
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus({ preventScroll: true });
  }, []);
  useNavigationDismiss(root, open, close);
  const items = authenticated
    ? [
        { href: "/listings", label: "Оголошення" },
        { href: "/my-listings", label: "Мої оголошення" },
        { href: "/pets", label: "Мої тварини" },
        { href: "/account", label: "Мій профіль" },
      ]
    : [
        { href: "/listings", label: "Оголошення" },
        ...(!pending
          ? [
              { href: "/login", label: "Увійти" },
              { href: "/register", label: "Створити акаунт" },
            ]
          : []),
      ];
  return (
    <div
      className="mobile-navigation"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          close(true);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="mobile-navigation-trigger"
        aria-label={open ? "Закрити меню" : "Відкрити меню"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="m6 6 12 12M6 18 18 6" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
      {open && (
        <nav
          id={id}
          className="mobile-navigation-panel"
          aria-label="Мобільна навігація"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                pathname === item.href ||
                pathname.startsWith(item.href + "/") ||
                (item.href === "/account" && pathname === "/profile")
                  ? "page"
                  : undefined
              }
              onClick={() => close()}
            >
              {item.label}
            </Link>
          ))}
          {pending && (
            <span className="muted" role="status">
              Зачекайте…
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
