import { z } from "zod";
import { publicMutation } from "@/shared/api/client";

export async function requestPasswordReset(email: string) {
  z.object({ status: z.literal("accepted") }).parse(
    await publicMutation("/auth/password-reset/request", { email }),
  );
}
export async function confirmPasswordReset(token: string, newPassword: string) {
  z.object({ status: z.literal("reset") }).parse(
    await publicMutation("/auth/password-reset/confirm", {
      token,
      newPassword,
    }),
  );
}
