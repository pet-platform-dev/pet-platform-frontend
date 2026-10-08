"use client";
import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./session-provider";
export function RequireSession({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session.isSuccess && !session.data) router.replace("/login");
  }, [session.isSuccess, session.data, router]);
  if (session.isPending || (session.isSuccess && !session.data))
    return (
      <main className="status-panel" role="status">
        Перевіряємо сесію…
      </main>
    );
  if (session.isError)
    return (
      <main className="status-panel">
        <p role="alert">Не вдалося перевірити сесію.</p>
        <button className="button secondary" onClick={() => session.refetch()}>
          Спробувати ще раз
        </button>
      </main>
    );
  return <Fragment key={session.data?.id}>{children}</Fragment>;
}
