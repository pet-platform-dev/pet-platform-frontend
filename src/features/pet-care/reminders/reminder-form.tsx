"use client";
import { NumericInput } from "@/shared/ui/numeric-input";
import { DateTimeField } from "@/shared/ui/date-time/date-time-field";
import { useId, useState } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import {
  formInput,
  localFields,
  recurrenceOptions,
  type Reminder,
  type ReminderInput,
  type Recurrence,
} from "./model";
export function ReminderForm({
  reminder,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  reminder?: Reminder;
  onSubmit: (input: ReminderInput) => void;
  onCancel: () => void;
  pending: boolean;
  error: string;
}) {
  const id = useId(),
    initial = localFields(reminder?.dueAt);
  const [title, setTitle] = useState(reminder?.title ?? ""),
    [notes, setNotes] = useState(reminder?.notes ?? ""),
    [date, setDate] = useState(initial.date),
    [time, setTime] = useState(initial.time),
    [recurrence, setRecurrence] = useState<Recurrence>(
      reminder?.recurrenceType ?? "NONE",
    ),
    [interval, setInterval] = useState(String(reminder?.intervalDays ?? 1)),
    [localError, setError] = useState("");
  return (
    <form
      className="reminder-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          onSubmit(formInput(title, notes, date, time, recurrence, interval));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Перевірте поля.");
        }
      }}
    >
      <fieldset disabled={pending}>
        <label htmlFor={id + "title"}>Назва</label>
        <input
          id={id + "title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
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
          Дата й час у вашому місцевому часовому поясі.
        </p>
        <SelectDropdown
          label="Повторення"
          value={recurrence}
          options={recurrenceOptions}
          onChange={setRecurrence}
          disabled={pending}
        />
        {recurrence === "CUSTOM_DAYS" && (
          <>
            <label htmlFor={id + "interval"}>Інтервал у днях</label>
            <NumericInput
              id={id + "interval"}
              type="number"
              min={1}
              max={365}
              step={1}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </>
        )}
        {recurrence !== "NONE" && (
          <p className="muted reminder-help">
            Наступний повтор з’явиться після виконання. Повторення
            відраховується від попередньої дати за UTC; місцева година може
            змінитися при переході на літній час. Щомісячна дата обмежується
            останнім днем наступного місяця.
          </p>
        )}
        <label htmlFor={id + "notes"}>Нотатка (необов’язково)</label>
        <textarea
          id={id + "notes"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={1000}
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
