import { z } from "zod";
export const reviewInputSchema = z.strictObject({
  rating: z
    .number({ error: "Оберіть оцінку від 1 до 5" })
    .int()
    .min(1, "Оберіть оцінку від 1 до 5")
    .max(5, "Оберіть оцінку від 1 до 5"),
  comment: z
    .string()
    .trim()
    .min(10, "Напишіть щонайменше 10 символів")
    .max(2000, "Не більше 2000 символів")
    .refine(
      (text) =>
        !/[<>]/u.test(text) &&
        Array.from(text).every((char) => {
          const code = char.codePointAt(0)!;
          return code >= 32 || code === 9 || code === 10 || code === 13;
        }),
      "Відгук має містити лише звичайний текст без HTML",
    ),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;
