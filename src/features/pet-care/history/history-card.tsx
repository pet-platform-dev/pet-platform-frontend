import { careDate } from "../date-time";
import { historyTypeLabel, type CareEntry } from "./model";
export function HistoryCard({
  entry: r,
  onEdit,
  onDelete,
  pending = false,
  preview = false,
}: {
  entry: CareEntry;
  onEdit?: (r: CareEntry) => void;
  onDelete?: (r: CareEntry) => void;
  pending?: boolean;
  preview?: boolean;
}) {
  const long = (r.notes?.length ?? 0) > 240;
  return (
    <article className="reminder-card history-card" aria-label={r.title}>
      <div className="reminder-card-heading">
        <h3>{r.title}</h3>
        <span className="history-type">{historyTypeLabel(r.type)}</span>
      </div>
      <p className="reminder-date">
        <time dateTime={r.occurredAt}>{careDate(r.occurredAt)}</time>
      </p>
      {!preview &&
        r.notes &&
        (long ? (
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
