"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "../moderation/cache";
import { getManagedBreeder, managementKey } from "./api";
import { managementReturn } from "./navigation";
import { AdminBreederForm } from "./breeder-form";
import {
  sourceLabels,
  sourceConsentLabels,
  type ManagedBreeder,
} from "./model";
export function ManagedBreederDetail({ id }: { id?: string }) {
  const actor = useSession().data,
    client = useQueryClient(),
    router = useRouter(),
    search = useSearchParams(),
    source =
      search.get("source") === "OPERATOR_PREPARED"
        ? "OPERATOR_PREPARED"
        : "OWNER_MANAGED";
  const query = useQuery({
    queryKey: managementKey(actor?.id ?? "", "breeder", id, source),
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor!.id, () =>
        getManagedBreeder(id!, source, signal),
      ),
    enabled: Boolean(id) && actor?.role === "ADMIN",
    staleTime: 0,
    retry: false,
  });
  const saved = (row: ManagedBreeder) => {
    void client.invalidateQueries({
      queryKey: ["admin-management", actor!.id],
    });
    if (row.source === "OWNER_MANAGED" && row.userId)
      for (const key of [
        ["breeder", row.userId],
        ["seller", row.userId],
        ["breeder-directory"],
      ])
        void client.invalidateQueries({ queryKey: key });
    router.replace(
      `/admin/breeders/${row.id}?` +
        new URLSearchParams({
          source: row.source,
          returnTo: managementReturn(search.get("returnTo"), "breeders"),
        }),
    );
  };
  if (!actor || actor.role !== "ADMIN") return null;
  const row = query.data;
  return (
    <section className="admin-management">
      <Link href={managementReturn(search.get("returnTo"), "breeders")}>
        До розплідників
      </Link>
      <h1>{id ? "Профіль розплідника" : "Нова приватна чернетка"}</h1>
      {!id ? (
        <AdminBreederForm profile={null} onSaved={saved} />
      ) : query.isPending || query.isFetching ? (
        <p role="status">Завантажуємо профіль…</p>
      ) : query.isError || !row ? (
        <div>
          <p role="alert">Не вдалося завантажити профіль або чернетку.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          <p>
            {sourceLabels[row.source]} ·{" "}
            {row.visibility === "PUBLIC"
              ? "Публічний профіль"
              : "Приватний запис"}
          </p>
          {row.userId && (
            <Link href={`/admin/users/${row.userId}`}>
              Переглянути акаунт власника
            </Link>
          )}
          {row.publicPath && row.userId && row.visibility === "PUBLIC" && (
            <Link href={`/breeders/${row.userId}`}>
              Переглянути публічний профіль
            </Link>
          )}
          {row.source === "OPERATOR_PREPARED" && (
            <section className="dashboard-card">
              <h2>Походження та згода</h2>
              <p>
                Згоду підтверджено оператором. Це не реєстрація чи верифікація
                заводчика.
              </p>
              <dl className="admin-detail-fields">
                {[
                  [
                    "Джерело",
                    sourceConsentLabels[
                      row.consentSource as keyof typeof sourceConsentLabels
                    ],
                  ],
                  [
                    "Дата згоди",
                    row.consentAt
                      ? new Intl.DateTimeFormat("uk-UA", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Europe/Kyiv",
                        }).format(new Date(row.consentAt))
                      : "",
                  ],
                  ["Обсяг дозволу", row.consentScope],
                  ["Довідка про джерело", row.sourceReference],
                  ["Підготував (ID)", row.preparedById],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="muted">
                Джерело й зафіксована згода не змінюються під час редагування
                інформації.
              </p>
            </section>
          )}
          {row.source === "OWNER_MANAGED" &&
          row.user?.accountType !== "BREEDER" ? (
            <p className="status-panel">
              Акаунт власника зараз не є акаунтом заводчика. Інформація доступна
              лише для перегляду.
            </p>
          ) : (
            <AdminBreederForm
              key={row.id + row.updatedAt}
              profile={row}
              onSaved={saved}
            />
          )}
          <section className="dashboard-card">
            <h2>Останні адміністративні зміни</h2>
            {row.audit.length ? (
              <ul>
                {row.audit.map((action) => (
                  <li key={action.id}>
                    {action.action === "CREATE_DRAFT"
                      ? "Створено чернетку"
                      : "Інформацію змінено"}{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("uk-UA", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Europe/Kyiv",
                    }).format(new Date(action.createdAt))}{" "}
                    · Адміністратор: {action.actorId}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Адміністративних змін ще немає.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
