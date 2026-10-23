"use client";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import type { ConfirmationStatus } from "../email-verification/verification-state";
import { useCooldown } from "../email-verification/use-cooldown";
import { useResetSession } from "./reset-session";
import { resetPasswordSchema } from "./validation";

const messages: Record<ConfirmationStatus, string> = {
  loading: "Готуємо відновлення…",
  missing:
    "Відкрийте оригінальне посилання з листа для відновлення пароля. Після оновлення сторінки потрібно відкрити його ще раз.",
  malformed:
    "Посилання має неправильний формат. Відкрийте повне посилання з листа або запросіть нове.",
  ready: "Встановіть новий пароль для вашого акаунта.",
  pending: "Зберігаємо новий пароль…",
  success: "Пароль змінено. Увійдіть із новим паролем.",
  invalid:
    "Посилання недійсне або термін його дії минув. Запросіть відновлення пароля ще раз.",
  temporary:
    "Не вдалося змінити пароль. Спробуйте ще раз. Якщо оновите сторінку, відкрийте оригінальне посилання з листа.",
  limited: "Забагато спроб. Спробуйте пізніше.",
};
export function ResetPassword() {
  const controller = useResetSession();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.serverSnapshot,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const seconds = useCooldown(state.retryAt);
  const showForm = ["ready", "pending", "temporary", "limited"].includes(
    state.status,
  );
  const failure = ["malformed", "invalid", "temporary", "limited"].includes(
    state.status,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = resetPasswordSchema.safeParse(
      Object.fromEntries(new FormData(form)),
    );
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    await controller.submit(parsed.data.newPassword);
    if (controller.snapshot().status === "success") form.reset();
  }
  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <p className="eyebrow">Безпечне повернення до акаунта</p>
      <h1 id="reset-title">Новий пароль</h1>
      <p
        className={failure ? "error-banner" : "muted"}
        role={failure ? "alert" : "status"}
      >
        {messages[state.status]}
      </p>
      {showForm && (
        <form onSubmit={submit} noValidate>
          {[
            ["newPassword", "Новий пароль"],
            ["confirmPassword", "Підтвердження пароля"],
          ].map(([name, label]) => (
            <div className="field" key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                name={name}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={state.status === "pending"}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={
                  errors[name] ? `${name}-error` : "reset-password-hint"
                }
              />
              {errors[name] && (
                <p role="alert" className="field-error" id={`${name}-error`}>
                  {errors[name]}
                </p>
              )}
            </div>
          ))}
          <p className="form-hint" id="reset-password-hint">
            Від 8 до 128 символів.
          </p>
          <button
            type="submit"
            className="button primary full"
            disabled={state.status === "pending" || seconds > 0}
          >
            {state.status === "pending" ? "Зберігаємо…" : "Змінити пароль"}
          </button>
          {seconds > 0 && (
            <p role="status" className="muted">
              Спробуйте знову через {seconds} с.
            </p>
          )}
        </form>
      )}
      <p className="form-footer">
        <Link href="/login">Повернутися до входу</Link>
      </p>
      {state.status !== "success" && (
        <p className="form-footer">
          <Link href="/forgot-password">Запросити нове посилання</Link>
        </p>
      )}
    </section>
  );
}
