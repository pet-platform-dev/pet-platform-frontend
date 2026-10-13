"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getModerationDetail } from "./api";
import { adminModerationKeys, currentAdmin, runAdminRequest } from "./cache";
import { type ContentType, typeLabels } from "./model";
import {
  ModerationBadge,
  ModerationIdentity,
  ModerationSkeleton,
  moderationDate,
} from "./presentation";
import { ListingModerationDetail } from "./listing-detail";
import { MatingModerationDetail } from "./mating-detail";
import { ReviewModerationDetail } from "./review-detail";
import { ModerationActions } from "./actions";
import { ApiError } from "@/shared/api/client";
export function ModerationDetailShell({
  type,
  id,
  returnTo,
}: {
  type: ContentType;
  id: string;
  returnTo: string;
}) {
  const user = useSession().data!,
    client = useQueryClient(),
    heading = useRef<HTMLHeadingElement>(null),
    noticeRef = useRef<HTMLParagraphElement>(null);
  const [stale, setStale] = useState(false),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: adminModerationKeys.detail(user.id, type, id),
    queryFn: ({ signal }) =>
      runAdminRequest(client, user.id, () =>
        getModerationDetail(type, id, signal),
      ),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const row = query.data;
  useEffect(() => {
    if (row?.id) heading.current?.focus({ preventScroll: true });
  }, [row?.id]);
  async function refresh() {
    const previous = row?.moderationStatus;
    const fresh = await query.refetch();
    if (fresh.isSuccess && currentAdmin(client, user.id)) {
      setStale(false);
      setNotice(
        previous !== fresh.data.moderationStatus
          ? "Цей матеріал уже було опрацьовано."
          : "Дані оновлено. Перегляньте зміст перед новим рішенням.",
      );
      await client.invalidateQueries({
        queryKey: adminModerationKeys.queue(user.id),
      });
    }
  }
  return (
    <section className="admin-moderation">
      <Link className="admin-back-link" prefetch={false} href={returnTo}>
        {returnTo.startsWith("/admin/moderation/reports/")
          ? "Повернутися до скарги"
          : "Повернутися до черги"}
      </Link>
      {query.isPending || (!row && query.isFetching) ? (
        <ModerationSkeleton detail />
      ) : query.isError ? (
        <section className="admin-empty">
          <h1>
            {query.error instanceof ApiError && query.error.status === 404
              ? "Матеріал недоступний"
              : "Не вдалося завантажити матеріал."}
          </h1>
          <button className="button secondary" onClick={() => void refresh()}>
            Спробувати ще раз
          </button>
        </section>
      ) : (
        row && (
          <>
            {query.isFetching && <p role="status">Оновлюємо матеріал…</p>}
            <header className="admin-page-header">
              <p className="eyebrow">{typeLabels[row.type]}</p>
              <h1 ref={heading} tabIndex={-1}>
                {row.type === "REVIEW"
                  ? "Відгук про " + row.targetUser.displayName
                  : row.title}
              </h1>
              <div className="admin-status-row">
                <ModerationBadge status={row.moderationStatus} />
                <time dateTime={row.updatedAt}>
                  Оновлено: {moderationDate(row.updatedAt)}
                </time>
              </div>
            </header>
            <p
              ref={noticeRef}
              tabIndex={-1}
              role="status"
              className="admin-notice"
            >
              {notice}
            </p>
            {stale && (
              <section className="admin-conflict">
                <p role="alert">
                  Контент змінився після відкриття. Оновіть дані перед рішенням.
                </p>
                <button
                  className="button secondary"
                  onClick={() => void refresh()}
                >
                  Оновити
                </button>
              </section>
            )}
            <div className="admin-detail-grid">
              {row.type === "LISTING" ? (
                <ListingModerationDetail row={row} />
              ) : row.type === "MATING_LISTING" ? (
                <MatingModerationDetail row={row} />
              ) : (
                <ReviewModerationDetail row={row} />
              )}
              <aside className="admin-detail-sidebar">
                {row.type !== "REVIEW" && (
                  <ModerationIdentity person={row.owner} label="Власник" />
                )}
                {["REJECTED", "HIDDEN"].includes(row.moderationStatus) &&
                  row.moderationReason && (
                    <section className="admin-panel">
                      <h2>Причина модерації</h2>
                      <p className="admin-full-text">{row.moderationReason}</p>
                    </section>
                  )}
                <ModerationActions
                  row={row}
                  userId={user.id}
                  stale={stale || query.isFetching}
                  onConflict={() => {
                    setStale(true);
                    setNotice("");
                  }}
                  onRefresh={refresh}
                  onNotice={setNotice}
                  focusNotice={() =>
                    noticeRef.current?.focus({ preventScroll: true })
                  }
                />
              </aside>
            </div>
          </>
        )
      )}
    </section>
  );
}
