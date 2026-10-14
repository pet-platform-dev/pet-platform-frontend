import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { authenticatedRequest } from "@/shared/api/client";
import { sessionKey } from "@/features/auth/session-provider";
import {
  vaccinationRecordSchema,
  medicationRecordSchema,
  healthMetaSchema,
  healthKeys,
  type HealthKind,
  type HealthInput,
  type HealthRecord,
} from "./model";
const path = (id: string, kind: HealthKind) =>
  "/pets/" + z.uuid().parse(id) + "/" + kind;
const schema = (kind: HealthKind) =>
  kind === "vaccinations" ? vaccinationRecordSchema : medicationRecordSchema;
export async function getHealth(
  id: string,
  kind: HealthKind,
  page = 1,
  limit = 20,
  signal?: AbortSignal,
) {
  const result = z
    .object({ data: z.array(schema(kind)).max(100), meta: healthMetaSchema })
    .parse(
      await authenticatedRequest(
        path(id, kind) +
          "?" +
          new URLSearchParams({ page: String(page), limit: String(limit) }),
        { signal },
        true,
      ),
    );
  if (result.data.some((r) => r.petId !== id))
    throw Error("Invalid health record scope");
  return result;
}
export async function saveHealth(
  id: string,
  kind: HealthKind,
  input: HealthInput,
  existing?: HealthRecord,
) {
  const r = schema(kind).parse(
    await authenticatedRequest(
      path(id, kind) + (existing ? "/" + z.uuid().parse(existing.id) : ""),
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...input,
          ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}),
        }),
      },
    ),
  );
  if (r.petId !== id || (existing && r.id !== existing.id))
    throw Error("Invalid health record scope");
  return r;
}
export const deleteHealth = (id: string, kind: HealthKind, r: HealthRecord) =>
  authenticatedRequest<void>(path(id, kind) + "/" + z.uuid().parse(r.id), {
    method: "DELETE",
    body: JSON.stringify({ expectedUpdatedAt: r.updatedAt }),
  });
export async function refreshHealth(
  client: QueryClient,
  uid: string,
  id: string,
  kind: HealthKind,
) {
  if (client.getQueryData<{ id: string }>(sessionKey)?.id !== uid) return;
  await client.invalidateQueries({ queryKey: healthKeys.pet(uid, id, kind) });
}
