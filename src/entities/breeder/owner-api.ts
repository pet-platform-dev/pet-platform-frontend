import { z } from "zod";
import { breederSchema } from "./model";
import { authenticatedRequest, ApiError } from "@/shared/api/client";
import type { BreederInput } from "@/features/breeder/editor/validation";
export const ownBreederSchema = breederSchema.extend({
  id: z.uuid(),
  locationId: z.uuid().nullable(),
  breedIds: z.array(z.uuid()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OwnBreeder = z.infer<typeof ownBreederSchema>;
export const ownBreederKey = (userId: string) =>
  ["own-breeder", userId] as const;
export async function getOwnBreeder(
  signal?: AbortSignal,
): Promise<OwnBreeder | null> {
  try {
    return ownBreederSchema.parse(
      await authenticatedRequest("/breeders/me", { signal }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
export async function saveBreeder(
  input: Partial<BreederInput>,
  exists: boolean,
) {
  return ownBreederSchema.parse(
    await authenticatedRequest("/breeders/me", {
      method: exists ? "PATCH" : "POST",
      body: JSON.stringify(input),
    }),
  );
}
export const deleteBreeder = () =>
  authenticatedRequest<void>("/breeders/me", { method: "DELETE" });
