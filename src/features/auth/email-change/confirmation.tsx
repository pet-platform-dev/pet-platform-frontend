"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { ConfirmationStatus } from "../email-verification/verification-state";
import { useCooldown } from "../email-verification/use-cooldown";
import { useEmailChangeSession } from "./confirmation-session";
const copy: Record<ConfirmationStatus, string> = {
  loading: "Готуємо підтвердження…",
  missing:
    "Відкрийте оригінальне посилання з листа для зміни пошти. Після оновлення сторінки потрібно відкрити його ще раз.",
  malformed:
    "Посилання має неправильний формат. Відкрийте повне посилання з листа.",
  ready:
    "Підтвердьте зміну електронної адреси. Потім потрібно буде знову увійти до акаунта.",
  pending: "Підтверджуємо зміну…",
  success:
    "Електронну адресу змінено й підтверджено. Усі сесії цього акаунта завершено. Увійдіть із новою адресою.",
  invalid:
    "Посилання недійсне або термін його дії минув. Запросіть зміну пошти ще раз.",
  temporary:
    "Не вдалося підтвердити зміну. Спробуйте ще раз. Після оновлення сторінки відкрийте оригінальне посилання.",
  limited: "Забагато спроб. Спробуйте пізніше.",
};
export function EmailChangeConfirmation() {
  const controller = useEmailChangeSession(),
    state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.serverSnapshot,
    );
  const seconds = useCooldown(state.retryAt),
    actionable = ["ready", "pending", "temporary", "limited"].includes(
      state.status,
    ),
    failure = ["malformed", "invalid", "temporary", "limited"].includes(
      state.status,
    );
  return (
    <section className="auth-card" aria-labelledby="email-change-title">
      <p className="eyebrow">Захист вашого акаунта</p>
      <h1 id="email-change-title">Підтвердження зміни пошти</h1>
      <p
        role={failure ? "alert" : "status"}
        className={failure ? "error-banner" : "muted"}
      >
        {copy[state.status]}
      </p>
      {actionable && (
        <button
          type="button"
          className="button primary full"
          disabled={state.status === "pending" || seconds > 0}
          onClick={() => void controller.submit()}
        >
          {state.status === "pending"
            ? "Підтверджуємо…"
            : "Підтвердити зміну пошти"}
        </button>
      )}
      {seconds > 0 && (
        <p role="status" className="muted">
          Спробуйте знову через {seconds} с.
        </p>
      )}
      <p className="form-footer">
        <Link href="/login">Перейти до входу</Link>
      </p>
    </section>
  );
}
