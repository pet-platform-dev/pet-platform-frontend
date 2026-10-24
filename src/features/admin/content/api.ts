import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import {
  contentSchema,
  petSchema,
  petDetailSchema,
  metaSchema,
  type ContentSource,
} from "./model";
export const contentKey = (actor: string, ...parts: unknown[]) =>
  ["admin-management", actor, "content", ...parts] as const;
export async function getContentList(
  p: URLSearchParams,
  pets: boolean,
  signal?: AbortSignal,
) {
  const envelope = await authenticatedRequest(
    `/admin/${pets ? "pets" : "listings"}?${p}`,
    { signal },
    true,
  );
  return pets
    ? z.object({ data: z.array(petSchema), meta: metaSchema }).parse(envelope)
    : z
        .object({ data: z.array(contentSchema), meta: metaSchema })
        .parse(envelope);
}
export async function getContent(
  id: string,
  source: ContentSource,
  signal?: AbortSignal,
) {
  z.uuid().parse(id);
  const row = contentSchema.parse(
    await authenticatedRequest(`/admin/listings/${id}?source=${source}`, {
      signal,
    }),
  );
  if (row.id !== id || row.source !== source)
    throw Error("Invalid content identity");
  return row;
}
export async function getManagedPet(id: string, signal?: AbortSignal) {
  z.uuid().parse(id);
  const row = petDetailSchema.parse(
    await authenticatedRequest(`/admin/pets/${id}`, { signal }),
  );
  if (row.id !== id) throw Error("Invalid pet identity");
  return row;
}
export async function saveContent(
  id: string | null,
  draft: boolean,
  body: unknown,
) {
  if (id) z.uuid().parse(id);
  const row = contentSchema.parse(
    await authenticatedRequest(
      `/admin/${draft ? "listing-drafts" : "listings"}${id ? "/" + id : ""}`,
      { method: id ? "PATCH" : "POST", body: JSON.stringify(body) },
    ),
  );
  if (id && row.id !== id) throw Error("Invalid mutation identity");
  return row;
}
export function contentHref(id: string, source: ContentSource) {
  return `/admin/listings/${id}?source=${source}`;
}
