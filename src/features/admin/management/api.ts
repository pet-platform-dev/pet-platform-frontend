import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import {
  usersSchema,
  userDetailSchema,
  breedersSchema,
  breederDetailSchema,
  type BreederSource,
} from "./model";
import { listParams, type ListState } from "./navigation";
export const managementKey = (actorId: string, ...parts: unknown[]) =>
  ["admin-management", actorId, ...parts] as const;
export async function listUsers(state: ListState, signal?: AbortSignal) {
  const params = listParams(state, "users");
  params.set("limit", "24");
  return usersSchema.parse(
    await authenticatedRequest(`/admin/users?${params}`, { signal }, true),
  );
}
export async function listBreeders(state: ListState, signal?: AbortSignal) {
  const params = listParams(state, "breeders");
  params.set("limit", "24");
  return breedersSchema.parse(
    await authenticatedRequest(`/admin/breeders?${params}`, { signal }, true),
  );
}
export async function getManagedUser(id: string, signal?: AbortSignal) {
  z.uuid().parse(id);
  const row = userDetailSchema.parse(
    await authenticatedRequest(`/admin/users/${id}`, { signal }),
  );
  if (row.id !== id) throw Error("Invalid user identity");
  return row;
}
export async function getManagedBreeder(
  id: string,
  source: BreederSource,
  signal?: AbortSignal,
) {
  z.uuid().parse(id);
  const row = breederDetailSchema.parse(
    await authenticatedRequest(
      `/admin/breeders/${id}?${new URLSearchParams({ source })}`,
      { signal },
    ),
  );
  if (row.id !== id || row.source !== source)
    throw Error("Invalid breeder identity");
  return row;
}
export async function saveManagedBreeder(id: string | null, body: unknown) {
  if (id) z.uuid().parse(id);
  const row = breederDetailSchema.parse(
    await authenticatedRequest(`/admin/breeders${id ? "/" + id : ""}`, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }),
  );
  if (id && row.id !== id) throw Error("Invalid breeder mutation identity");
  return row;
}
