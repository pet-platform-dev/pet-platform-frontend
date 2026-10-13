"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  currentAdmin,
  runAdminRequest,
} from "@/features/admin/moderation/cache";
import {
  ModerationBadge,
  ModerationSkeleton,
  moderationDate,
} from "@/features/admin/moderation/presentation";
import { ListingModerationDetail } from "@/features/admin/moderation/listing-detail";
import { MatingModerationDetail } from "@/features/admin/moderation/mating-detail";
import { ReviewModerationDetail } from "@/features/admin/moderation/review-detail";
import { detailHref } from "@/features/admin/moderation/navigation";
import { ApiError } from "@/shared/api/client";
import { getReport, decideReport } from "./api";
import { reportKeys } from "./admin-cache";
import {
  reasonLabels,
  reportStatusLabels,
  typeLabels,
  businessLabels,
  reportDecisionSchema,
} from "./model";
import { reportDetailHref } from "./navigation";
export function AdminReportDetail({
  id,
  returnTo,
}: {
  id: string;
  returnTo: string;
}) {
  const user = useSession().data!,
    client = useQueryClient(),
    heading = useRef<HTMLHeadingElement>(null),
    locked = useRef(false),
    field = useId();
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: reportKeys.detail(user.id, id),
    queryFn: ({ signal }) =>
      runAdminRequest(client, user.id, () => getReport(id, signal)),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const row = query.data;
  const loadedId = row?.id;
  useEffect(() => {
    if (loadedId) heading.current?.focus({ preventScroll: true });
  }, [loadedId]);
  const mutation = useMutation({
    mutationKey: ["admin-moderation", user.id, "reports", id],
    retry: false,
    mutationFn: (action: "resolve" | "dismiss") =>
      runAdminRequest(client, user.id, () =>
        decideReport(id, action, row!.updatedAt, reason),
      ),
    onSuccess: async (result) => {
      if (!currentAdmin(client, user.id)) return;
      client.setQueryData(reportKeys.detail(user.id, id), {
        ...row,
        ...result,
      });
      setNotice(
        result.status === "RESOLVED"
          ? "Скаргу опрацьовано."
          : "Скаргу відхилено.",
      );
      setReason("");
      await client.invalidateQueries({ queryKey: reportKeys.queue(user.id) });
    },
    onError: (e) => {
      if (!currentAdmin(client, user.id)) return;
      if (e instanceof ApiError && e.status === 409) {
        setStale(true);
        setError("Скаргу змінено або вже опрацьовано. Оновіть дані.");
      } else setError("Не вдалося зберегти рішення. Спробуйте ще раз.");
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  function submit(action: "resolve" | "dismiss") {
    if (locked.current || !row || row.status !== "OPEN" || stale) return;
    const input = reportDecisionSchema.safeParse({
      expectedUpdatedAt: row.updatedAt,
      reason,
    });
    if (!input.success) {
      setError("Додайте примітку від 10 до 1000 символів.");
      return;
    }
    setError("");
    locked.current = true;
    mutation.mutate(action);
  }
  async function refresh() {
    const fresh = await query.refetch();
    if (fresh.isSuccess && currentAdmin(client, user.id)) {
      setStale(false);
      setError("");
      setNotice(
        fresh.data.status === "OPEN"
          ? "Дані оновлено. Перегляньте скаргу перед рішенням."
          : "Скаргу вже опрацьовано.",
      );
    }
  }
  return (
    <section className="admin-moderation">
      <Link className="admin-back-link" href={returnTo} prefetch={false}>
        Повернутися до скарг
      </Link>
      {query.isPending ? (
        <ModerationSkeleton detail />
      ) : query.isError ? (
        <div className="admin-empty">
          <h1>
            {query.error instanceof ApiError && query.error.status === 404
              ? "Скаргу не знайдено"
              : "Не вдалося завантажити скаргу."}
          </h1>
          <button className="button secondary" onClick={() => void refresh()}>
            Спробувати ще раз
          </button>
        </div>
      ) : (
        row && (
          <>
            <header className="admin-page-header">
              <p className="eyebrow">{typeLabels[row.targetType]}</p>
              <h1 ref={heading} tabIndex={-1}>
                {reasonLabels[row.reason]}
              </h1>
              <div className="admin-status-row">
                <span
                  className={
                    "report-status report-status-" + row.status.toLowerCase()
                  }
                >
                  {reportStatusLabels[row.status]}
                </span>
                <time dateTime={row.createdAt}>
                  {moderationDate(row.createdAt)}
                </time>
              </div>
            </header>
            <p role="status">{notice}</p>
            <div className="admin-detail-grid">
              <div className="admin-detail-content">
                <section className="admin-panel">
                  <h2>Скарга</h2>
                  <p>Заявник: {row.reporter.displayName}</p>
                  <p className="admin-full-text">
                    {row.details || "Додаткових деталей немає."}
                  </p>
                  {row.resolutionReason && (
                    <>
                      <h3>Рішення</h3>
                      <p className="admin-full-text">{row.resolutionReason}</p>
                      {row.resolvedAt && (
                        <time dateTime={row.resolvedAt}>
                          {moderationDate(row.resolvedAt)}
                        </time>
                      )}
                    </>
                  )}
                </section>
                <section className="admin-panel">
                  <h2>Матеріал</h2>
                  <p>{row.targetPreview}</p>
                  {row.target ? (
                    <>
                      <ModerationBadge status={row.target.moderationStatus} />
                      {row.target.type !== "REVIEW" && (
                        <p>
                          Стан оголошення: {businessLabels[row.target.status]}
                        </p>
                      )}
                      <Link
                        className="button secondary"
                        prefetch={false}
                        href={detailHref(
                          row.targetType,
                          row.targetId,
                          reportDetailHref(id, returnTo),
                        )}
                      >
                        Відкрити модерацію матеріалу
                      </Link>
                    </>
                  ) : (
                    <p>Матеріал видалено або недоступний. Скаргу збережено.</p>
                  )}
                </section>
                {row.target?.type === "LISTING" ? (
                  <ListingModerationDetail row={row.target} />
                ) : row.target?.type === "MATING_LISTING" ? (
                  <MatingModerationDetail row={row.target} />
                ) : row.target?.type === "REVIEW" ? (
                  <ReviewModerationDetail row={row.target} />
                ) : null}
              </div>
              <aside className="admin-detail-sidebar">
                <section className="admin-panel">
                  <h2>Опрацювання скарги</h2>
                  <p>
                    Рішення щодо скарги не приховує контент. Модеруйте матеріал
                    окремо за потреби.
                  </p>
                  {row.status === "OPEN" ? (
                    <form
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit("resolve");
                      }}
                    >
                      <label htmlFor={field}>Примітка до рішення</label>
                      <textarea
                        className="report-resolution"
                        id={field}
                        rows={5}
                        maxLength={1000}
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={mutation.isPending || query.isFetching}
                        aria-invalid={!!error}
                        aria-describedby={
                          field +
                          "-hint" +
                          (error ? " " + field + "-error" : "")
                        }
                      />
                      <p id={field + "-hint"} className="form-hint">
                        Від 10 до 1000 символів · {reason.trim().length}/1000
                      </p>
                      {error && (
                        <p id={field + "-error"} role="alert">
                          {error}
                        </p>
                      )}
                      {stale && (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => void refresh()}
                        >
                          Оновити
                        </button>
                      )}
                      <div className="admin-actions">
                        <button
                          className="button primary"
                          disabled={
                            mutation.isPending || stale || query.isFetching
                          }
                        >
                          Опрацювати
                        </button>
                        <button
                          type="button"
                          className="button secondary admin-destructive"
                          disabled={
                            mutation.isPending || stale || query.isFetching
                          }
                          onClick={() => submit("dismiss")}
                        >
                          Відхилити скаргу
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p>Скаргу вже опрацьовано.</p>
                  )}
                </section>
              </aside>
            </div>
          </>
        )
      )}
    </section>
  );
}
