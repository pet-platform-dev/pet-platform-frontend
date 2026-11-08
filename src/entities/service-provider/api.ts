import { z } from "zod";
import {
  authenticatedRequest,
  publicRequest,
  ApiError,
} from "@/shared/api/client";
import { categorySchema } from "@/entities/service-offer/model";
import {
  providerInputSchema,
  offerInputSchema,
  type ProviderInput,
  type OfferInput,
} from "./validation";
import {
  ownedProviderSchema,
  ownedOfferSchema,
  ownedLocationSchema,
  auditSchema,
  mediaSchema,
  pageSchema,
} from "./model";
export const workspaceRoot = "/service-workspace/providers";
function responseData<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      502,
      "Не вдалося прочитати дані сервера. Оновіть дані та спробуйте ще раз.",
    );
  return parsed.data;
}
const uuid = (id: string) => z.uuid().parse(id);
export const providerPath = (id: string) => `${workspaceRoot}/${uuid(id)}`;
export const offerPath = (p: string, o: string) =>
  `${providerPath(p)}/offers/${uuid(o)}`;
export async function readWorkspace<T extends z.ZodType>(
  path: string,
  schema: T,
  signal?: AbortSignal,
  envelope = false,
): Promise<z.infer<T>> {
  return responseData(
    schema,
    await authenticatedRequest(path, { signal }, envelope),
  );
}
export function listProviders(page: number, signal?: AbortSignal) {
  return readWorkspace(
    `${workspaceRoot}?includeArchived=true&page=${page}&limit=12`,
    pageSchema(ownedProviderSchema),
    signal,
    true,
  );
}
export function getProvider(id: string, signal?: AbortSignal) {
  return readWorkspace(providerPath(id), ownedProviderSchema, signal);
}
export function getOffer(p: string, o: string, signal?: AbortSignal) {
  return readWorkspace(offerPath(p, o), ownedOfferSchema, signal);
}
export function listOffers(id: string, page: number, signal?: AbortSignal) {
  return readWorkspace(
    `${providerPath(id)}/offers?includeArchived=true&page=${page}&limit=12`,
    pageSchema(ownedOfferSchema),
    signal,
    true,
  );
}
export function listLocations(id: string, signal?: AbortSignal) {
  return readWorkspace(
    `${providerPath(id)}/locations?limit=100`,
    pageSchema(ownedLocationSchema),
    signal,
    true,
  );
}
export function listAudit(id: string, page: number, signal?: AbortSignal) {
  return readWorkspace(
    `${providerPath(id)}/audit?page=${page}&limit=12`,
    pageSchema(auditSchema),
    signal,
    true,
  );
}
export async function categories(signal?: AbortSignal) {
  return z
    .array(categorySchema)
    .parse(await publicRequest("/service-categories", false, { signal }));
}
const revision = z.iso.datetime({ precision: 3 });
export async function writeWorkspace<T extends z.ZodType>(
  path: string,
  method: string,
  body: unknown,
  schema: T,
): Promise<z.infer<T>> {
  return responseData(
    schema,
    await authenticatedRequest(path, { method, body: JSON.stringify(body) }),
  );
}
export function createProvider(value: ProviderInput) {
  return writeWorkspace(
    workspaceRoot,
    "POST",
    providerInputSchema.parse(value),
    ownedProviderSchema,
  );
}
export function updateProvider(
  id: string,
  value: ProviderInput,
  expectedUpdatedAt: string,
) {
  const { kind, ...content } = providerInputSchema.parse(value);
  void kind;
  return writeWorkspace(
    providerPath(id),
    "PATCH",
    { ...content, expectedUpdatedAt: revision.parse(expectedUpdatedAt) },
    ownedProviderSchema,
  );
}
export function offerWriteBody(
  value: OfferInput,
  existing?: {
    id: string;
    updatedAt: string;
    categoryId: string;
    species: { id: string }[];
    locations: { id: string }[];
  },
  confirmed = false,
) {
  const content = offerInputSchema.parse(value);
  const payload: Partial<typeof content> = { ...content };
  const sameIds = (ids: string[], saved: { id: string }[]) =>
    JSON.stringify([...ids].map((id) => id.toLowerCase()).sort()) ===
    JSON.stringify(saved.map(({ id }) => id.toLowerCase()).sort());
  if (existing) {
    if (content.categoryId === existing.categoryId) delete payload.categoryId;
    if (sameIds(content.speciesIds, existing.species))
      delete payload.speciesIds;
    if (sameIds(content.providerLocationIds, existing.locations))
      delete payload.providerLocationIds;
  }
  return {
    ...payload,
    ...(existing
      ? {
          expectedUpdatedAt: revision.parse(existing.updatedAt),
          ...(content.categoryId !== existing.categoryId && confirmed
            ? { confirmCategoryChange: true }
            : {}),
        }
      : {}),
  };
}
export function saveOffer(
  p: string,
  value: OfferInput,
  existing?: Parameters<typeof offerWriteBody>[1],
  confirmed = false,
) {
  return writeWorkspace(
    existing ? offerPath(p, existing.id) : `${providerPath(p)}/offers`,
    existing ? "PATCH" : "POST",
    offerWriteBody(value, existing, confirmed),
    ownedOfferSchema,
  );
}
export function lifecycleAction(
  p: string,
  action: "archive" | "submit",
  expectedUpdatedAt: string,
  o?: string,
) {
  return writeWorkspace(
    `${o ? offerPath(p, o) : providerPath(p)}/${action}`,
    "POST",
    {
      expectedUpdatedAt: revision.parse(expectedUpdatedAt),
      ...(action === "archive" ? { confirm: true } : {}),
    },
    o ? ownedOfferSchema : ownedProviderSchema,
  );
}
const locationInput = z.strictObject({
  locationId: z.uuid(),
  kind: z.enum(["BASE", "SERVICE_AREA"]),
  publicAddress: z.string().trim().max(300),
  isPrimary: z.boolean(),
});
export function saveLocation(
  p: string,
  value: z.infer<typeof locationInput>,
  expectedUpdatedAt: string,
  existing?: { id: string; updatedAt: string },
) {
  return writeWorkspace(
    `${providerPath(p)}/locations${existing ? "/" + uuid(existing.id) : ""}`,
    existing ? "PATCH" : "POST",
    {
      ...locationInput.parse(value),
      expectedUpdatedAt: revision.parse(expectedUpdatedAt),
      ...(existing
        ? { expectedLocationUpdatedAt: revision.parse(existing.updatedAt) }
        : {}),
    },
    z.object({ provider: ownedProviderSchema, location: ownedLocationSchema }),
  );
}
export function removeLocation(
  p: string,
  location: { id: string; updatedAt: string },
  expectedUpdatedAt: string,
) {
  return writeWorkspace(
    `${providerPath(p)}/locations/${uuid(location.id)}`,
    "DELETE",
    {
      expectedUpdatedAt: revision.parse(expectedUpdatedAt),
      expectedLocationUpdatedAt: revision.parse(location.updatedAt),
    },
    z.object({ provider: ownedProviderSchema, removedLocationId: z.uuid() }),
  );
}
export const mediaPath = (p: string, o?: string) =>
  `${o ? offerPath(p, o) : providerPath(p)}/media`;
export function getMedia(p: string, o?: string, signal?: AbortSignal) {
  return readWorkspace(mediaPath(p, o), mediaSchema, signal);
}
export const SERVICE_FILE_LIMIT = 3 * 1024 * 1024;
export function validateFile(file: Pick<File, "size" | "type">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Оберіть JPEG, PNG або WebP");
  if (!file.size || file.size > SERVICE_FILE_LIMIT)
    throw Error("Зображення має бути не більше 3 MiB");
}
export async function uploadMedia(
  p: string,
  o: string | undefined,
  file: File,
  type: "LOGO" | "COVER" | "IMAGE",
  expectedUpdatedAt: string,
  replacement?: string,
) {
  validateFile(file);
  if (o && type !== "IMAGE") throw Error("Пропозиція підтримує лише галерею");
  const body = new FormData();
  body.set("file", file);
  body.set("type", type);
  body.set("expectedUpdatedAt", revision.parse(expectedUpdatedAt));
  return mediaSchema.parse(
    await authenticatedRequest(
      `${mediaPath(p, o)}/${replacement ? uuid(replacement) : "uploads"}`,
      { method: replacement ? "PATCH" : "POST", body },
    ),
  );
}
export function removeMedia(
  p: string,
  o: string | undefined,
  id: string,
  expectedUpdatedAt: string,
) {
  return writeWorkspace(
    `${mediaPath(p, o)}/${uuid(id)}`,
    "DELETE",
    { expectedUpdatedAt: revision.parse(expectedUpdatedAt) },
    mediaSchema,
  );
}
export function reorderMedia(
  p: string,
  o: string | undefined,
  ids: string[],
  expectedUpdatedAt: string,
) {
  return writeWorkspace(
    `${mediaPath(p, o)}/reorder`,
    "POST",
    {
      ids: z
        .array(z.uuid())
        .max(o ? 10 : 20)
        .parse(ids),
      expectedUpdatedAt: revision.parse(expectedUpdatedAt),
    },
    mediaSchema,
  );
}
export function coverMedia(
  p: string,
  o: string,
  id: string,
  expectedUpdatedAt: string,
) {
  return writeWorkspace(
    `${mediaPath(p, o)}/cover`,
    "PATCH",
    { mediaId: uuid(id), expectedUpdatedAt: revision.parse(expectedUpdatedAt) },
    mediaSchema,
  );
}
