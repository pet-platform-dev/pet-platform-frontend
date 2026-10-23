"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { requestPasswordReset } from "./api";
import { forgotPasswordSchema } from "./validation";

export const recoveryAcceptedCopy =
  "Якщо акаунт із такою адресою існує, ми надішлемо інструкції для відновлення пароля.";
export function ForgotPassword() {
  const [status, setStatus] = useState<
    "idle" | "pending" | "accepted" | "temporary"
  >("idle");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const result = forgotPasswordSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError("");
    submitting.current = true;
    setStatus("pending");
    try {
      await requestPasswordReset(result.data.email);
      setStatus("accepted");
    } catch {
      setStatus("temporary");
    } finally {
      submitting.current = false;
    }
  }
  return (
    <section className="auth-card" aria-labelledby="recovery-title">
      <p className="eyebrow">Поверніться до своєї спільноти</p>
      <h1 id="recovery-title">Відновлення пароля</h1>
      {status === "accepted" ? (
        <p role="status" className="muted">
          {recoveryAcceptedCopy}
        </p>
      ) : (
        <>
          <p className="muted">Вкажіть електронну адресу вашого акаунта.</p>
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="recovery-email">Електронна адреса</label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={status === "pending"}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "recovery-email-error" : undefined}
              />
              {error && (
                <p
                  role="alert"
                  className="field-error"
                  id="recovery-email-error"
                >
                  {error}
                </p>
              )}
            </div>
            {status === "temporary" && (
              <p role="alert" className="error-banner">
                Не вдалося прийняти запит. Спробуйте пізніше.
              </p>
            )}
            <button
              type="submit"
              className="button primary full"
              disabled={status === "pending"}
            >
              {status === "pending" ? "Зачекайте…" : "Надіслати інструкції"}
            </button>
          </form>
        </>
      )}
      <p className="form-footer">
        <Link href="/login">Повернутися до входу</Link>
      </p>
    </section>
  );
}
