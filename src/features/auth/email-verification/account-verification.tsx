"use client";
import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { currentSessionGeneration } from "@/shared/api/client";
import { resendEmail } from "./api";
import { createResendState, type ResendState } from "./verification-state";
import { refreshVerificationSession } from "./session-sync";
import { useCooldown } from "./use-cooldown";

const feedback: Record<ResendState["status"], string> = {
  idle: "",
  pending: "Надсилаємо запит…",
  accepted:
    "Запит на повторне надсилання прийнято. Перевірте пошту та папку «Спам».",
  already_verified: "Пошту вже підтверджено. Оновлюємо дані акаунта.",
  limited: "Забагато запитів підтвердження. Спробуйте пізніше.",
  temporary:
    "Не вдалося підтвердити надсилання. Перевірте пошту або спробуйте пізніше.",
  unauthenticated: "Сесію завершено. Увійдіть знову, щоб запросити лист.",
};

export function AccountVerification({
  user,
  children,
}: {
  user: User;
  children?: React.ReactNode;
}) {
  const client = useQueryClient();
  const [generation] = useState(currentSessionGeneration);
  const [controller] = useState(() =>
    createResendState(
      async () => {
        const status = await resendEmail();
        if (status === "already_verified") {
          try {
            await refreshVerificationSession(client, generation);
          } catch {
            /* ordinary account retry remains available */
          }
        }
        return status;
      },
      () =>
        generation === currentSessionGeneration() &&
        client.getQueryData<User>(["current-user"])?.id === user.id,
    ),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.serverSnapshot,
  );
  const seconds = useCooldown(state.retryAt);
  const verified = user.verificationStatus === "VERIFIED";
  const failed = ["limited", "temporary", "unauthenticated"].includes(
    state.status,
  );
  return (
    <section
      className="account-email-verification"
      aria-labelledby="account-email-title"
    >
      <h3 id="account-email-title">Електронна пошта</h3>
      <p className="verification-email">{user.email}</p>
      <p className="verification-status">
        {verified
          ? "Електронну пошту підтверджено"
          : "Електронну пошту не підтверджено"}
      </p>
      {!verified && (
        <>
          <p className="muted">
            Підтвердьте електронну пошту, щоб завершити налаштування акаунта.
            Перевірте вхідні повідомлення та папку «Спам». Якщо лист не
            надійшов, ви можете надіслати його повторно.
          </p>
          <button
            type="button"
            className="button secondary compact"
            disabled={
              state.status === "pending" ||
              state.status === "already_verified" ||
              seconds > 0
            }
            onClick={() => {
              void controller.submit();
            }}
          >
            {state.status === "pending"
              ? "Надсилаємо запит…"
              : "Надіслати лист повторно"}
          </button>
          {seconds > 0 && (
            <p className="muted">
              Повторний запит буде доступний через {seconds} с. Сервер може
              застосовувати додаткові обмеження.
            </p>
          )}
          {feedback[state.status] && (
            <p
              className={failed ? "error-banner" : "muted"}
              role={failed ? "alert" : "status"}
            >
              {feedback[state.status]}
            </p>
          )}
        </>
      )}
      {children}
    </section>
  );
}
