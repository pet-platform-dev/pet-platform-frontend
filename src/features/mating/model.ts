import { z } from "zod";
import { ApiError } from "@/shared/api/client";
export type FeeMode = "agreement" | "free" | "fixed";
export const matingFormSchema = z
  .object({
    petId: z.uuid("Оберіть свою тварину."),
    locationId: z.uuid("Оберіть населений пункт."),
    description: z
      .string()
      .trim()
      .min(1, "Вкажіть опис.")
      .max(5000, "Не більше 5000 символів.")
      .refine(
        (text) =>
          !/[<>]/u.test(text) &&
          Array.from(text).every(
            (char) =>
              char.charCodeAt(0) >= 32 ||
              [9, 10, 13].includes(char.charCodeAt(0)),
          ),
        "Вкажіть звичайний текст без HTML.",
      ),
    feeMode: z.enum(["agreement", "free", "fixed"]),
    feeText: z.string(),
  })
  .refine(
    (input) =>
      input.feeMode !== "fixed" ||
      /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(
        input.feeText.trim().replace(",", "."),
      ),
    {
      path: ["feeText"],
      message:
        "Вкажіть суму від 0 до 9 999 999 999,99 грн із не більш ніж двома десятковими знаками.",
    },
  );
export type MatingFormInput = z.infer<typeof matingFormSchema>;
export function matingFields(input: MatingFormInput) {
  const valid = matingFormSchema.parse(input);
  return {
    description: valid.description,
    locationId: valid.locationId,
    fee:
      valid.feeMode === "agreement"
        ? null
        : valid.feeMode === "free"
          ? "0"
          : valid.feeText.trim().replace(",", "."),
  };
}
export function feeMode(fee: string | null): FeeMode {
  return fee === null
    ? "agreement"
    : /^0(?:\.0{1,2})?$/.test(fee)
      ? "free"
      : "fixed";
}
export const petEligible = (pet: { gender: string }) =>
  pet.gender === "MALE" || pet.gender === "FEMALE";
export const genderRequired =
  "Щоб створити оголошення про в’язку, вкажіть стать тварини.";
export const activeConflict =
  "Для цієї тварини вже є активне оголошення про в’язку.";
export function matingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Сесію завершено. Увійдіть знову.";
    if (error.status === 404) return "Оголошення недоступне.";
    if (error.message === "Тварина вже має активне оголошення про в’язку")
      return activeConflict;
    if (error.message === "Спочатку вкажіть стать тварини")
      return "Для створення оголошення вкажіть стать тварини.";
    if (error.message === "Оберіть доступний населений пункт")
      return "Оберіть коректний населений пункт.";
    if (error.status === 409)
      return "Дані змінилися. Оновіть оголошення та спробуйте ще раз.";
    if (error.status === 403) return "Оновіть сторінку та спробуйте ще раз.";
    if (error.status === 429) return "Забагато запитів. Спробуйте за хвилину.";
  }
  return "Не вдалося зберегти оголошення.";
}
