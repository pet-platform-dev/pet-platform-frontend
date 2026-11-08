"use client";
import Link from "next/link";
import { useWorkspaceBusy } from "./session";
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const busy = useWorkspaceBusy();
  return (
    <main
      className="catalog-shell services-shell services-workspace"
      aria-busy={busy}
    >
      <nav className="workspace-actions" aria-label="Навігація послуг">
        <Link href="/account">Мій профіль</Link>
        <Link href="/my-services">Профілі послуг</Link>
        <Link href="/services">Публічний каталог</Link>
      </nav>
      {children}
    </main>
  );
}
