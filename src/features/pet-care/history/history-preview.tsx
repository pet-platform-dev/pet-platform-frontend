"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getHistory } from "./api";
import { historyKeys, historyHref } from "./model";
import { HistoryCard } from "./history-card";
import { HistoryLoading } from "./history-list";
export function HistoryPreview({ id }: { id: string }) {
  const uid = useSession().data!.id,
    q = useQuery({
      queryKey: historyKeys.list(uid, id, "ALL", 3),
      queryFn: ({ signal }) => getHistory(id, "ALL", 1, 3, signal),
      retry: false,
    });
  return (
    <>
      {q.isPending ? (
        <HistoryLoading />
      ) : q.isError ? (
        <div role="alert">
          <p>Не вдалося завантажити історію.</p>
          <button className="button secondary" onClick={() => void q.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : q.data.data.length ? (
        q.data.data.map((r) => <HistoryCard key={r.id} entry={r} preview />)
      ) : (
        <>
          <p>Історія догляду порожня</p>
          <p className="muted">
            Додайте перший запис про догляд або подію, яка вже відбулася.
          </p>
        </>
      )}
      <div className="reminder-actions">
        <Link className="button secondary" href={historyHref(id)}>
          Уся історія
        </Link>
        <Link className="button secondary" href={historyHref(id) + "?add=1"}>
          + Додати запис
        </Link>
      </div>
    </>
  );
}
