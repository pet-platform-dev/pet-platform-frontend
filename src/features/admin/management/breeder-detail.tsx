"use client";
import { WorkspaceVideos } from "../breeder-workspace/videos";
import { hasAdminAccess } from "@/entities/user/permissions";

import Link from "next/link";
import { WorkspaceMedia } from "../breeder-workspace/media";
import { WorkspaceContacts } from "../breeder-workspace/contacts";
import { WorkspaceListings } from "../breeder-workspace/listings";
import "../breeder-workspace/workspace.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "../moderation/cache";
import { getManagedBreeder, managementKey } from "./api";
import { managementReturn } from "./navigation";
import { AdminBreederForm } from "./breeder-form";
import { sourceLabels, type ManagedBreeder } from "./model";
import { InvitationPanel } from "../invitations/invitation-panel";
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
    enabled: Boolean(id) && hasAdminAccess(actor?.role),
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
  if (!actor || !hasAdminAccess(actor.role)) return null;
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
            <Link href={`/sellers/${row.userId}`}>
              Переглянути публічний профіль
            </Link>
          )}
          {row.source === "OPERATOR_PREPARED" && (
            <p className="status-panel">
              Приватна чернетка. Підготував: {row.preparedById}. Реальний дозвіл
              на використання матеріалів оператор отримує поза додатком.
            </p>
          )}
          {row.source === "OPERATOR_PREPARED" && (
            <InvitationPanel
              key={actor.id + row.id}
              id={row.id}
              revision={row.updatedAt}
            />
          )}
          {row.claimedProfileId && (
            <Link
              href={`/admin/breeders/${row.claimedProfileId}?source=OWNER_MANAGED`}
            >
              Відкрити робоче місце профілю власника
            </Link>
          )}
          <h2>Основна інформація</h2>
          {row.claimedProfileId ? (
            <p className="status-panel">
              Підготовку завершено. Профілем керує справжній власник.
            </p>
          ) : row.source === "OWNER_MANAGED" &&
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
          {!row.claimedProfileId &&
            (row.source === "OPERATOR_PREPARED" ||
              row.user?.accountType === "BREEDER") && (
              <WorkspaceMedia
                key={row.id + row.updatedAt}
                profile={row}
                onSaved={() => {
                  void query.refetch();
                  if (row.userId)
                    for (const queryKey of [
                      ["breeder", row.userId],
                      ["seller", row.userId],
                      ["breeder-directory"],
                      ["own-breeder", row.userId],
                    ])
                      void client.invalidateQueries({ queryKey });
                }}
              />
            )}
          {!row.claimedProfileId &&
            (row.source === "OPERATOR_PREPARED" ||
              row.user?.accountType === "BREEDER") && (
              <WorkspaceContacts
                key={`contacts:${actor.id}:${row.id}:${row.updatedAt}`}
                profile={row}
                onSaved={() => void query.refetch()}
              />
            )}
          {!row.claimedProfileId &&
            (row.source === "OPERATOR_PREPARED" ||
              row.user?.accountType === "BREEDER") && (
              <WorkspaceVideos
                key={`videos:${actor.id}:${row.id}:${row.updatedAt}`}
                profile={row}
                onSaved={() => {
                  void query.refetch();
                  if (row.userId)
                    for (const queryKey of [
                      ["breeder", row.userId],
                      ["own-breeder", row.userId],
                    ])
                      void client.invalidateQueries({ queryKey });
                }}
              />
            )}
          <WorkspaceListings key={actor.id + row.id} profile={row} />
          <section className="dashboard-card">
            <h2>Останні адміністративні зміни</h2>
            {row.audit.length ? (
              <ul>
                {row.audit.map((action) => (
                  <li key={action.id}>
                    {
                      {
                        CREATE_DRAFT: "Створено чернетку",
                        UPDATE_DRAFT: "Інформацію змінено",
                        UPDATE_OWNER_PROFILE: "Профіль змінено",
                        INVITATION_ISSUED: "Створено запрошення",
                        INVITATION_ROTATED: "Запрошення надіслано повторно",
                        INVITATION_REVOKED: "Запрошення відкликано",
                        CLAIM_ACCEPTED: "Власник прийняв профіль",
                      }[action.action]
                    }{" "}
                    ·{" "}
                    {new Intl.DateTimeFormat("uk-UA", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Europe/Kyiv",
                    }).format(new Date(action.createdAt))}{" "}
                    · Учасник дії: {action.actorId}
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
