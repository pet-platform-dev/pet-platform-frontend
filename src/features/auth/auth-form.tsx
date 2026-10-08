"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiError, signIn } from "@/shared/api/client";
import { loginSchema, registerSchema } from "./validation";
import { notifySessionChange, sessionKey } from "./session-provider";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const router = useRouter();
  const client = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = (registering ? registerSchema : loginSchema).safeParse(
      values,
    );
    setMessage("");
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues)
        fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      return;
    }
    setErrors({});
    setPending(true);
    const { email, password } = result.data;
    const input =
      registering && "firstName" in result.data && "lastName" in result.data
        ? {
            email,
            password,
            firstName: result.data.firstName,
            lastName: result.data.lastName,
          }
        : { email, password };
    try {
      const user = await signIn(mode, input);
      await client.cancelQueries({ queryKey: sessionKey });
      client.setQueryData(sessionKey, user);
      notifySessionChange();
      router.replace("/account");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Не вдалося виконати запит. Спробуйте ще раз.",
      );
    } finally {
      setPending(false);
    }
  }

  const fields = [
    ...(registering
      ? [
          {
            name: "firstName",
            label: "Ім’я",
            type: "text",
            autocomplete: "given-name",
          },
          {
            name: "lastName",
            label: "Прізвище",
            type: "text",
            autocomplete: "family-name",
          },
        ]
      : []),
    {
      name: "email",
      label: "Електронна адреса",
      type: "email",
      autocomplete: "email",
    },
    {
      name: "password",
      label: "Пароль",
      type: "password",
      autocomplete: registering ? "new-password" : "current-password",
    },
    ...(registering
      ? [
          {
            name: "confirmPassword",
            label: "Підтвердження пароля",
            type: "password",
            autocomplete: "new-password",
          },
        ]
      : []),
  ];
  return (
    <section className="auth-card">
      <p className="eyebrow">
        {registering ? "Знайомство починається тут" : "Раді бачити вас знову"}
      </p>
      <h1>{registering ? "Створити акаунт" : "Увійти до акаунта"}</h1>
      <p className="muted">
        {registering
          ? "Ваш простір для турботи про улюбленців."
          : "Увійдіть, щоб перейти до свого профілю."}
      </p>
      <form onSubmit={submit} noValidate>
        {fields.map((field) => (
          <div className="field" key={field.name}>
            <label htmlFor={field.name}>{field.label}</label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autocomplete}
              required
              maxLength={
                field.name === "email"
                  ? 254
                  : field.type === "password"
                    ? 128
                    : 100
              }
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={
                errors[field.name] ? `${field.name}-error` : undefined
              }
              disabled={pending}
            />
            {errors[field.name] && (
              <p className="field-error" id={`${field.name}-error`}>
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}
        {!registering && (
          <p className="form-hint">Пароль має містити щонайменше 8 символів.</p>
        )}
        {message && (
          <p role="alert" className="error-banner">
            {message}
          </p>
        )}
        <button
          className="button primary full"
          disabled={pending}
          type="submit"
        >
          {pending ? "Зачекайте…" : registering ? "Створити акаунт" : "Увійти"}
        </button>
      </form>
      <p className="form-footer">
        {registering ? "Уже маєте акаунт?" : "Ще не маєте акаунта?"}{" "}
        <Link href={registering ? "/login" : "/register"}>
          {registering ? "Увійти" : "Зареєструватися"}
        </Link>
      </p>
    </section>
  );
}
