import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import {
  reminderKeys,
  reminderPageSchema,
  reminderSchema,
  type Reminder,
  type ReminderInput,
  type ReminderStatus,
} from "./model";
import { petCareKeys } from "../model";
import { sessionKey } from "@/features/auth/session-provider";
import type { QueryClient } from "@tanstack/react-query";
const path = (id: string) => "/pets/" + z.uuid().parse(id) + "/reminders";
export async function getReminders(
  id: string,
  status: ReminderStatus,
  page = 1,
  limit = 20,
  signal?: AbortSignal,
) {
  const result = reminderPageSchema.parse(
    await authenticatedRequest(
      path(id) +
        "?" +
        new URLSearchParams({
          status,
          page: String(page),
          limit: String(limit),
        }),
      { signal },
      true,
    ),
  );
  if (result.data.some((r) => r.petId !== id))
    throw Error("Invalid reminder scope");
  return result;
}
export async function saveReminder(
  petId: string,
  input: ReminderInput,
  existing?: Reminder,
) {
  return reminderSchema.parse(
    await authenticatedRequest(
      path(petId) + (existing ? "/" + z.uuid().parse(existing.id) : ""),
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...input,
          ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}),
        }),
      },
    ),
  );
}
export async function changeReminder(
  petId: string,
  r: Reminder,
  action: "complete" | "delete",
) {
  return authenticatedRequest(
    path(petId) +
      "/" +
      z.uuid().parse(r.id) +
      (action === "complete" ? "/complete" : ""),
    {
      method: action === "complete" ? "POST" : "DELETE",
      body: JSON.stringify({ expectedUpdatedAt: r.updatedAt }),
    },
  );
}
export async function refreshReminders(
  client: QueryClient,
  uid: string,
  id: string,
) {
  if (client.getQueryData<{ id: string }>(sessionKey)?.id !== uid) return;
  await Promise.all([
    client.invalidateQueries({ queryKey: reminderKeys.pet(uid, id) }),
    client.invalidateQueries({
      queryKey: petCareKeys.dashboard(uid, id),
      exact: true,
    }),
  ]);
}
