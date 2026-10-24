"use client";
import { hasAdminAccess } from "@/entities/user/permissions";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "../moderation/cache";
import { getManagedUser, managementKey } from "./api";
import { managementReturn } from "./navigation";
import { roleLabels, accountLabels, verificationLabels } from "./model";
import type { ManagedUser } from "./model";
import { RolePanel } from "../roles/role-panel";
export function ManagedUserDetail({ id }: { id: string }) {
  const actor = useSession().data,
    client = useQueryClient(),
    search = useSearchParams();
  const query = useQuery({
    queryKey: managementKey(actor?.id ?? "", "user", id),
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor!.id, () => getManagedUser(id, signal)),
    enabled: hasAdminAccess(actor?.role),
    staleTime: 0,
    retry: false,
  });
  if (!actor || !hasAdminAccess(actor.role)) return null;
  const row = query.data;
  return (
    <section className="admin-management">
      <Link href={managementReturn(search.get("returnTo"), "users")}>
        До користувачів
      </Link>
      <h1>Обліковий запис</h1>
      {query.isPending || query.isFetching ? (
        <p role="status">Завантажуємо акаунт…</p>
      ) : query.isError || !row ? (
        <div>
          <p role="alert">
            Не вдалося завантажити акаунт. Можливо, його не знайдено.
          </p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          <dl className="admin-detail-fields dashboard-card">
            {[
              ["Ідентифікатор", row.id],
              [
                "Зареєстроване ім’я",
                [row.firstName, row.lastName].filter(Boolean).join(" "),
              ],
              ["Електронна адреса", row.email],
              ["Технічна роль", roleLabels[row.role]],
              ["Тип акаунта", accountLabels[row.accountType]],
              [
                "Підтвердження пошти",
                verificationLabels[row.verificationStatus],
              ],
              [
                "Дата реєстрації",
                new Intl.DateTimeFormat("uk-UA", {
                  dateStyle: "medium",
                  timeZone: "Europe/Kyiv",
                }).format(new Date(row.createdAt)),
              ],
              ["Тварини", row.counts.pets],
              ["Оголошення", row.counts.listings],
              ["Оголошення про в’язку", row.counts.matingListings],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="account-actions">
            <Link className="button secondary" href={`/sellers/${row.id}`}>
              Публічний профіль
            </Link>
            {row.breederPath && row.accountType === "BREEDER" && (
              <Link className="button secondary" href={`/breeders/${row.id}`}>
                Профіль розплідника
              </Link>
            )}
          </div>
          <p className="muted">
            Зміна електронної адреси, пароля, типу акаунта й підтвердження пошти
            тут недоступна.
          </p>
          <RolePanel
            key={row.id}
            targetId={row.id}
            onRoleChanged={(role) =>
              client.setQueryData<ManagedUser>(
                managementKey(actor.id, "user", id),
                (current) => (current ? { ...current, role } : current),
              )
            }
          />
        </>
      )}
    </section>
  );
}
