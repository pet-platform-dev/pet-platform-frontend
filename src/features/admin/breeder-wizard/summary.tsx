"use client";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getContentList } from "../content/api";
import { runAdminRequest } from "../moderation/cache";
import type { ManagedBreeder } from "../management/model";
export function WizardSummary({
  profile,
  active,
}: {
  profile: ManagedBreeder;
  active: boolean;
}) {
  const client = useQueryClient();
  const actor = useSession().data!,
    query = useQuery({
      queryKey: ["admin-management", actor.id, "wizard-summary", profile.id],
      queryFn: ({ signal }) =>
        runAdminRequest(client, actor.id, async () => {
          const pages = await Promise.all(
            ["DRAFT", "READY_FOR_REVIEW"].map((status) =>
              getContentList(
                new URLSearchParams({
                  source: "OPERATOR_DRAFT",
                  breederDraftId: profile.id,
                  status,
                  limit: "1",
                }),
                false,
                signal,
              ),
            ),
          );
          return {
            total: pages.reduce((sum, page) => sum + page.meta.total, 0),
          };
        }),
      enabled: active,
      retry: false,
    });
  return (
    <section className="dashboard-card">
      <h3>{profile.kennelName || "Назву не вказано"}</h3>
      <p>{profile.description || "Опис не вказано"}</p>
      <dl className="admin-detail-fields">
        <div>
          <dt>Породи</dt>
          <dd>
            {profile.breeds
              .map((b) => b.breed.nameUk ?? b.breed.name)
              .join(", ") || "Не вказано"}
          </dd>
        </div>
        <div>
          <dt>Місце</dt>
          <dd>
            {profile.location
              ? `${profile.location.city}, ${profile.location.region}`
              : "Не вказано"}
          </dd>
        </div>
        <div>
          <dt>Фотографії</dt>
          <dd>
            {profile.media?.filter((m) => m.type === "IMAGE").length ?? 0}
          </dd>
        </div>
        <div>
          <dt>Відео</dt>
          <dd>
            {profile.media?.filter((m) => m.type === "VIDEO").length ?? 0}
          </dd>
        </div>
        <div>
          <dt>Підготовлені оголошення</dt>
          <dd>
            {query.isPending ? (
              "Завантажуємо…"
            ) : query.isError ? (
              <button type="button" onClick={() => void query.refetch()}>
                Повторити підрахунок
              </button>
            ) : (
              query.data.total
            )}
          </dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>Приватна чернетка. Завершення не публікує профіль.</dd>
        </div>
      </dl>
      <div className="breeder-workspace-photos">
        {profile.media
          ?.filter((m) => m.type === "LOGO" || m.type === "COVER")
          .map((m) => (
            <Image
              key={m.id}
              src={m.url}
              alt={m.type === "LOGO" ? "Логотип" : "Банер"}
              width={240}
              height={150}
              unoptimized
            />
          ))}
      </div>
    </section>
  );
}
