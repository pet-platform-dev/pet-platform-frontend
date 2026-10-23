import { z } from "zod";
import { loginSchema } from "../validation";

export const forgotPasswordSchema = loginSchema.pick({ email: true });
export const resetPasswordSchema = z
  .object({
    newPassword: loginSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Паролі не збігаються",
    path: ["confirmPassword"],
  });
