"use client";
import { useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  authenticatedRequest,
  currentSessionGeneration,
} from "@/shared/api/client";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
const schema = z.array(
  z.object({
    id: z.uuid(),
    status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]),
    expiresAt: z.string(),
    items: z.array(z.object({ draftId: z.uuid() })),
  }),
);
const labels = {
  PENDING: "Очікує прийняття власником",
  ACCEPTED: "Прийнято власником",
  EXPIRED: "Строк минув",
  REVOKED: "Відкликано",
};
export function WorkspaceHandoffs({
  draftId,
  source,
}: {
  draftId: string;
  source: "OWNER_MANAGED" | "OPERATOR_PREPARED";
}) {
  const actor = useSession().data!,
    client = useQueryClient(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const key = ["admin-management", actor.id, "workspace-handoffs", draftId];
  const q = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      schema.parse(
        await runAdminRequest(client, actor.id, () =>
          authenticatedRequest(
            `/admin/breeders/${draftId}/handoffs?source=${source}`,
            {
              signal,
            },
          ),
        ),
      ),
    retry: false,
  });
  async function revoke(id: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const generation = currentSessionGeneration();
    try {
      await runAdminRequest(client, actor.id, () =>
        authenticatedRequest(`/admin/breeder-handoffs/${id}/revoke`, {
          method: "POST",
          body: "{}",
        }),
      );
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      )
        void q.refetch();
    } catch {
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      )
        setMessage("Не вдалося відкликати. Оновіть дані.");
    } finally {
      if (generation === currentSessionGeneration()) setBusy(false);
    }
  }
  return (
    <section>
      <h3>Передачі підготовлених оголошень</h3>
      {q.isPending ? (
        <p role="status">Завантажуємо передачі…</p>
      ) : q.isError ? (
        <p role="alert">
          Не вдалося завантажити.{" "}
          <button onClick={() => void q.refetch()}>Повторити</button>
        </p>
      ) : q.data.length === 0 ? (
        <p className="muted">Пропозицій передачі ще немає.</p>
      ) : (
        <ul>
          {q.data.map((h) => (
            <li key={h.id}>
              <p>
                {labels[h.status]} · {h.items.length} оголошень · до{" "}
                {new Date(h.expiresAt).toLocaleDateString("uk-UA")}
              </p>
              {h.status === "PENDING" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void revoke(h.id)}
                >
                  Відкликати передачу
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
