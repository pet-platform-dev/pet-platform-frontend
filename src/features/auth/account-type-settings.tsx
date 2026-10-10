"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import {
  accountTypePresentation,
  isBreeder,
  nextAccountType,
} from "@/entities/user/account-type";
import { ApiError } from "@/shared/api/client";
import { updateAccountType } from "./account-type-api";
import { sessionKey, notifySessionChange } from "./session-provider";
export function AccountTypeSettings({ user }: { user: User }) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const next = nextAccountType(user.accountType);
  async function change() {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateAccountType(next);
      await client.cancelQueries({ queryKey: sessionKey });
      if (client.getQueryData<User>(sessionKey)?.id !== user.id) return;
      client.setQueryData(sessionKey, updated);
      notifySessionChange("account-type");
      setMessage(
        "Тип акаунта оновлено. Ваші тварини, оголошення та контакти збережено.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Не вдалося змінити тип акаунта. Спробуйте ще раз.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="account-type-settings"
      aria-labelledby="account-type-heading"
    >
      <h2 id="account-type-heading">Тип акаунта</h2>
      <p>
        <strong>{accountTypePresentation[user.accountType].label}</strong>
      </p>
      <p className="muted">
        Зміна типу акаунта збереже ваших тварин, оголошення та контакти.
      </p>
      {isBreeder(user.accountType) && (
        <p className="form-hint">
          Налаштувати профіль заводчика — ця можливість з’явиться згодом.
        </p>
      )}
      <button
        className="button secondary"
        disabled={pending}
        onClick={change}
        aria-describedby={error ? "account-type-error" : undefined}
      >
        {pending
          ? "Оновлюємо…"
          : "Перейти на тип «" + accountTypePresentation[next].label + "»"}
      </button>
      {error && (
        <p className="field-error" id="account-type-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
