"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getHealth } from "./api";
import {
  healthKeys,
  healthHref,
  healthAdd,
  healthEmpty,
  type HealthKind,
} from "./model";
import { RecordCard } from "./record-card";
import { RecordsLoading } from "./record-list";
export function RecordPreview({ id, kind }: { id: string; kind: HealthKind }) {
  const uid = useSession().data!.id,
    q = useQuery({
      queryKey: healthKeys.list(uid, id, kind, 3),
      queryFn: ({ signal }) => getHealth(id, kind, 1, 3, signal),
      retry: false,
    });
  return (
    <>
      {q.isPending ? (
        <RecordsLoading />
      ) : q.isError ? (
        <div role="alert">
          <p>Не вдалося завантажити записи.</p>
          <button className="button secondary" onClick={() => void q.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : q.data.data.length ? (
        q.data.data.map((r) => <RecordCard key={r.id} record={r} preview />)
      ) : (
        <p>{healthEmpty(kind)}</p>
      )}
      <div className="reminder-actions">
        <Link className="button secondary" href={healthHref(id, kind)}>
          Усі записи
        </Link>
        <Link
          className="button secondary"
          href={healthHref(id, kind) + "?add=1"}
        >
          {healthAdd(kind)}
        </Link>
      </div>
    </>
  );
}
