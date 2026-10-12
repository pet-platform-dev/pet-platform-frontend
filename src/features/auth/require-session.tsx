"use client";
import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { favoriteLoginReturn } from "@/features/favorites/login-return";
import { useSession } from "./session-provider";
export function RequireSession({
  children,
  returnTo,
}: {
  children: React.ReactNode;
  returnTo?: string;
}) {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session.isSuccess && !session.data)
      router.replace(
        returnTo
          ? "/login?" +
              new URLSearchParams({ returnTo: favoriteLoginReturn(returnTo) })
          : "/login",
      );
  }, [session.isSuccess, session.data, router, returnTo]);
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
