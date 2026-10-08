import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Електронна адреса надто довга")
    .email("Введіть коректну електронну адресу"),
  password: z
    .string()
    .min(8, "Пароль має містити щонайменше 8 символів")
    .max(128, "Пароль має містити не більше 128 символів"),
});
export const registerSchema = loginSchema
  .extend({
    firstName: z
      .string()
      .trim()
      .min(1, "Введіть ім’я")
      .max(100, "Ім’я має містити не більше 100 символів"),
    lastName: z
      .string()
      .trim()
      .min(1, "Введіть прізвище")
      .max(100, "Прізвище має містити не більше 100 символів"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Паролі не збігаються",
    path: ["confirmPassword"],
  });
