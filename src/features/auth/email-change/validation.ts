import { z } from "zod";
import { loginSchema } from "../validation";
export const emailChangeSchema = z.object({
  newEmail: loginSchema.shape.email,
  currentPassword: loginSchema.shape.password,
});
