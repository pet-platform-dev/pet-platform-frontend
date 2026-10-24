"use client";
import { useEffect, useId, useRef, useState } from "react";
export function RoleDialog({
  from,
  to,
  pending,
  error,
  onClose,
  onSubmit,
  returnFocus,
}: {
  from: string;
  to: string;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  returnFocus: () => void;
}) {
  const [validationError, setValidationError] = useState("");
  const feedback = validationError || error;
  const dialog = useRef<HTMLDialogElement>(null),
    password = useRef<HTMLInputElement>(null),
    id = useId(),
    focusReturn = useRef(returnFocus);
  useEffect(() => {
    const el = dialog.current,
      overflow = document.body.style.overflow,
      input = password.current,
      restoreFocus = focusReturn.current;
    document.body.style.overflow = "hidden";
    el?.showModal();
    input?.focus();
    return () => {
      if (input) input.value = "";
      el?.close();
      document.body.style.overflow = overflow;
      queueMicrotask(restoreFocus);
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-reason-dialog"
      aria-labelledby={id + "-title"}
      aria-describedby={id + "-help"}
      aria-busy={pending}
      onClose={(event) => {
        // Strict Mode can queue cleanup's close event before reopening this node.
        // Only a dialog that is still closed represents an actual dismissal.
        if (!event.currentTarget.open) onClose();
      }}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <h2 id={id + "-title"}>Підтвердити зміну ролі?</h2>
      <p id={id + "-help"}>
        {from} → {to}. Усі поточні сесії користувача буде завершено, якщо роль
        зміниться. Акаунт, власність і тип акаунта залишаються тими самими.
      </p>
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const value = password.current?.value ?? "";
          if (pending) return;
          if (value.length < 8 || value.length > 128) {
            setValidationError(
              "Введіть поточний пароль від 8 до 128 символів.",
            );
            password.current?.focus();
            return;
          }
          setValidationError("");
          try {
            await onSubmit(value);
          } finally {
            if (password.current) password.current.value = "";
          }
        }}
      >
        <div className="field">
          <label htmlFor={id + "-password"}>Ваш поточний пароль</label>
          <input
            ref={password}
            id={id + "-password"}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={128}
            disabled={pending}
            aria-invalid={Boolean(feedback)}
            aria-describedby={feedback ? id + "-error" : undefined}
          />
        </div>
        {feedback && (
          <p id={id + "-error"} role="alert">
            {feedback}
          </p>
        )}
        <div className="admin-actions">
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button type="submit" className="button primary" disabled={pending}>
            {pending ? "Змінюємо…" : "Підтвердити зміну ролі"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
