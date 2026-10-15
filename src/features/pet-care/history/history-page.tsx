"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { ApiError } from "@/shared/api/client";
import { petCareHref, petCareKeys } from "../model";
import { getPetCare } from "../api";
import { ReminderDialog as CareDialog } from "../reminders/reminder-dialog";
import { HistoryForm } from "./history-form";
import { HistoryList, HistoryLoading } from "./history-list";
import {
  historyFilters,
  historyHref,
  type HistoryFilter,
  type CareEntry,
  type EntryInput,
} from "./model";
import { saveHistory, deleteHistory, refreshHistory } from "./api";
type Dialog =
  { type: "create" } | { type: "edit" | "delete"; entry: CareEntry };
export function HistoryContent({
  id,
  add = false,
}: {
  id: string;
  add?: boolean;
}) {
  const uid = useSession().data!.id,
    client = useQueryClient(),
    [type, setType] = useState<HistoryFilter>("ALL"),
    [dialog, setDialog] = useState<Dialog | null>(
      add ? { type: "create" } : null,
    );
  const pet = useQuery({
    queryKey: petCareKeys.dashboard(uid, id),
    queryFn: ({ signal }) => getPetCare(id, signal),
    retry: false,
    staleTime: 0,
  });
  const mutation = useMutation({
    mutationKey: ["pet-care", uid, id, "history-mutation"],
    mutationFn: (
      work:
        | { action: "save"; input: EntryInput; existing?: CareEntry }
        | { action: "delete"; entry: CareEntry },
    ): Promise<CareEntry | void> =>
      work.action === "save"
        ? saveHistory(id, work.input, work.existing)
        : deleteHistory(id, work.entry),
    onSuccess: async () => {
      setDialog(null);
      await refreshHistory(client, uid, id);
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 404)
      )
        await refreshHistory(client, uid, id);
    },
  });
  const open = (d: Dialog) => {
    mutation.reset();
    setDialog(d);
  };
  const error = mutation.isError
    ? mutation.error instanceof ApiError && mutation.error.status === 409
      ? "Запис уже змінено. Закрийте форму й відкрийте оновлений запис."
      : dialog?.type === "delete"
        ? "Не вдалося видалити запис."
        : "Не вдалося зберегти запис."
    : "";
  return (
    <main className="catalog-shell pet-care-page reminders-page history-page">
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
      <h1>Історія догляду</h1>
      {pet.isPending ? (
        <HistoryLoading />
      ) : pet.isError ? (
        <div role="alert">
          <p>
            {pet.error instanceof ApiError && pet.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити історію."}
          </p>
          {!(pet.error instanceof ApiError && pet.error.status === 404) && (
            <button
              className="button secondary"
              onClick={() => void pet.refetch()}
            >
              Спробувати ще раз
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="muted">
            {pet.data.name?.trim() ||
              pet.data.breed?.nameUk ||
              pet.data.breed?.name ||
              pet.data.species.name}
          </p>
          <div className="reminder-toolbar">
            <div className="history-filter">
              <SelectDropdown
                label="Тип події"
                value={type}
                options={historyFilters}
                onChange={setType}
              />
            </div>
            <button
              className="button primary"
              onClick={() => open({ type: "create" })}
            >
              Додати запис
            </button>
          </div>
          <HistoryList
            uid={uid}
            id={id}
            type={type}
            onEdit={(r) => open({ type: "edit", entry: r })}
            onDelete={(r) => open({ type: "delete", entry: r })}
            pending={mutation.isPending}
          />
          {dialog && (
            <CareDialog
              title={
                dialog.type === "delete"
                  ? "Видалити запис з історії?"
                  : dialog.type === "edit"
                    ? "Редагувати запис"
                    : "Додати запис"
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
                  <p>Нагадування та інші записи залишаться без змін.</p>
                  {error && <p role="alert">{error}</p>}
                  <div className="reminder-actions">
                    <button
                      className="button secondary reminder-delete"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: "delete",
                          entry: dialog.entry,
                        })
                      }
                    >
                      Видалити запис
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
                <HistoryForm
                  key={dialog.type === "edit" ? dialog.entry.id : "new"}
                  entry={dialog.type === "edit" ? dialog.entry : undefined}
                  pending={mutation.isPending}
                  error={error}
                  onCancel={() => setDialog(null)}
                  onSubmit={(input) =>
                    mutation.mutate({
                      action: "save",
                      input,
                      existing:
                        dialog.type === "edit" ? dialog.entry : undefined,
                    })
                  }
                />
              )}
            </CareDialog>
          )}
        </>
      )}
    </main>
  );
}
export function HistoryPage({ id, add }: { id: string; add?: boolean }) {
  return (
    <RequireSession returnTo={historyHref(id) + (add ? "?add=1" : "")}>
      <HistoryContent key={id} id={id} add={add} />
    </RequireSession>
  );
}
