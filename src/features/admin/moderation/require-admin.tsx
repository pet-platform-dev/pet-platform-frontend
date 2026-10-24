"use client";
import { hasAdminAccess } from "@/entities/user/permissions";

import { Fragment, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { favoriteLoginReturn } from "@/features/favorites/login-return";
import { adminModerationKeys, clearAdminQueries } from "./cache";
export function RequireAdmin({
  children,
  returnTo = "/admin/moderation",
  deniedTitle = "Доступ до модерації недоступний",
}: {
  children: React.ReactNode;
  returnTo?: string;
  deniedTitle?: string;
}) {
  const session = useSession(),
    client = useQueryClient(),
    router = useRouter();
  const user = session.data;
  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") {
      void client.cancelQueries({ queryKey: ["admin-roles"] });
      client.removeQueries({ queryKey: ["admin-roles"] });
    }
  }, [client, user?.role]);
  const access = useQuery({
    queryKey: adminModerationKeys.access(user?.id ?? ""),
    queryFn: () => false,
    initialData: false,
    enabled: false,
  });
  useEffect(() => {
    if (session.isSuccess && !user) {
      clearAdminQueries(client);
      router.replace(
        "/login?" +
          new URLSearchParams({ returnTo: favoriteLoginReturn(returnTo) }),
      );
    } else if (user && !hasAdminAccess(user.role)) clearAdminQueries(client);
  }, [session.isSuccess, user, client, router, returnTo]);
  if (session.isPending || (session.isSuccess && !user))
    return (
      <div className="status-panel" role="status">
        Перевіряємо сесію…
      </div>
    );
  if (session.isError)
    return (
      <div className="status-panel">
        <p role="alert">Не вдалося перевірити сесію.</p>
        <button
          className="button secondary"
          onClick={() => void session.refetch()}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  if (!hasAdminAccess(user?.role) || access.data)
    return (
      <section className="admin-empty">
        <h1>{deniedTitle}</h1>
        <p>Цей розділ доступний лише адміністратору.</p>
        <button
          className="button secondary"
          onClick={async () => {
            const fresh = await session.refetch();
            if (hasAdminAccess(fresh.data?.role))
              client.setQueryData(
                adminModerationKeys.access(fresh.data.id),
                false,
              );
          }}
        >
          Перевірити доступ
        </button>
      </section>
    );
  return <Fragment key={user.id + ":" + user.role}>{children}</Fragment>;
}
