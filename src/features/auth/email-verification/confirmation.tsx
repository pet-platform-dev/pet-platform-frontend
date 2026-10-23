"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { ConfirmationStatus } from "./verification-state";
import { useCooldown } from "./use-cooldown";
import { useConfirmationSession } from "./confirmation-session";

const messages: Record<ConfirmationStatus, string> = {
  loading: "Готуємо підтвердження…",
  missing:
    "Відкрийте посилання з листа для підтвердження пошти. Якщо ви оновили цю сторінку, відкрийте оригінальне посилання ще раз.",
  malformed:
    "Посилання має неправильний формат. Відкрийте повне посилання з листа або запросіть нове.",
  ready:
    "Натисніть кнопку нижче, щоб підтвердити електронну пошту. Входити до акаунта не потрібно.",
  pending: "Підтверджуємо електронну пошту…",
  success: "Електронну пошту підтверджено!",
  invalid:
    "Посилання недійсне або термін його дії минув. Воно також могло бути вже використане. Якщо пошту вже підтверджено, повторна дія не потрібна.",
  temporary:
    "Не вдалося перевірити електронну пошту. Спробуйте ще раз. Якщо ви оновите сторінку, повторно відкрийте посилання з листа.",
  limited: "Забагато спроб підтвердження. Спробуйте пізніше.",
};

export function EmailConfirmation() {
  const controller = useConfirmationSession();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.serverSnapshot,
  );
  const seconds = useCooldown(state.retryAt);
  const canSubmit = ["ready", "pending", "temporary", "limited"].includes(
    state.status,
  );
  const failure = ["malformed", "invalid", "temporary", "limited"].includes(
    state.status,
  );
  return (
    <section
      className="auth-card email-confirmation"
      aria-labelledby="verification-title"
    >
      <p className="eyebrow">Турбота починається з довіри</p>
      <h1 id="verification-title">Підтвердження пошти</h1>
      <p
        className={failure ? "error-banner" : "muted"}
        role={failure ? "alert" : "status"}
      >
        {messages[state.status]}
      </p>
      {canSubmit && (
        <button
          type="button"
          className="button primary full"
          disabled={state.status === "pending" || seconds > 0}
          onClick={() => {
            void controller.submit();
          }}
        >
          {state.status === "pending" ? "Підтверджуємо…" : "Підтвердити пошту"}
        </button>
      )}
      {seconds > 0 && (
        <p className="muted">Спробуйте знову через {seconds} с.</p>
      )}
      <p className="form-hint">
        Після оновлення сторінки потрібно знову відкрити посилання з листа.
      </p>
      <nav className="verification-links" aria-label="Наступні дії">
        <Link href="/account">До акаунта / надіслати лист повторно</Link>
        <Link href="/login">Увійти</Link>
        <Link href="/">На головну</Link>
      </nav>
    </section>
  );
}
