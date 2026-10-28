"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { profileInputSchema } from "@/entities/seller/model";
import {
  authenticatedRequest,
  currentSessionGeneration,
  ApiError,
} from "@/shared/api/client";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
import type { ManagedBreeder } from "../management/model";
export function WorkspaceContacts({
  profile,
  onSaved,
  beforeSave,
  submitLabel,
  onPendingChange,
}: {
  profile: ManagedBreeder;
  onSaved: () => void | Promise<unknown>;
  beforeSave?: () => Promise<ManagedBreeder>;
  submitLabel?: string;
  onPendingChange?: (busy: boolean) => void;
}) {
  const actor = useSession().data!,
    client = useQueryClient(),
    [values, setValues] = useState({
      phone: profile.publicContacts?.phone ?? "",
      telegram: profile.publicContacts?.telegram ?? "",
      viber: profile.publicContacts?.viber ?? "",
      whatsapp: profile.publicContacts?.whatsapp ?? "",
    }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    onPendingChange?.(busy);
  }, [busy, onPendingChange]);
  const identity = (
    value:
      | {
          phone?: string | null;
          telegram?: string | null;
          viber?: string | null;
          whatsapp?: string | null;
        }
      | undefined,
  ) =>
    JSON.stringify([
      value?.phone?.replace(/[ ()-]/g, "") || null,
      value?.telegram?.replace(/^@/, "") || null,
      value?.viber?.replace(/[ ()-]/g, "") || null,
      value?.whatsapp?.replace(/[ ()-]/g, "") || null,
    ]);
  const [baseline, setBaseline] = useState(identity(profile.publicContacts));
  const lock = useRef(false),
    requests = useRef(new AbortController());
  useEffect(() => {
    requests.current = new AbortController();
    const c = requests.current;
    return () => c.abort();
  }, []);
  return (
    <form
      className="dashboard-card admin-management-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        if (identity(profile.publicContacts) !== baseline) {
          setMessage(
            "Контакти змінилися. Перезавантажте сторінку перед повторним збереженням.",
          );
          return;
        }
        const checked = profileInputSchema.safeParse(values);
        if (!checked.success) {
          setMessage(checked.error.issues[0].message);
          return;
        }
        lock.current = true;
        setBusy(true);
        setMessage("");
        const generation = currentSessionGeneration();
        try {
          const current = beforeSave ? await beforeSave() : profile;
          await runAdminRequest(client, actor.id, () =>
            authenticatedRequest(`/admin/breeders/${profile.id}/contacts`, {
              method: "PATCH",
              signal: requests.current.signal,
              body: JSON.stringify({
                source: current.source,
                expectedUpdatedAt: current.updatedAt,
                contactRevision: current.publicContacts?.updatedAt ?? null,
                contacts: checked.data,
              }),
            }),
          );
          if (
            generation === currentSessionGeneration() &&
            currentAdmin(client, actor.id)
          ) {
            for (const queryKey of [
              ["breeder", profile.userId],
              ["seller", profile.userId],
              ["own-breeder", profile.userId],
            ])
              void client.invalidateQueries({ queryKey });
            setBaseline(identity(checked.data));
            await onSaved();
          }
        } catch (error) {
          if (
            generation === currentSessionGeneration() &&
            currentAdmin(client, actor.id)
          )
            setMessage(
              error instanceof ApiError && error.status === 409
                ? "Контакти змінилися. Оновіть дані перед повторним збереженням."
                : "Не вдалося зберегти контакти. Перевірте поля та доступ.",
            );
        } finally {
          lock.current = false;
          if (generation === currentSessionGeneration()) setBusy(false);
        }
      }}
    >
      <h2>Публічні контакти</h2>
      <p className="muted">
        Усі поля необов’язкові. Реєстраційна пошта та приватний телефон акаунта
        не змінюються. Наявні контакти власника зберігаються під час прийняття
        профілю.
      </p>
      <fieldset disabled={busy}>
        <legend>Контакти розплідника</legend>
        {(
          [
            ["phone", "Телефон"],
            ["telegram", "Telegram"],
            ["viber", "Viber"],
            ["whatsapp", "WhatsApp"],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`workspace-contact-${key}`}>
              {label} — необов’язково
            </label>
            <input
              id={`workspace-contact-${key}`}
              value={values[key]}
              inputMode={key === "telegram" ? "text" : "tel"}
              maxLength={40}
              onChange={(e) =>
                setValues((old) => ({ ...old, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </fieldset>
      <button type="submit" className="button secondary" disabled={busy}>
        {busy ? "Зберігаємо…" : (submitLabel ?? "Зберегти контакти")}
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
