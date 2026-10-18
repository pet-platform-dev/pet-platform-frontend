import { z } from "zod";
import { breederMediaSchema } from "./media";
import { ApiError, publicRequest } from "@/shared/api/client";
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
    }),
  })
  .refine(
    ({ meta, data }) =>
      meta.pages === Math.ceil(meta.total / meta.limit) &&
      data.length <= meta.limit,
  );
export type BreederDirectoryCard = z.infer<typeof breederDirectoryCardSchema>;
export const breederDirectoryKey = ["breeder-directory"] as const;
export function directoryKey(page: number) {
  return [...breederDirectoryKey, page] as const;
}
export function directoryPage(value: string | string[] | undefined): number {
  return typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number(value) <= 100000
    ? Number(value)
    : 1;
}
export async function getBreederDirectory(page: number, signal?: AbortSignal) {
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw new ApiError(400, "Некоректна сторінка");
  return breederDirectorySchema.parse(
    await publicRequest(`/breeders?page=${page}&limit=24`, true, { signal }),
  );
}
