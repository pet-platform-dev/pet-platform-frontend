import type { Ref } from "react";
import { overdue, recurrenceLabel, reminderDate, type Reminder } from "./model";
export function ReminderCard({
  reminder: r,
  onEdit,
  onComplete,
  onDelete,
  pending = false,
  viewRef,
}: {
  reminder: Reminder;
  onEdit?: (r: Reminder) => void;
  onComplete?: (r: Reminder) => void;
  onDelete?: (r: Reminder) => void;
  pending?: boolean;
  viewRef?: Ref<HTMLElement>;
}) {
  return (
    <article ref={viewRef} className="reminder-card" aria-label={r.title}>
      <div className="reminder-card-heading">
        <h3>{r.title}</h3>
        {r.status === "COMPLETED" ? (
          <span className="reminder-status">Виконано</span>
        ) : overdue(r) ? (
          <span className="reminder-status overdue">Прострочено</span>
        ) : null}
      </div>
      <p className="reminder-date">
        <time dateTime={r.dueAt}>{reminderDate(r.dueAt)}</time>
        {r.recurrenceType !== "NONE" && <span>{recurrenceLabel(r)}</span>}
      </p>
      {r.notes && <p className="reminder-notes">{r.notes}</p>}
      {r.completedAt && (
        <p className="muted">
          Виконано:{" "}
          <time dateTime={r.completedAt}>{reminderDate(r.completedAt)}</time>
        </p>
      )}
      {(onEdit || onDelete || onComplete) && (
        <div className="reminder-actions">
          {r.status === "PENDING" && onComplete && (
            <button
              className="button secondary compact"
              disabled={pending}
              onClick={() => onComplete(r)}
            >
              Виконано
            </button>
          )}
          {r.status === "PENDING" && onEdit && (
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
