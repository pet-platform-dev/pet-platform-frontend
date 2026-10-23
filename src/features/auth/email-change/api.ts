import { z } from "zod";
import { authenticatedRequest, publicMutation } from "@/shared/api/client";
export const pendingChangeKey = (userId: string) =>
  ["email-change-pending", userId] as const;
export const pendingChangeSchema = z.object({
  pending: z
    .object({ newEmail: z.email(), expiresAt: z.iso.datetime() })
    .nullable(),
});
export async function pendingEmailChange(signal?: AbortSignal) {
  return pendingChangeSchema.parse(
    await authenticatedRequest("/auth/email-change/pending", { signal }),
  );
}
export async function requestEmailChange(
  newEmail: string,
  currentPassword: string,
) {
  z.object({ status: z.literal("accepted") }).parse(
    await authenticatedRequest("/auth/email-change/request", {
      method: "POST",
      body: JSON.stringify({ newEmail, currentPassword }),
    }),
  );
}
export async function confirmEmailChange(token: string) {
  z.object({ status: z.literal("changed") }).parse(
    await publicMutation("/auth/email-change/confirm", { token }),
  );
}
