"use client";
import { useState } from "react";
import { careDate } from "../date-time";
import { healthStart, type HealthRecord } from "./model";
export function RecordCard({
  record: r,
  onEdit,
  onDelete,
  pending = false,
  preview = false,
}: {
  record: HealthRecord;
  onEdit?: (r: HealthRecord) => void;
  onDelete?: (r: HealthRecord) => void;
  pending?: boolean;
  preview?: boolean;
}) {
  const [now] = useState(() => Date.now());
  return (
    <article className="reminder-card" aria-label={r.name}>
      <div className="reminder-card-heading">
        <h3>{r.name}</h3>
        {"endedAt" in r && !r.endedAt && (
          <span className="reminder-status">Триває</span>
        )}
      </div>
      <p className="reminder-date">
        <time dateTime={healthStart(r)}>{careDate(healthStart(r))}</time>
      </p>
      {"nextDueAt" in r && r.nextDueAt && (
        <>
          <p className="health-secondary-date">
            Наступна дата:{" "}
            <time dateTime={r.nextDueAt}>{careDate(r.nextDueAt)}</time>
          </p>
          {Date.parse(r.nextDueAt) < now && (
            <p className="muted health-neutral">Запланована дата минула</p>
          )}
        </>
      )}
      {"endedAt" in r && r.endedAt && (
        <p className="health-secondary-date">
          Завершення: <time dateTime={r.endedAt}>{careDate(r.endedAt)}</time>
        </p>
      )}
      {!preview &&
        r.notes &&
        (r.notes.length > 240 ? (
          <details className="history-notes">
            <summary>
              Нотатка: {r.notes.slice(0, 180)}… <span>Показати повністю</span>
            </summary>
            <p>{r.notes}</p>
          </details>
        ) : (
          <p className="reminder-notes">{r.notes}</p>
        ))}
      {(onEdit || onDelete) && (
        <div className="reminder-actions">
          {onEdit && (
            <button
              className="button secondary compact"
              disabled={pending}
              onClick={() => onEdit(r)}
            >
              Редагувати
            </button>
          )}
          {onDelete && (
            <button
              className="button secondary compact reminder-delete"
              disabled={pending}
              onClick={() => onDelete(r)}
            >
              Видалити
            </button>
          )}
        </div>
      )}
    </article>
  );
}
