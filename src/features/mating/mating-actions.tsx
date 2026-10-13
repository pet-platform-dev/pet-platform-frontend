"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { actOnMating } from "@/entities/mating-listing/api";
import {
  matingActions,
  type OwnMating,
  type MatingAction,
} from "@/entities/mating-listing/model";
import { currentMatingUser, refreshMating } from "./cache";
import { matingError } from "./model";
import { ApiError } from "@/shared/api/client";
const labels = {
  close: "Завершити пошук",
  archive: "Перемістити в архів",
  delete: "Видалити чернетку",
};
type ConfirmAction = Exclude<MatingAction, "publish">;
export function MatingActions({
  row,
  userId,
  disabled = false,
}: {
  row: OwnMating;
  userId: string;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    lock = useRef(false);
  const [action, setAction] = useState<ConfirmAction | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const client = useQueryClient(),
    router = useRouter();
  const available = matingActions(row).filter(
    (value): value is ConfirmAction => value !== "publish",
  );
  async function confirm() {
    if (!action || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const result = await actOnMating(row.id, action);
      if (!currentMatingUser(client, userId)) return;
      dialog.current?.close();
      await refreshMating(client, userId, row.id, result, row.pet.id);
      if (action === "delete" && currentMatingUser(client, userId))
        router.replace("/mating/my");
    } catch (e) {
      if (currentMatingUser(client, userId)) {
        setError(matingError(e));
        if (e instanceof ApiError && e.status === 409)
          await refreshMating(client, userId, row.id, undefined, row.pet.id);
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <div className="form-actions mating-lifecycle">
        {available.map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled || pending}
            className={`button ${value === "delete" ? "mating-danger" : "secondary"}`}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setAction(value);
              setError("");
              dialog.current?.showModal();
            }}
          >
            {labels[value]}
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="delete-dialog mating-dialog"
        aria-labelledby="mating-confirm-title"
        aria-describedby="mating-confirm-help"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const nodes = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          );
          const first = nodes[0],
            last = nodes.at(-1);
          if (!first || !last) {
            event.preventDefault();
            event.currentTarget.focus();
            return;
          }
          if (
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClose={() => {
          if (trigger.current?.isConnected && !trigger.current.disabled)
            trigger.current.focus();
          else document.getElementById("mating-status")?.focus();
        }}
      >
        <h2 id="mating-confirm-title">
          {action ? labels[action] + "?" : "Підтвердіть дію"}
        </h2>
        <p id="mating-confirm-help">
          {action === "delete"
            ? "Чернетку буде видалено. Профіль тварини залишиться."
            : action === "close"
              ? "Оголошення більше не буде видно публічно."
              : "Оголошення більше не буде активним. Історія залишиться в архіві."}
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            autoFocus
            disabled={pending}
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button
            disabled={pending}
            className={`button ${action === "delete" ? "mating-danger" : "primary"}`}
            onClick={() => void confirm()}
          >
            {pending
              ? "Змінюємо…"
              : action === "delete"
                ? "Видалити чернетку"
                : "Підтвердити"}
          </button>
        </div>
      </dialog>
    </>
  );
}
