import { z } from "zod";
const idSchema = z.uuid("Некоректний ідентифікатор");
const todayKyiv = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
  }).format(new Date());
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable()
    .optional();
export const websiteSchema = z
  .string()
  .trim()
  .max(2048, "Адреса сайту має містити не більше 2048 символів")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        /^https?:\/\//i.test(value) &&
        ["http:", "https:"].includes(url.protocol) &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password &&
        !/[\\\s]/.test(value)
      );
    } catch {
      return false;
    }
  }, "Вкажіть безпечну адресу сайту http або https без даних входу")
  .transform((value) => (value ? new URL(value).href : null))
  .pipe(
    z
      .string()
      .max(2048, "Адреса сайту має містити не більше 2048 символів")
      .nullable(),
  )
  .nullable()
  .optional();
export const breederProfileFields = {
  kennelName: z
    .string()
    .trim()
    .min(1, "Вкажіть назву розплідника")
    .max(160, "Назва розплідника має містити не більше 160 символів"),
  description: optionalText(
    5000,
    "Опис має містити не більше 5000 символів",
  ).refine(
    (value) => !value || !/<!--|<![a-z][^>]*>|<\/?[a-z][^>]*>/i.test(value),
    "Опис має бути звичайним текстом без HTML",
  ),
  locationId: idSchema.nullable().optional(),
  startedYear: z
    .number()
    .int("Вкажіть цілий рік початку роботи")
    .min(1900, "Рік початку роботи має бути не раніше 1900")
    .refine(
      (value) => value <= Number(todayKyiv().slice(0, 4)),
      "Рік початку роботи не може бути в майбутньому",
    )
    .nullable()
    .optional(),
  website: websiteSchema,
  breedIds: z
    .array(idSchema)
    .max(50, "Оберіть не більше 50 порід")
    .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))].sort())
    .optional(),
};

export const breederInputSchema = z.strictObject({
  ...breederProfileFields,
  breedIds: breederProfileFields.breedIds.default([]),
});
export type BreederInput = z.output<typeof breederInputSchema>;
export type BreederValues = {
  kennelName: string;
  description: string;
  startedYear: string;
  website: string;
};
export const emptyValues: BreederValues = {
  kennelName: "",
  description: "",
  startedYear: "",
  website: "",
};
export function parseBreederValues(
  values: BreederValues,
  locationId: string | null,
  breedIds: string[],
) {
  return breederInputSchema.safeParse({
    ...values,
    locationId,
    breedIds,
    startedYear: values.startedYear.trim() ? Number(values.startedYear) : null,
  });
}
