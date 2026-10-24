"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { roleLabels } from "../management/model";
import {
  changeRole,
  editableRoles,
  runRoleRequest,
  type RoleHistory,
} from "./api";
import { RoleDialog } from "./role-dialog";
export function RoleEditor({
  targetId,
  data,
  refresh,
  onSuccess,
}: {
  targetId: string;
  data: RoleHistory;
  refresh: () => void;
  onSuccess: (message: string, role: RoleHistory["currentRole"]) => void;
}) {
  const actor = useSession().data!,
    client = useQueryClient();
  const [role, setRole] = useState<(typeof editableRoles)[number]>(
    data.currentRole === "MODERATOR" || data.currentRole === "ADMIN"
      ? data.currentRole
      : "USER",
  );
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [stale, setStale] = useState(false);
  const submitted = useRef(false),
    trigger = useRef<HTMLButtonElement>(null);
  if (
    actor.role !== "SUPER_ADMIN" ||
    actor.id === targetId ||
    data.currentRole === "SUPER_ADMIN"
  )
    return null;
  return (
    <div className="admin-management-form">
      <p>
        Змінюється лише технічний доступ. Для кожної операції потрібен ваш
        поточний пароль. Призначення суперадміністраторів тут недоступне.
      </p>
      <div className="field">
        <span>Нова технічна роль</span>
        <SelectDropdown
          label="Нова технічна роль"
          value={role}
          options={editableRoles.map((value) => ({
            value,
            label: roleLabels[value],
          }))}
          onChange={setRole}
          disabled={pending || stale}
        />
      </div>
      <button
        ref={trigger}
        type="button"
        className="button secondary"
        disabled={pending || stale}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Змінити роль
      </button>
      {message && <p role="status">{message}</p>}
      {stale && (
        <button className="button secondary" onClick={refresh}>
          Оновити роль перед новим рішенням
        </button>
      )}
      {open && (
        <RoleDialog
          from={roleLabels[data.currentRole]}
          to={roleLabels[role]}
          pending={pending}
          error={error}
          onClose={() => {
            if (!submitted.current) setOpen(false);
          }}
          returnFocus={() => trigger.current?.focus()}
          onSubmit={async (currentPassword) => {
            if (submitted.current || stale) return;
            submitted.current = true;
            setPending(true);
            setError("");
            const generation = currentSessionGeneration();
            try {
              const result = await runRoleRequest(client, actor.id, () =>
                changeRole(targetId, {
                  role,
                  expectedRole: data.currentRole,
                  expectedUpdatedAt: data.updatedAt,
                  operationId: crypto.randomUUID(),
                  currentPassword,
                }),
              );
              if (generation !== currentSessionGeneration()) return;
              setOpen(false);
              onSuccess(
                result.changed
                  ? "Роль змінено. Попередні сесії користувача завершено."
                  : "Роль уже має це значення. Сесії не змінено.",
                result.role,
              );
              void client.invalidateQueries({
                queryKey: ["admin-management", actor.id, "users"],
              });
              refresh();
            } catch (failure) {
              if (
                generation !== currentSessionGeneration() ||
                client.getQueryData<{ id: string; role: string }>([
                  "current-user",
                ])?.role !== "SUPER_ADMIN"
              )
                return;
              if (failure instanceof ApiError && failure.status === 409) {
                setStale(true);
                setOpen(false);
                setMessage(
                  "Акаунт або роль змінилися. Оновіть дані та перевірте рішення.",
                );
              } else
                setError(
                  failure instanceof ApiError && failure.status === 429
                    ? "Забагато підтверджень. Спробуйте через 15 хвилин."
                    : failure instanceof ApiError && failure.status === 400
                      ? "Перевірте поточний пароль."
                      : "Не вдалося змінити роль. Перевірте доступ і спробуйте знову.",
                );
            } finally {
              submitted.current = false;
              if (generation === currentSessionGeneration()) setPending(false);
            }
          }}
        />
      )}
    </div>
  );
}
