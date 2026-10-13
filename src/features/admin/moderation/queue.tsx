"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { CatalogPagination } from "@/widgets/listings-catalog/catalog-pagination";
import { getModerationQueue } from "./api";
import { adminModerationKeys, runAdminRequest } from "./cache";
import { queueHref, type QueueState } from "./navigation";
import { type ContentType, type QueueStatus } from "./model";
import { ModerationQueueCard } from "./queue-card";
import { ModerationSkeleton } from "./presentation";
export function ModerationQueuePage({ state }: { state: QueueState }) {
  const user = useSession().data!,
    client = useQueryClient(),
    router = useRouter();
  const query = useQuery({
    queryKey: adminModerationKeys.queue(user.id, state),
    queryFn: ({ signal }) =>
      runAdminRequest(client, user.id, () => getModerationQueue(state, signal)),
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (
      query.data &&
      !query.isFetching &&
      !query.isError &&
      state.page > Math.max(1, query.data.meta.pages)
    )
      router.replace(
        queueHref({ ...state, page: Math.max(1, query.data.meta.pages) }),
        { scroll: false },
      );
  }, [query.data, query.isFetching, query.isError, state, router]);
  const change = (next: Partial<QueueState>) =>
    router.push(queueHref({ ...state, ...next, page: 1 }), { scroll: false });
  return (
    <section className="admin-moderation">
      <header className="admin-page-header">
        <nav className="admin-actions" aria-label="Розділи модерації">
          <Link
            className="button secondary"
            href="/admin/moderation/reports"
            prefetch={false}
          >
            Скарги користувачів
          </Link>
        </nav>
        <h1>Модерація</h1>
        <p>Перевіряйте оголошення, в’язку та відгуки перед публікацією.</p>
        {query.data && !query.isFetching && !query.isError && (
          <p role="status">
            {state.status === "PENDING"
              ? "Очікують на перевірку"
              : "Матеріалів за фільтрами"}
            : {query.data.meta.total}
          </p>
        )}
      </header>
      <div className="admin-filters">
        <div>
          <p className="filter-label">Тип матеріалу</p>
          <SelectDropdown
            label="Тип матеріалу"
            value={state.type ?? ""}
            onChange={(value) =>
              change({ type: (value as ContentType) || undefined })
            }
            options={[
              { value: "", label: "Усі" },
              { value: "LISTING", label: "Оголошення" },
              { value: "MATING_LISTING", label: "В’язка" },
              { value: "REVIEW", label: "Відгуки" },
            ]}
          />
        </div>
        <div>
          <p className="filter-label">Статус модерації</p>
          <SelectDropdown
            label="Статус модерації"
            value={state.status}
            onChange={(value) => change({ status: value as QueueStatus })}
            options={[
              { value: "PENDING", label: "На модерації" },
              { value: "APPROVED", label: "Схвалено" },
              { value: "REJECTED", label: "Відхилено" },
              { value: "HIDDEN", label: "Приховано" },
            ]}
          />
        </div>
      </div>
      {query.isPending || query.isFetching ? (
        <ModerationSkeleton />
      ) : query.isError ? (
        <section className="admin-empty">
          <p role="alert">Не вдалося завантажити чергу модерації.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </section>
      ) : (
        <>
          {query.data.data.length ? (
            <div className="admin-queue-grid">
              {query.data.data.map((row) => (
                <ModerationQueueCard
                  key={row.type + row.id}
                  row={row}
                  returnTo={queueHref(state)}
                />
              ))}
            </div>
          ) : (
            <section className="admin-empty">
              <h2>
                {state.status === "PENDING" && !state.type
                  ? "Черга модерації порожня"
                  : "Матеріалів за цими фільтрами не знайдено."}
              </h2>
              {state.status === "PENDING" && !state.type && (
                <p>Нових матеріалів для перевірки поки немає.</p>
              )}
            </section>
          )}
          <CatalogPagination
            label="Сторінки черги модерації"
            page={state.page}
            pages={query.data.meta.pages}
            sort="newest"
            hrefForPage={(page) => queueHref({ ...state, page })}
          />
        </>
      )}
    </section>
  );
}
