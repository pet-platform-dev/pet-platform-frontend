import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { authenticatedRequest } from "@/shared/api/client";
import { sessionKey } from "@/features/auth/session-provider";
import {
  historyEntrySchema,
  historyPageSchema,
  historyKeys,
  type CareEntry,
  type EntryInput,
  type HistoryFilter,
} from "./model";
const path = (id: string) => "/pets/" + z.uuid().parse(id) + "/care-history";
export async function getHistory(
  id: string,
  type: HistoryFilter = "ALL",
  page = 1,
  limit = 20,
  signal?: AbortSignal,
) {
  const result = historyPageSchema.parse(
    await authenticatedRequest(
      path(id) +
        "?" +
        new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...(type === "ALL" ? {} : { type }),
        }),
      { signal },
      true,
    ),
  );
  if (result.data.some((r) => r.petId !== id))
    throw Error("Invalid history scope");
  return result;
}
export async function saveHistory(
  id: string,
  input: EntryInput,
  existing?: CareEntry,
) {
  const result = historyEntrySchema.parse(
    await authenticatedRequest(
      path(id) + (existing ? "/" + z.uuid().parse(existing.id) : ""),
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...input,
          ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}),
        }),
      },
    ),
  );
  if (result.petId !== id) throw Error("Invalid history scope");
  return result;
}
export const deleteHistory = (id: string, entry: CareEntry) =>
  authenticatedRequest<void>(path(id) + "/" + z.uuid().parse(entry.id), {
    method: "DELETE",
    body: JSON.stringify({ expectedUpdatedAt: entry.updatedAt }),
  });
export async function refreshHistory(
  client: QueryClient,
  uid: string,
  id: string,
) {
  if (client.getQueryData<{ id: string }>(sessionKey)?.id !== uid) return;
  await client.invalidateQueries({ queryKey: historyKeys.pet(uid, id) });
}
