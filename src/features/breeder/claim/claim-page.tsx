"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { currentSessionGeneration } from "@/shared/api/client";
import { useSession, useLogout } from "@/features/auth/session-provider";
import { AuthForm } from "@/features/auth/auth-form";
import { AccountVerification } from "@/features/auth/email-verification/account-verification";
import { useClaimSession } from "./claim-session";
import type { User } from "@/entities/user/model";
export function BreederClaimPage() {
  const controller = useClaimSession(),
    state = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.serverSnapshot,
    );
  const session = useSession(),
    user = session.data,
    client = useQueryClient(),
    router = useRouter(),
    logout = useLogout();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [switching, setSwitching] = useState(false),
    [accountMessage, setAccountMessage] = useState("");
  const identity = user
    ? `${user.id}:${user.email}:${user.verificationStatus}:${user.accountType}:${currentSessionGeneration()}`
    : "";
  const current = Boolean(identity) && state.sessionKey === identity;
  useEffect(() => controller.session(identity), [controller, identity]);
  async function accept() {
    const generation = currentSessionGeneration();
    const result = await controller.accept();
    if (!result) return;
    await client.invalidateQueries({
      queryKey: ["own-breeder", result.ownerId],
    });
    if (
      generation === currentSessionGeneration() &&
      client.getQueryData<User | null>(["current-user"])?.id === result.ownerId
    )
      router.replace("/profile/breeder");
  }
  async function switchAccount() {
    if (switching) return;
    setSwitching(true);
    setAccountMessage("");
    controller.session("");
    try {
      await logout();
    } catch {
      controller.session(identity);
      setAccountMessage("Не вдалося завершити сесію. Спробуйте ще раз.");
    } finally {
      setSwitching(false);
    }
  }
  return (
    <section className="auth-card breeder-claim">
      <p className="eyebrow">Запрошення від Лапи</p>
      <h1>Отримати профіль розплідника</h1>
      <p>
        Профіль буде передано лише після вашого підтвердження. Оголошення та
        фотографії з адміністративної підготовки не передаються й не
        публікуються.
      </p>
      {state.status === "loading" ? (
        <p role="status">Перевіряємо посилання…</p>
      ) : ["missing", "malformed", "invalid"].includes(state.status) ? (
        <p role="alert">
          Відкрийте оригінальне посилання із запрошення. Після оновлення цієї
          сторінки воно потрібне знову.
        </p>
      ) : !user ? (
        session.isPending ? (
          <p role="status">Відновлюємо сесію…</p>
        ) : (
          <>
            <p>
              Увійдіть або зареєструйте звичайний акаунт з адресою, на яку
              отримали запрошення. Посилання залишиться в пам’яті цієї вкладки.
            </p>
            <div className="action-row">
              <button
                className="button secondary"
                onClick={() => setMode("login")}
              >
                Увійти
              </button>
              <button
                className="button secondary"
                onClick={() => setMode("register")}
              >
                Зареєструватися
              </button>
            </div>
            <AuthForm mode={mode} onAuthenticated={() => {}} />
          </>
        )
      ) : (
        <>
          <p>
            Ви увійшли як {user.email}. Якщо це інша адреса, увійдіть до
            потрібного акаунта.
          </p>
          <button
            className="button secondary"
            disabled={switching}
            onClick={() => void switchAccount()}
          >
            Увійти до іншого акаунта
          </button>
          {accountMessage && <p role="alert">{accountMessage}</p>}
          {user.verificationStatus !== "VERIFIED" ? (
            <>
              <AccountVerification key={identity} user={user} />
              <p>Підтвердьте пошту в іншій вкладці та поверніться сюди.</p>
              <button
                className="button secondary"
                onClick={() => void session.refetch()}
              >
                Оновити стан пошти
              </button>
            </>
          ) : user.accountType !== "BREEDER" ? (
            <p>
              Оберіть тип «Заводчик» у{" "}
              <Link href="/account" target="_blank" rel="noopener noreferrer">
                налаштуваннях акаунта
              </Link>
              , потім поверніться й оновіть стан.
            </p>
          ) : (
            <>
              {current && state.message && <p role="alert">{state.message}</p>}
              {current && state.preview && (
                <div className="status-panel">
                  <h2>{state.preview.kennelName}</h2>
                  {state.preview.publicContacts && (
                    <div>
                      <h3>Підготовлені публічні контакти</h3>
                      {Object.entries(state.preview.publicContacts).map(
                        ([key, value]) =>
                          value && (
                            <p key={key}>
                              {
                                (
                                  {
                                    phone: "Телефон",
                                    telegram: "Telegram",
                                    viber: "Viber",
                                    whatsapp: "WhatsApp",
                                  } as Record<string, string>
                                )[key]
                              }
                              : {value}
                            </p>
                          ),
                      )}
                      <p>
                        Контакти залишаться приватними до окремої публікації
                        профілю. Ваші наявні публічні контакти не замінюються.
                      </p>
                    </div>
                  )}
                  {state.preview.description && (
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {state.preview.description}
                    </p>
                  )}
                  <p>
                    Після отримання профіль залишиться приватним до окремої
                    публікації вами.
                  </p>
                </div>
              )}
              {current && state.status === "success" ? (
                <p role="status">Профіль передано. Відкриваємо редактор…</p>
              ) : current && state.status === "preview" ? (
                <button
                  className="button primary"
                  onClick={() => void accept()}
                >
                  Підтвердити отримання профілю
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={!current || state.status === "pending"}
                  onClick={() => void controller.inspect()}
                >
                  {state.status === "pending"
                    ? "Зачекайте…"
                    : "Переглянути підготовлений профіль"}
                </button>
              )}
            </>
          )}
          {user.accountType !== "BREEDER" && (
            <button
              className="button secondary"
              onClick={() => void session.refetch()}
            >
              Оновити стан акаунта
            </button>
          )}
        </>
      )}
    </section>
  );
}
