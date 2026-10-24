"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { currentSessionGeneration, ApiError } from "@/shared/api/client";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
import { getInvitations, sendInvitation, revokeInvitation } from "./api";
const labels = {
  PENDING: "Очікує прийняття",
  ACCEPTED: "Профіль отримано",
  EXPIRED: "Строк минув",
  REVOKED: "Відкликано",
};
export function InvitationPanel({
  id,
  revision,
}: {
  id: string;
  revision: string;
}) {
  const actor = useSession().data,
    client = useQueryClient(),
    [email, setEmail] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    busy = useRef(false);
  const key = ["admin-management", actor?.id, "invitations", id];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor!.id, () => getInvitations(id, signal)),
    enabled: !!actor,
    staleTime: 0,
  });
  async function act(action: "send" | "resend" | "revoke") {
    if (!actor || busy.current) return;
    const current = query.data?.invitations[0];
    const recipient =
      action === "resend"
        ? current?.recipientEmail
        : email.trim().toLowerCase();
    if (action !== "revoke" && !z.email().safeParse(recipient).success) {
      setMessage("Вкажіть коректну електронну адресу.");
      return;
    }
    const generation = currentSessionGeneration();
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await runAdminRequest(client, actor.id, () =>
        action === "revoke"
          ? revokeInvitation(id, current!.id)
          : sendInvitation(id, recipient!, revision, action === "resend"),
      );
      if (
        generation !== currentSessionGeneration() ||
        !currentAdmin(client, actor.id)
      )
        return;
      client.setQueryData(key, result);
      setMessage(
        action === "revoke"
          ? "Запрошення відкликано."
          : "Лист передано поштовому транспорту.",
      );
      void client.invalidateQueries({
        queryKey: ["admin-management", actor.id, "breeder", id],
      });
    } catch (error) {
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      ) {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "Не вдалося виконати дію.",
        );
        void query.refetch();
      }
    } finally {
      busy.current = false;
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      )
        setPending(false);
    }
  }
  const data = query.data,
    current = data?.invitations[0];
  return (
    <section className="dashboard-card">
      <h2>Запросити власника</h2>
      {query.isPending ? (
        <p role="status">Завантажуємо запрошення…</p>
      ) : query.isError ? (
        <>
          <p role="alert">Не вдалося завантажити запрошення.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </>
      ) : data?.claimedProfileId ? (
        <>
          <p>
            Профіль передано власнику. Подальша операторська підготовка
            завершена.
          </p>
          {data.claimedOwnerId && (
            <Link href={`/admin/users/${data.claimedOwnerId}`}>
              Акаунт власника
            </Link>
          )}
        </>
      ) : (
        <>
          {current && (
            <div className="status-panel">
              <strong>{labels[current.status]}</strong>
              <p style={{ overflowWrap: "anywhere" }}>
                {current.recipientEmail}
              </p>
              <p>
                Дійсне до {new Date(current.expiresAt).toLocaleString("uk-UA")}
              </p>
              <p>
                Доставка:{" "}
                {current.deliveryState === "CAPTURED"
                  ? "локальний capture"
                  : current.deliveryState === "ACCEPTED"
                    ? "прийнято провайдером"
                    : current.deliveryState === "CREATED"
                      ? "триває надсилання"
                      : "не підтверджено"}
              </p>
            </div>
          )}
          {current?.status === "PENDING" ? (
            <div className="action-row">
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => void act("resend")}
              >
                Надіслати повторно
              </button>
              <button
                className="button secondary"
                disabled={pending}
                onClick={() => void act("revoke")}
              >
                Відкликати запрошення
              </button>
            </div>
          ) : (
            <form
              className="admin-management-form"
              onSubmit={(event) => {
                event.preventDefault();
                void act("send");
              }}
            >
              <label className="field">
                Пошта власника
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={pending}
                />
              </label>
              <div>
                <button className="button primary" disabled={pending}>
                  Надіслати запрошення
                </button>
              </div>
            </form>
          )}
          <p className="muted">
            Зміна адреси потребує відкликання попереднього запрошення. Профіль
            отримає лише власник відповідної підтвердженої пошти. Оголошення
            залишаться в адміністративній підготовці.
          </p>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
