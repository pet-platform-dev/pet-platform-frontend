"use client";
import { DateTimeField } from "@/shared/ui/date-time/date-time-field";
import { useId, useState } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { localFields } from "../date-time";
import {
  historyTypes,
  historyInput,
  type EntryType,
  type EntryInput,
  type CareEntry,
} from "./model";
export function HistoryForm({
  entry,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  entry?: CareEntry;
  onSubmit: (input: EntryInput) => void;
  onCancel: () => void;
  pending: boolean;
  error: string;
}) {
  const id = useId(),
    initial = localFields(entry?.occurredAt ?? new Date().toISOString());
  const [type, setType] = useState<EntryType>(entry?.type ?? "OTHER"),
    [title, setTitle] = useState(entry?.title ?? ""),
    [notes, setNotes] = useState(entry?.notes ?? ""),
    [date, setDate] = useState(initial.date),
    [time, setTime] = useState(initial.time),
    [localError, setError] = useState("");
  return (
    <form
      className="reminder-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          onSubmit(historyInput(type, title, notes, date, time));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Перевірте поля.");
        }
      }}
    >
      <fieldset disabled={pending}>
        <SelectDropdown
          label="Тип події"
          value={type}
          options={historyTypes}
          onChange={setType}
          disabled={pending}
        />
        <label htmlFor={id + "title"}>Назва</label>
        <input
          id={id + "title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          required
          autoFocus
        />
        <DateTimeField
          date={date}
          time={time}
          onDate={setDate}
          onTime={setTime}
          disabled={pending}
        />
        <p className="muted reminder-help">
          Вкажіть, коли подія вже відбулася. Дата й час у вашому місцевому
          часовому поясі.
        </p>
        <label htmlFor={id + "notes"}>Нотатка (необов’язково)</label>
        <textarea
          id={id + "notes"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={2000}
        />
      </fieldset>
      {(localError || error) && <p role="alert">{localError || error}</p>}
      <div className="reminder-actions">
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Зберігаємо…" : "Зберегти"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
