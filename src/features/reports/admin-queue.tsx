"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "@/features/admin/moderation/cache";
import {
  ModerationSkeleton,
  moderationDate,
} from "@/features/admin/moderation/presentation";
import { CatalogPagination } from "@/widgets/listings-catalog/catalog-pagination";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { getReports } from "./api";
import { reportKeys } from "./admin-cache";
import {
  reasonLabels,
  statusLabels,
  reportStatusLabels,
  typeLabels,
  reportStatuses,
  type ReportStatus,
  type ReportType,
} from "./model";
import { reportsHref, reportDetailHref, type ReportsState } from "./navigation";
export function AdminReportQueue({ state }: { state: ReportsState }) {
  const user = useSession().data!,
    client = useQueryClient(),
    router = useRouter();
  const query = useQuery({
    queryKey: reportKeys.queue(user.id, state),
    queryFn: ({ signal }) =>
      runAdminRequest(client, user.id, () => getReports(state, signal)),
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (
      query.data &&
      !query.isFetching &&
      !query.isError &&
      state.page > Math.max(1, query.data.meta.pages)
    )
      router.replace(
        reportsHref({ ...state, page: Math.max(1, query.data.meta.pages) }),
        { scroll: false },
      );
  }, [query.data, query.isFetching, query.isError, state, router]);
  const change = (patch: Partial<ReportsState>) =>
    router.push(reportsHref({ ...state, ...patch, page: 1 }), {
      scroll: false,
    });
  return (
    <section className="admin-moderation">
      <header className="admin-page-header">
        <Link
          className="admin-back-link"
          href="/admin/moderation"
          prefetch={false}
        >
          Модерація контенту
        </Link>
        <h1>Скарги користувачів</h1>
        <p>Перевіряйте звернення окремо від рішень щодо контенту.</p>
        {query.data && !query.isFetching && !query.isError && (
          <p role="status">Скарг: {query.data.meta.total}</p>
        )}
      </header>
      <div className="admin-filters">
        <div>
          <p className="filter-label">Тип матеріалу</p>
          <SelectDropdown
            label="Тип матеріалу"
            value={state.type ?? ""}
            options={[
              { value: "", label: "Усі" },
              ...Object.entries(typeLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            onChange={(type) =>
              change({ type: (type as ReportType) || undefined })
            }
          />
        </div>
        <div>
          <p className="filter-label">Статус скарги</p>
          <SelectDropdown
            label="Статус скарги"
            value={state.status}
            options={reportStatuses.map((value) => ({
              value,
              label: statusLabels[value],
            }))}
            onChange={(status) => change({ status: status as ReportStatus })}
          />
        </div>
      </div>
      {query.isFetching || query.isPending ? (
        <ModerationSkeleton />
      ) : query.isError ? (
        <div className="admin-empty">
          <p role="alert">Не вдалося завантажити скарги.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : query.data.data.length ? (
        <>
          <div className="admin-queue-grid">
            {query.data.data.map((row) => (
              <article className="admin-queue-card" key={row.id}>
                <Link
                  className="admin-card-link"
                  href={reportDetailHref(row.id, reportsHref(state))}
                  prefetch={false}
                >
                  <header>
                    <span className="eyebrow">
                      {typeLabels[row.targetType]}
                    </span>
                    <span
                      className={
                        "report-status report-status-" +
                        row.status.toLowerCase()
                      }
                    >
                      {reportStatusLabels[row.status]}
                    </span>
                  </header>
                  <h2>{reasonLabels[row.reason]}</h2>
                  <p>{row.targetPreview}</p>
                  {row.contextSummary && (
                    <p className="muted">Оголошення: {row.contextSummary}</p>
                  )}
                  {row.detailsExcerpt && (
                    <p className="admin-excerpt">{row.detailsExcerpt}</p>
                  )}
                  <p className="muted">Заявник: {row.reporter.displayName}</p>
                  <time dateTime={row.createdAt}>
                    {moderationDate(row.createdAt)}
                  </time>
                  <span className="button secondary compact admin-card-cta">
                    Переглянути
                  </span>
                </Link>
              </article>
            ))}
          </div>
          <CatalogPagination
            sort="oldest"
            page={state.page}
            pages={query.data.meta.pages}
            hrefForPage={(page) => reportsHref({ ...state, page })}
            label="Сторінки скарг"
          />
        </>
      ) : (
        <div className="admin-empty">
          <h2>Скарг за цими фільтрами немає.</h2>
        </div>
      )}
    </section>
  );
}
