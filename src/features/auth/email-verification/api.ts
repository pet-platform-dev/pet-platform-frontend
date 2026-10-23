import {
  ApiError,
  authenticatedRequest,
  publicMutation,
} from "@/shared/api/client";

export async function confirmEmail(token: string): Promise<void> {
  const data = await publicMutation<{ verificationStatus: string }>(
    "/auth/email-verification/confirm",
    { token },
  );
  if (data?.verificationStatus !== "VERIFIED")
    throw new ApiError(0, "Unexpected verification response");
}
export async function resendEmail(): Promise<"accepted" | "already_verified"> {
  const data = await authenticatedRequest<{ status: string }>(
    "/auth/email-verification/resend",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  if (data?.status !== "accepted" && data?.status !== "already_verified")
    throw new ApiError(0, "Unexpected resend response");
  return data.status;
}
