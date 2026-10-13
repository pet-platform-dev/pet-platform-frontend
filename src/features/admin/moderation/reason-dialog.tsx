"use client";
import { useEffect, useId, useRef } from "react";
export function ModerationReasonDialog({
  action,
  value,
  onChange,
  onClose,
  onSubmit,
  pending,
  error,
  stale,
  onRefresh,
  returnFocus,
  ownerSeesReason = true,
}: {
  action: "reject" | "hide" | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  error: string;
  stale: boolean;
  onRefresh: () => void;
  returnFocus: () => void;
  ownerSeesReason?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null),
    id = useId();
  useEffect(() => {
    if (!action) return;
    const element = dialog.current,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    textarea.current?.focus();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, [action]);
  return (
    <dialog
      ref={dialog}
      className="admin-reason-dialog"
      aria-labelledby={id + "-title"}
      aria-describedby={id + "-help"}
      aria-busy={pending}
      onClose={() => {
        onClose();
        returnFocus();
      }}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const elements = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "textarea:not(:disabled),button:not(:disabled),a[href]",
          ),
        );
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          first &&
          last &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
    >
      <h2 id={id + "-title"}>
        {action === "hide" ? "Приховати матеріал?" : "Відхилити матеріал?"}
      </h2>
      <p id={id + "-help"}>
        {action === "hide" ? "Контент зникне з публічних сторінок. " : " "}
        {ownerSeesReason
          ? "Цю причину побачить власник контенту."
          : "Причину буде збережено для модерації."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        noValidate
      >
        <label htmlFor={id + "-reason"}>
          {action === "hide" ? "Причина приховування" : "Причина відхилення"}
        </label>
        <textarea
          ref={textarea}
          id={id + "-reason"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          disabled={pending}
          required
          minLength={10}
          maxLength={1000}
          aria-invalid={!!error}
          aria-describedby={id + "-count" + (error ? " " + id + "-error" : "")}
        />
        <p className="form-hint" id={id + "-count"}>
          Від 10 до 1000 символів · {value.trim().length}/1000
        </p>
        {error && (
          <p role="alert" id={id + "-error"}>
            {error}
          </p>
        )}
        {stale && (
          <p role="alert">
            Контент змінився після відкриття. Оновіть дані перед рішенням.
          </p>
        )}
        <div className="admin-actions">
          {stale && (
            <button
              type="button"
              className="button secondary"
              onClick={onRefresh}
            >
              Оновити
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button
            type="submit"
            className="button secondary admin-destructive"
            disabled={pending || stale}
          >
            {pending
              ? "Зберігаємо…"
              : action === "hide"
                ? "Приховати"
                : "Відхилити"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
