"use client";
import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import { useCooldown } from "../email-verification/use-cooldown";
import {
  pendingChangeKey,
  pendingEmailChange,
  requestEmailChange,
} from "./api";
import { emailChangeSchema } from "./validation";

export function EmailChangeSettings({ user }: { user: User }) {
  const client = useQueryClient();
  const pending = useQuery({
    queryKey: pendingChangeKey(user.id),
    queryFn: ({ signal }) => pendingEmailChange(signal),
  });
  const expiresIn = useCooldown(
    pending.data?.pending ? Date.parse(pending.data.pending.expiresAt) : 0,
  );
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState("");
  const submitting = useRef(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget,
      parsed = emailChangeSchema.safeParse(
        Object.fromEntries(new FormData(form)),
      );
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      return;
    }
    if (parsed.data.newEmail === user.email.trim().toLowerCase()) {
      setErrors({ newEmail: "Вкажіть іншу електронну адресу." });
      return;
    }
    const generation = currentSessionGeneration();
    const current = () =>
      generation === currentSessionGeneration() &&
      client.getQueryData<User>(["current-user"])?.id === user.id;
    submitting.current = true;
    setBusy(true);
    setErrors({});
    setMessage("");
    setFailed(false);
    try {
      await requestEmailChange(
        parsed.data.newEmail,
        parsed.data.currentPassword,
      );
      if (!current()) return;
      setMessage(
        "Ми підготували підтвердження нової адреси. Перевірте електронну пошту та папку «Спам». Це не підтвердження доставки.",
      );
      form.reset();
      setOpen(false);
    } catch (error) {
      if (!current()) return;
      setFailed(true);
      setMessage(
        error instanceof ApiError && error.status === 429
          ? "Забагато запитів. Спробуйте пізніше."
          : error instanceof ApiError && error.status === 409
            ? "Не вдалося використати цю адресу. Вкажіть іншу."
            : error instanceof ApiError && error.status === 400
              ? "Перевірте нову адресу та поточний пароль."
              : "Не вдалося підтвердити надсилання. Перевірте пошту або спробуйте пізніше.",
      );
    } finally {
      const field = form.elements.namedItem("currentPassword");
      if (field instanceof HTMLInputElement) field.value = "";
      submitting.current = false;
      if (current()) {
        setBusy(false);
        void client.invalidateQueries({ queryKey: pendingChangeKey(user.id) });
      }
    }
  }
  return (
    <div className="email-change-settings">
      {pending.data?.pending && expiresIn > 0 && (
        <p className="muted" role="status">
          Очікує підтвердження: {pending.data.pending.newEmail}. Поточна адреса
          залишається чинною.
        </p>
      )}
      {pending.isError && (
        <p className="muted">
          Не вдалося перевірити стан зміни адреси.{" "}
          <button
            className="button secondary compact"
            type="button"
            onClick={() => void pending.refetch()}
          >
            Спробувати ще раз
          </button>
        </p>
      )}
      <button
        type="button"
        className="button secondary compact"
        aria-expanded={open}
        aria-controls="email-change-form"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Скасувати" : "Змінити електронну пошту"}
      </button>
      {open && (
        <form id="email-change-form" onSubmit={submit} noValidate>
          {[
            ["newEmail", "Нова електронна адреса", "email"],
            ["currentPassword", "Поточний пароль", "password"],
          ].map(([name, label, type]) => (
            <div className="field" key={name}>
              <label htmlFor={`change-${name}`}>{label}</label>
              <input
                id={`change-${name}`}
                name={name}
                type={type}
                autoComplete={type === "email" ? "email" : "current-password"}
                required
                maxLength={type === "email" ? 254 : 128}
                disabled={busy}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={
                  errors[name] ? `change-${name}-error` : undefined
                }
              />
              {errors[name] && (
                <p
                  role="alert"
                  className="field-error"
                  id={`change-${name}-error`}
                >
                  {errors[name]}
                </p>
              )}
            </div>
          ))}
          <button
            className="button primary compact"
            type="submit"
            disabled={busy}
          >
            {busy ? "Надсилаємо запит…" : "Надіслати підтвердження"}
          </button>
        </form>
      )}
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "error-banner" : "muted"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
