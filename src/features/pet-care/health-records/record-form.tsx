"use client";
import { useId, useState } from "react";
import { DateTimeField } from "@/shared/ui/date-time/date-time-field";
import { localFields } from "../date-time";
import {
  healthInput,
  healthStart,
  healthEnd,
  type HealthKind,
  type HealthRecord,
  type HealthInput,
} from "./model";
export function RecordForm({
  kind,
  record,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  kind: HealthKind;
  record?: HealthRecord;
  onSubmit: (v: HealthInput) => void;
  onCancel: () => void;
  pending: boolean;
  error: string;
}) {
  const id = useId(),
    initial = localFields(
      record ? healthStart(record) : new Date().toISOString(),
    ),
    secondary =
      record && healthEnd(record)
        ? localFields(healthEnd(record)!)
        : { date: "", time: "" };
  const [name, setName] = useState(record?.name ?? ""),
    [notes, setNotes] = useState(record?.notes ?? ""),
    [date, setDate] = useState(initial.date),
    [time, setTime] = useState(initial.time),
    [enabled, setEnabled] = useState(Boolean(record && healthEnd(record))),
    [endDate, setEndDate] = useState(secondary.date),
    [endTime, setEndTime] = useState(secondary.time),
    [localError, setError] = useState("");
  const vaccine = kind === "vaccinations";
  return (
    <form
      className="reminder-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          onSubmit(
            healthInput(
              kind,
              name,
              notes,
              date,
              time,
              enabled,
              endDate,
              endTime,
            ),
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Перевірте поля.");
        }
      }}
    >
      <fieldset disabled={pending}>
        <label htmlFor={id + "name"}>
          {vaccine ? "Назва вакцини" : "Назва"}
        </label>
        <input
          id={id + "name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={140}
          required
          autoFocus
        />
        <DateTimeField
          date={date}
          time={time}
          onDate={setDate}
          onTime={setTime}
          dateLabel={vaccine ? "Дата" : "Дата початку"}
          timeLabel={vaccine ? "Час" : "Час початку"}
          disabled={pending}
        />
        <p className="muted reminder-help">
          Дата й час у вашому місцевому часовому поясі. Усі дані ви вносите
          самостійно.
        </p>
        <label className="health-optional">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {vaccine ? "Додати наступну дату" : "Додати дату завершення"}
        </label>
        {enabled && (
          <>
            <DateTimeField
              date={endDate}
              time={endTime}
              onDate={setEndDate}
              onTime={setEndTime}
              dateLabel={vaccine ? "Наступна дата" : "Дата завершення"}
              timeLabel={vaccine ? "Наступний час" : "Час завершення"}
              disabled={pending}
            />
            <p className="muted reminder-help">
              Оберіть і дату, і час. Нагадування автоматично не створюється.
            </p>
          </>
        )}
        <label htmlFor={id + "notes"}>Нотатка (необов’язково)</label>
        <textarea
          id={id + "notes"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={4}
        />
      </fieldset>
      {(localError || error) && <p role="alert">{localError || error}</p>}
      <div className="reminder-actions">
        <button className="button primary" disabled={pending} type="submit">
          {pending ? "Зберігаємо…" : "Зберегти"}
        </button>
        <button
          className="button secondary"
          disabled={pending}
          type="button"
          onClick={onCancel}
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
