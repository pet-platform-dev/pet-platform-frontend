"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { ApiError } from "@/shared/api/client";
import { petCareHref, petCareKeys } from "../model";
import { getPetCare } from "../api";
import { ReminderDialog } from "./reminder-dialog";
import { ReminderForm } from "./reminder-form";
import { ReminderList } from "./reminder-list";
import { remindersHref, type Reminder, type ReminderInput } from "./model";
import { changeReminder, saveReminder, refreshReminders } from "./api";
type Dialog =
  { type: "create" } | { type: "edit" | "delete"; reminder: Reminder };
export function RemindersContent({
  id,
  add = false,
}: {
  id: string;
  add?: boolean;
}) {
  const uid = useSession().data!.id,
    client = useQueryClient(),
    [dialog, setDialog] = useState<Dialog | null>(
      add ? { type: "create" } : null,
    );
  const q = useQuery({
    queryKey: petCareKeys.dashboard(uid, id),
    queryFn: ({ signal }) => getPetCare(id, signal),
    retry: false,
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationKey: ["pet-care", uid, id, "mutation"],
    mutationFn: (
      work:
        | { type: "save"; input: ReminderInput; existing?: Reminder }
        | { type: "complete" | "delete"; reminder: Reminder },
    ) =>
      work.type === "save"
        ? saveReminder(id, work.input, work.existing)
        : changeReminder(id, work.reminder, work.type),
    onSuccess: async () => {
      setDialog(null);
      await refreshReminders(client, uid, id);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409)
        await refreshReminders(client, uid, id);
    },
  });
  const open = (value: Dialog) => {
    mutation.reset();
    setDialog(value);
  };
  const error = mutation.isError
    ? mutation.error instanceof ApiError && mutation.error.status === 409
      ? "Нагадування вже змінено. Закрийте форму й відкрийте оновлений запис."
      : "Не вдалося зберегти зміну. Перевірте з’єднання та спробуйте ще раз."
    : "";
  return (
    <main className="catalog-shell pet-care-page reminders-page">
      <Link className="pet-care-back" href={petCareHref(id)}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="m12 19-7-7 7-7M5 12h14" />
        </svg>
        До догляду за твариною
      </Link>
      <h1>Нагадування</h1>
      {q.isPending ? (
        <p role="status">Завантажуємо дані тварини…</p>
      ) : q.isError ? (
        <section role="alert">
          <p>
            {q.error instanceof ApiError && q.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити дані тварини."}
          </p>
          {!(q.error instanceof ApiError && q.error.status === 404) && (
            <button
              className="button secondary"
              onClick={() => void q.refetch()}
            >
              Спробувати ще раз
            </button>
          )}
        </section>
      ) : (
        <>
          <p className="muted reminder-pet-context">
            {q.data.name?.trim() ||
              q.data.breed?.nameUk ||
              q.data.breed?.name ||
              q.data.species.name}
          </p>
          <div className="reminder-toolbar">
            <p>Додайте нагадування про події та догляд за твариною.</p>
            <button
              className="button primary"
              onClick={() => open({ type: "create" })}
            >
              Додати нагадування
            </button>
          </div>
          {error && !dialog && <p role="alert">{error}</p>}
          <ReminderList
            userId={uid}
            petId={id}
            status="PENDING"
            onEdit={(r) => open({ type: "edit", reminder: r })}
            onDelete={(r) => open({ type: "delete", reminder: r })}
            onComplete={(r) =>
              mutation.mutate({ type: "complete", reminder: r })
            }
            pending={mutation.isPending}
          />
          <ReminderList
            userId={uid}
            petId={id}
            status="COMPLETED"
            onEdit={(r) => open({ type: "edit", reminder: r })}
            onDelete={(r) => open({ type: "delete", reminder: r })}
            onComplete={(r) =>
              mutation.mutate({ type: "complete", reminder: r })
            }
            pending={mutation.isPending}
          />
          {dialog && (
            <ReminderDialog
              title={
                dialog.type === "delete"
                  ? "Видалити нагадування?"
                  : dialog.type === "edit"
                    ? "Редагувати нагадування"
                    : "Додати нагадування"
              }
              pending={mutation.isPending}
              onClose={() => {
                setDialog(null);
                mutation.reset();
              }}
            >
              {dialog.type === "delete" ? (
                <>
                  <p>Цю дію не можна скасувати.</p>
                  <p>
                    Буде видалено лише це нагадування. Інші повтори та виконані
                    записи залишаться.
                  </p>
                  {error && <p role="alert">{error}</p>}
                  <div className="reminder-actions">
                    <button
                      className="button secondary reminder-delete"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          type: "delete",
                          reminder: dialog.reminder,
                        })
                      }
                    >
                      Видалити нагадування
                    </button>
                    <button
                      className="button secondary"
                      disabled={mutation.isPending}
                      onClick={() => setDialog(null)}
                    >
                      Скасувати
                    </button>
                  </div>
                </>
              ) : (
                <ReminderForm
                  key={dialog.type === "edit" ? dialog.reminder.id : "new"}
                  reminder={
                    dialog.type === "edit" ? dialog.reminder : undefined
                  }
                  pending={mutation.isPending}
                  error={error}
                  onCancel={() => setDialog(null)}
                  onSubmit={(input) =>
                    mutation.mutate({
                      type: "save",
                      input,
                      existing:
                        dialog.type === "edit" ? dialog.reminder : undefined,
                    })
                  }
                />
              )}
            </ReminderDialog>
          )}
        </>
      )}
    </main>
  );
}
export function RemindersPage({ id, add }: { id: string; add?: boolean }) {
  return (
    <RequireSession returnTo={remindersHref(id) + (add ? "?add=1" : "")}>
      <RemindersContent key={id} id={id} add={add} />
    </RequireSession>
  );
}
