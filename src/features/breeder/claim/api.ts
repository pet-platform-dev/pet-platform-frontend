import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
export const claimPreviewSchema = z.object({
  publicContacts: z
    .object({
      phone: z.string().nullable(),
      telegram: z.string().nullable(),
      viber: z.string().nullable(),
      whatsapp: z.string().nullable(),
    })
    .optional(),
  kennelName: z.string(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  startedYear: z.number().nullable(),
  expiresAt: z.string(),
  draftRevision: z.string(),
});
export type ClaimPreview = z.infer<typeof claimPreviewSchema>;
export const previewClaim = async (token: string) =>
  claimPreviewSchema.parse(
    await authenticatedRequest("/breeder-claims/preview", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
export const acceptClaim = async (token: string, expectedUpdatedAt: string) => {
  const result = z
    .object({
      profileId: z.uuid(),
      ownerId: z.uuid(),
      redirectTo: z.literal("/profile/breeder"),
    })
    .parse(
      await authenticatedRequest("/breeder-claims/accept", {
        method: "POST",
        body: JSON.stringify({
          token,
          expectedUpdatedAt,
          acceptOwnership: true,
        }),
      }),
    );
  return result;
};
