"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getRoleHistory, runRoleRequest, type RoleHistory } from "./api";
import { RoleEditor } from "./role-editor";
import { roleLabels } from "../management/model";
export function RolePanel({
  targetId,
  onRoleChanged,
}: {
  targetId: string;
  onRoleChanged?: (role: RoleHistory["currentRole"]) => void;
}) {
  const [message, setMessage] = useState("");
  const actor = useSession().data,
    client = useQueryClient();
  const key = ["admin-roles", actor?.id ?? "", targetId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      runRoleRequest(client, actor!.id, () => getRoleHistory(targetId, signal)),
    enabled: actor?.role === "SUPER_ADMIN",
    staleTime: 0,
    retry: false,
  });
  if (actor?.role !== "SUPER_ADMIN") return null;
  if (query.isPending || query.isFetching)
    return <p role="status">Перевіряємо роль…</p>;
  if (query.isError || !query.data)
    return (
      <div>
        <p role="alert">Не вдалося перевірити роль.</p>
        <button
          className="button secondary"
          onClick={() => void query.refetch()}
        >
          Повторити перевірку ролі
        </button>
      </div>
    );
  const data = query.data;
  return (
    <section className="dashboard-card admin-management">
      <h2>Технічний доступ</h2>
      <p>Поточна роль: {roleLabels[data.currentRole]}</p>
      {message && <p role="status">{message}</p>}
      {actor.id === targetId || data.currentRole === "SUPER_ADMIN" ? (
        <p>
          Зміна власної ролі та повноважень суперадміністратора через цей
          редактор недоступна.
        </p>
      ) : (
        <RoleEditor
          key={targetId + data.updatedAt}
          targetId={targetId}
          data={data}
          onSuccess={(message, role) => {
            setMessage(message);
            onRoleChanged?.(role);
          }}
          refresh={() => void client.invalidateQueries({ queryKey: key })}
        />
      )}
      <h3>Останні зміни ролі</h3>
      {data.entries.length ? (
        <ul>
          {data.entries.map((entry) => (
            <li key={entry.operationId}>
              {roleLabels[entry.previousRole]} → {roleLabels[entry.newRole]} ·{" "}
              {new Intl.DateTimeFormat("uk-UA", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Europe/Kyiv",
              }).format(new Date(entry.createdAt))}{" "}
              ·{" "}
              {entry.origin === "LOCAL_OPERATOR"
                ? "Локальна операторська процедура"
                : `Адміністратор: ${entry.actorId}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>Змін ролі ще немає.</p>
      )}
    </section>
  );
}
