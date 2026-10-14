"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { ApiError } from "@/shared/api/client";
import { petCareKeys, petCareHref } from "../model";
import { getPetCare } from "../api";
import { ReminderDialog as CareDialog } from "../reminders/reminder-dialog";
import {
  healthTitle,
  healthAdd,
  healthHref,
  type HealthKind,
  type HealthRecord,
  type HealthInput,
} from "./model";
import { saveHealth, deleteHealth, refreshHealth } from "./api";
import { RecordForm } from "./record-form";
import { RecordList, RecordsLoading } from "./record-list";
type Dialog =
  { type: "create" } | { type: "edit" | "delete"; record: HealthRecord };
export function RecordsContent({
  id,
  kind,
  add = false,
}: {
  id: string;
  kind: HealthKind;
  add?: boolean;
}) {
  const uid = useSession().data!.id,
    client = useQueryClient(),
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
    mutationKey: ["pet-care", uid, id, kind, "mutation"],
    mutationFn: (
      work:
        | { action: "save"; input: HealthInput; existing?: HealthRecord }
        | { action: "delete"; record: HealthRecord },
    ): Promise<HealthRecord | void> =>
      work.action === "save"
        ? saveHealth(id, kind, work.input, work.existing)
        : deleteHealth(id, kind, work.record),
    onSuccess: async () => {
      setDialog(null);
      await refreshHealth(client, uid, id, kind);
    },
    onError: async (e) => {
      if (e instanceof ApiError && (e.status === 409 || e.status === 404))
        await refreshHealth(client, uid, id, kind);
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
      <h1>{healthTitle(kind)}</h1>
      {pet.isPending ? (
        <RecordsLoading />
      ) : pet.isError ? (
        <div role="alert">
          <p>
            {pet.error instanceof ApiError && pet.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити записи."}
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
            <p>Ваші особисті записи про тварину.</p>
            <button
              className="button primary"
              onClick={() => open({ type: "create" })}
            >
              {healthAdd(kind)}
            </button>
          </div>
          <RecordList
            uid={uid}
            id={id}
            kind={kind}
            pending={mutation.isPending}
            onEdit={(r) => open({ type: "edit", record: r })}
            onDelete={(r) => open({ type: "delete", record: r })}
          />
          {dialog && (
            <CareDialog
              title={
                dialog.type === "delete"
                  ? "Видалити запис?"
                  : dialog.type === "edit"
                    ? "Редагувати запис"
                    : healthAdd(kind)
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
                    Інші записи, історія та нагадування залишаться без змін.
                  </p>
                  {error && <p role="alert">{error}</p>}
                  <div className="reminder-actions">
                    <button
                      className="button secondary reminder-delete"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          action: "delete",
                          record: dialog.record,
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
                <RecordForm
                  key={dialog.type === "edit" ? dialog.record.id : "new"}
                  kind={kind}
                  record={dialog.type === "edit" ? dialog.record : undefined}
                  pending={mutation.isPending}
                  error={error}
                  onCancel={() => setDialog(null)}
                  onSubmit={(input) =>
                    mutation.mutate({
                      action: "save",
                      input,
                      existing:
                        dialog.type === "edit" ? dialog.record : undefined,
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
export function RecordsPage({
  id,
  kind,
  add,
}: {
  id: string;
  kind: HealthKind;
  add?: boolean;
}) {
  return (
    <RequireSession returnTo={healthHref(id, kind) + (add ? "?add=1" : "")}>
      <RecordsContent key={kind} id={id} kind={kind} add={add} />
    </RequireSession>
  );
}
