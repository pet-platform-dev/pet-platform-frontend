import { z } from "zod";
import { breederMediaSchema } from "./media";
import { ApiError, publicRequest } from "@/shared/api/client";
import { directoryParams, type DirectoryQuery } from "./directory-query";
export { directoryPage } from "./directory-query";
export const breederDirectoryCardSchema = z.object({
  userId: z.uuid(),
  kennelName: z.string().min(1).max(160),
  description: z.string().max(280).nullable(),
  location: z.object({ city: z.string(), region: z.string() }).nullable(),
  logo: breederMediaSchema.shape.logo,
  breeds: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        nameUk: z.string().nullable(),
        species: z.string(),
      }),
    )
    .max(3),
});
export const breederDirectorySchema = z
  .object({
    data: z.array(breederDirectoryCardSchema).max(24),
    meta: z.object({
      page: z.number().int().min(1).max(100000),
      limit: z.number().int().min(1).max(24),
      total: z.number().int().nonnegative(),
      pages: z.number().int().nonnegative(),
      hasPublicBreeders: z.boolean().optional(),
    }),
  })
  .refine(
    ({ meta, data }) =>
      meta.pages === Math.ceil(meta.total / meta.limit) &&
      data.length <= meta.limit,
  );
export type BreederDirectoryCard = z.infer<typeof breederDirectoryCardSchema>;
export const breederDirectoryKey = ["breeder-directory"] as const;
export function directoryKey(query: DirectoryQuery) {
  return [...breederDirectoryKey, directoryParams(query).toString()] as const;
}
export async function getBreederDirectory(
  query: DirectoryQuery,
  signal?: AbortSignal,
) {
  const { page } = query;
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw new ApiError(400, "Некоректна сторінка");
  return breederDirectorySchema.parse(
    await publicRequest(
      `/breeders?${directoryParams(query)}${directoryParams(query).size ? "&" : ""}limit=24`,
      true,
      { signal },
    ),
  );
}
