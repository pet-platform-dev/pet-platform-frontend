"use client";
import { useState } from "react";
import { listAudit } from "@/entities/service-provider/api";
import { useWorkspaceQuery } from "./session";
import { Feedback, Loading, Pager } from "./ui";
const actions: Record<string, string> = {
  CREATE: "Створено профіль",
  UPDATE: "Оновлено профіль",
  ARCHIVE: "Архівовано",
  LOCATION_CREATE: "Додано місце",
  LOCATION_UPDATE: "Оновлено місце",
  LOCATION_DELETE: "Видалено місце",
  OFFER_CREATE: "Створено послугу",
  OFFER_UPDATE: "Оновлено послугу",
  OFFER_ARCHIVE: "Архівовано послугу",
  MEDIA_UPLOAD: "Додано фото",
  MEDIA_REMOVE: "Видалено фото",
  MEDIA_REORDER: "Змінено порядок фото",
  SUBMIT: "Надіслано на модерацію",
  APPROVE: "Схвалено",
  REJECT: "Відхилено",
  HIDE: "Приховано",
  REOPEN: "Повернено на доопрацювання",
};
export function WorkspaceAudit({ providerId }: { providerId: string }) {
  const [page, setPage] = useState(1),
    query = useWorkspaceQuery([providerId, "audit", page], (signal) =>
      listAudit(providerId, page, signal),
    );
  return (
    <section className="workspace-panel">
      <h2>Історія змін</h2>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Feedback error={query.error} onRefresh={() => void query.refetch()} />
      ) : (
        <>
          <ol className="workspace-list">
            {query.data.data.map((row) => (
              <li key={row.id}>
                <strong>{actions[row.action] ?? "Зміна запису"}</strong>
                <time dateTime={row.createdAt}>
                  {new Date(row.createdAt).toLocaleString("uk-UA")}
                </time>
                {row.reason && <p>{row.reason}</p>}
                <p className="muted">
                  Змінено полів: {row.changedFieldNames.length}
                </p>
              </li>
            ))}
          </ol>
          {!query.data.data.length && <p>Історія поки порожня.</p>}
          <Pager page={page} pages={query.data.meta.pages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
