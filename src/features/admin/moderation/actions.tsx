"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { moderateContent } from "./api";
import { runAdminRequest, currentAdmin, refreshAfterModeration } from "./cache";
import {
  availableActions,
  reasonSchema,
  type ModerationDetail,
  type ModerationAction,
  type ModerationResult,
  typeLabels,
} from "./model";
import { ModerationReasonDialog } from "./reason-dialog";
export function ModerationActions({
  row,
  userId,
  stale,
  onConflict,
  onRefresh,
  onNotice,
  focusNotice,
}: {
  row: ModerationDetail;
  userId: string;
  stale: boolean;
  onConflict: () => void;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  focusNotice: () => void;
}) {
  const client = useQueryClient(),
    lock = useRef(false),
    trigger = useRef<HTMLButtonElement | null>(null);
  const [dialog, setDialog] = useState<"reject" | "hide" | null>(null),
    [drafts, setDrafts] = useState({ reject: "", hide: "" }),
    [error, setError] = useState("");
  const actions = availableActions(row);
  const mutation = useMutation({
    mutationKey: ["admin-moderation", userId, row.type, row.id],
    mutationFn: ({
      action,
      reason,
    }: {
      action: ModerationAction;
      reason?: string;
    }) =>
      runAdminRequest(client, userId, () =>
        moderateContent(row.type, row.id, action, row.updatedAt, reason),
      ),
    onSuccess: async (result: ModerationResult, variables) => {
      if (!currentAdmin(client, userId)) return;
      setDialog(null);
      setError("");
      onNotice(
        (row.type === "MATING_LISTING" ? "В’язку" : typeLabels[row.type]) +
          " " +
          { approve: "схвалено.", reject: "відхилено.", hide: "приховано." }[
            variables.action
          ],
      );
      await refreshAfterModeration(client, userId, result);
      if (currentAdmin(client, userId)) requestAnimationFrame(focusNotice);
    },
    onError: (error) => {
      if (!currentAdmin(client, userId)) return;
      if (error instanceof ApiError && error.status === 409) {
        onConflict();
        setError("");
      } else setError("Не вдалося виконати дію модерації. Спробуйте ще раз.");
    },
    onSettled: () => {
      lock.current = false;
    },
    retry: false,
  });
  function submit(action: ModerationAction) {
    if (
      stale ||
      lock.current ||
      !currentAdmin(client, userId) ||
      !actions.includes(action)
    )
      return;
    let reason: string | undefined;
    if (action !== "approve") {
      const parsed = reasonSchema.safeParse(drafts[action]);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      reason = parsed.data;
    }
    lock.current = true;
    setError("");
    mutation.mutate({ action, reason });
  }
  return (
    <section className="admin-panel">
      <h2>Рішення модерації</h2>
      {error && !dialog && <p role="alert">{error}</p>}
      {actions.length ? (
        <div className="admin-actions">
          {actions.map((action) => (
            <button
              key={action}
              disabled={mutation.isPending || stale}
              className={
                "button " +
                (action === "approve"
                  ? "primary"
                  : "secondary admin-destructive")
              }
              onClick={(event) => {
                trigger.current = event.currentTarget;
                if (action === "approve") submit(action);
                else {
                  setError("");
                  setDialog(action);
                }
              }}
            >
              {mutation.isPending
                ? "Зберігаємо…"
                : action === "approve"
                  ? "Схвалити"
                  : action === "reject"
                    ? "Відхилити"
                    : "Приховати"}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Для поточного стану дії модерації недоступні.</p>
      )}
      <ModerationReasonDialog
        ownerSeesReason={row.type !== "REVIEW"}
        action={dialog}
        value={dialog ? drafts[dialog] : ""}
        onChange={(value) => {
          if (dialog)
            setDrafts((previous) => ({ ...previous, [dialog]: value }));
          setError("");
        }}
        onClose={() => setDialog(null)}
        onSubmit={() => {
          if (dialog) submit(dialog);
        }}
        pending={mutation.isPending}
        error={error}
        stale={stale}
        onRefresh={() => {
          setDialog(null);
          void onRefresh();
        }}
        returnFocus={() => {
          if (trigger.current?.isConnected) trigger.current.focus();
          else focusNotice();
        }}
      />
    </section>
  );
}
