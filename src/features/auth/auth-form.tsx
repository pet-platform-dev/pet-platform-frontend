"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ApiError, signIn } from "@/shared/api/client";
import { AuthFields } from "./auth-fields";
import { AccountTypeChoice } from "./account-type-choice";
import { loginSchema, registerSchema } from "./validation";
import {
  clearPrivateQueries,
  notifySessionChange,
  sessionKey,
} from "./session-provider";
import { clearFormRecovery } from "@/features/listing/form-recovery";

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
      registering &&
      "firstName" in result.data &&
      "lastName" in result.data &&
      "accountType" in result.data
        ? {
            email,
            password,
            firstName: result.data.firstName,
            lastName: result.data.lastName,
            accountType: result.data.accountType,
          }
        : { email, password };
    try {
      const user = await signIn(mode, input);
      clearFormRecovery(user.id);
      clearPrivateQueries(client);
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
        {registering && (
          <AccountTypeChoice disabled={pending} error={errors.accountType} />
        )}
        <AuthFields
          registering={registering}
          pending={pending}
          errors={errors}
        />
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
