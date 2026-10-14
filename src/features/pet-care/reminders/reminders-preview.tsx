"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getReminders } from "./api";
import { reminderKeys, remindersHref } from "./model";
import { ReminderCard } from "./reminder-card";
export function RemindersPreview({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const uid = useSession().data!.id;
  const q = useQuery({
    queryKey: reminderKeys.list(uid, id, "PENDING", 1, 5),
    queryFn: ({ signal }) => getReminders(id, "PENDING", 1, 5, signal),
    retry: false,
  });
  return (
    <>
      {q.isPending ? (
        <p role="status">Завантажуємо нагадування…</p>
      ) : q.isError ? (
        <div role="alert">
          <p>Не вдалося завантажити нагадування.</p>
          <button className="button secondary" onClick={() => void q.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : q.data.data.length ? (
        (compact ? q.data.data.slice(0, 1) : q.data.data).map((r) => (
          <ReminderCard key={r.id} reminder={r} />
        ))
      ) : (
        <>
          <p>Нагадувань ще немає</p>
          <p className="muted">
            Додайте нагадування про події та догляд за твариною.
          </p>
        </>
      )}
      <div className="reminder-actions">
        <Link className="button secondary" href={remindersHref(id)}>
          Усі нагадування
        </Link>
        <Link className="button secondary" href={remindersHref(id) + "?add=1"}>
          + Додати нагадування
        </Link>
      </div>
    </>
  );
}
