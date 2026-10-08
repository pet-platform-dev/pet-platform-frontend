import { z } from "zod";
export function todayKyiv() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const petFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Вкажіть ім’я тварини")
    .max(150, "Ім’я має містити не більше 150 символів"),
  speciesId: z.uuid("Оберіть вид тварини"),
  breedId: z
    .union([z.uuid("Оберіть доступну породу"), z.literal("")])
    .transform((value) => value || null),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"], {
    error: "Оберіть коректну стать",
  }),
  birthDate: z
    .string()
    .refine(
      (value) =>
        !value ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) &&
          new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value),
      "Вкажіть коректну дату народження",
    )
    .refine(
      (value) => !value || value <= todayKyiv(),
      "Дата народження не може бути в майбутньому",
    )
    .transform((value) => value || null),
  color: z
    .string()
    .trim()
    .max(150, "Колір має містити не більше 150 символів")
    .transform((value) => value || null),
  description: z
    .string()
    .trim()
    .max(5000, "Опис має містити не більше 5000 символів")
    .transform((value) => value || null),
  chipNumber: z
    .string()
    .trim()
    .max(50, "Номер чіпа має містити не більше 50 символів")
    .transform((value) => value || null),
  hasPassport: z.boolean(),
  hasPedigree: z.boolean(),
  vaccinated: z.boolean(),
});
