import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
export const invitationsSchema = z.object({
  claimedProfileId: z.uuid().nullable(),
  claimedAt: z.string().nullable(),
  claimedOwnerId: z.uuid().nullable(),
  invitations: z.array(
    z.object({
      id: z.uuid(),
      recipientEmail: z.email(),
      status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]),
      deliveryState: z.enum([
        "CREATED",
        "ACCEPTED",
        "CAPTURED",
        "UNKNOWN",
        "FAILED",
      ]),
      createdAt: z.string(),
      expiresAt: z.string(),
      terminalAt: z.string().nullable(),
      acceptedById: z.uuid().nullable(),
    }),
  ),
});
export const getInvitations = async (id: string, signal?: AbortSignal) =>
  invitationsSchema.parse(
    await authenticatedRequest(
      `/admin/breeders/${z.uuid().parse(id)}/invitations`,
      { signal },
    ),
  );
export const sendInvitation = async (
  id: string,
  email: string,
  expectedUpdatedAt: string,
  resend: boolean,
) =>
  invitationsSchema.parse(
    await authenticatedRequest(
      `/admin/breeders/${z.uuid().parse(id)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email, expectedUpdatedAt, resend }),
      },
    ),
  );
export const revokeInvitation = async (id: string, invitationId: string) =>
  invitationsSchema.parse(
    await authenticatedRequest(
      `/admin/breeders/${z.uuid().parse(id)}/invitations/${z.uuid().parse(invitationId)}/revoke`,
      { method: "POST", body: "{}" },
    ),
  );
