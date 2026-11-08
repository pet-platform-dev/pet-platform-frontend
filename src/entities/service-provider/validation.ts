import { z } from "zod";
import { categorySlugs } from "@/entities/service-offer/model";
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, "Заповніть поле")
    .max(max, `Не більше ${max} символів`)
    .refine(
      (s) => !/<!--|<![a-z][^>]*>|<\/?[a-z][^>]*>/i.test(s),
      "Вкажіть звичайний текст без HTML",
    );
const contact = (schema: z.ZodType<string>) =>
  z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? null : v),
    schema.nullable(),
  );
const phone = contact(
  z
    .string()
    .trim()
    .max(40)
    .transform((s) => s.replace(/[\s()-]/g, ""))
    .pipe(
      z
        .string()
        .regex(
          /^\+[1-9]\d{7,14}$/,
          "Вкажіть міжнародний номер: + та 8–15 цифр",
        ),
    ),
);
export const providerInputSchema = z.strictObject({
  kind: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  publicName: text(1, 160),
  description: text(0, 5000).nullable(),
  phone,
  viber: phone,
  whatsapp: phone,
  telegram: contact(
    z
      .string()
      .trim()
      .transform((s) => s.replace(/^@/, ""))
      .pipe(
        z
          .string()
          .regex(
            /^[A-Za-z][A-Za-z0-9_]{4,31}$/,
            "Вкажіть Telegram username (5–32 символи)",
          ),
      ),
  ),
  website: contact(
    z
      .url("Вкажіть повний URL")
      .max(2048)
      .refine((s) => {
        const u = new URL(s);
        return (
          ["http:", "https:"].includes(u.protocol) &&
          !u.username &&
          !u.password &&
          !/[\\\s]/.test(s)
        );
      }, "Вкажіть безпечний http/https URL"),
  ),
});
const list = z.array(text(1, 80)).max(10, "Не більше 10 значень");
const weight = z.number().int().min(1).max(150);
export const detailsSchemas = {
  "veterinary-care": z.strictObject({
    consultationType: z.enum(["GENERAL", "SPECIALIST", "FOLLOW_UP"]).optional(),
    specialties: list.optional(),
    emergencyContactAvailable: z.boolean().optional(),
    experienceYears: z.number().int().min(0).max(80).optional(),
  }),
  "pet-transportation": z.strictObject({
    coverage: z.enum(["LOCAL", "INTERCITY", "INTERNATIONAL"]).optional(),
    transportFormat: z.enum(["INDIVIDUAL", "SHARED", "PET_TAXI"]).optional(),
    operatingArea: text(1, 300).optional(),
    accompanied: z.boolean().optional(),
    maxWeightKg: weight.optional(),
  }),
  grooming: z.strictObject({
    petSizes: z
      .array(z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]))
      .max(4)
      .refine((v) => new Set(v).size === v.length)
      .optional(),
    techniques: list.optional(),
    maxWeightKg: weight.optional(),
  }),
  "dog-training": z.strictObject({
    sessionFormat: z.enum(["INDIVIDUAL", "GROUP", "BOTH"]).optional(),
    focusAreas: list.optional(),
  }),
  "pet-boarding": z.strictObject({
    setting: z.enum(["HOME", "FACILITY"]).optional(),
    capacity: z.number().int().min(1).max(100).optional(),
    vaccinationRequired: z.boolean().optional(),
    conditions: list.optional(),
  }),
  "pet-sitting": z.strictObject({
    careFormat: z.enum(["HOME_VISITS", "IN_HOME_CARE"]).optional(),
    conditions: list.optional(),
  }),
  "pet-walking": z.strictObject({
    walkDurationMinutes: z.number().int().min(10).max(240).optional(),
  }),
};
export const priceInputSchema = z
  .strictObject({
    mode: z.enum(["FIXED", "FROM", "ON_REQUEST"]),
    amount: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/,
        "Вкажіть суму з максимум двома десятковими знаками",
      )
      .refine((s) => /[1-9]/.test(s), "Ціна має бути додатною")
      .nullable(),
    unit: z
      .enum(["SERVICE", "VISIT", "SESSION", "HOUR", "DAY", "TRIP", "KM"])
      .nullable(),
  })
  .refine(
    (v) =>
      v.mode === "ON_REQUEST"
        ? v.amount === null && v.unit === null
        : v.amount !== null && v.unit !== null,
    "Вкажіть суму та одиницю ціни",
  );
const ids = (max: number) =>
  z
    .array(z.uuid())
    .max(max)
    .refine((v) => new Set(v).size === v.length, "Оберіть різні записи");
export const offerInputSchema = z
  .strictObject({
    categoryId: z.uuid(),
    title: text(5, 160),
    description: text(0, 5000).nullable(),
    mode: z.enum(["ONSITE", "MOBILE", "REMOTE"]),
    price: priceInputSchema,
    speciesIds: ids(2),
    providerLocationIds: ids(50),
    detailsVersion: z.literal(1),
    details: z
      .record(z.string(), z.json())
      .refine(
        (v) => new TextEncoder().encode(JSON.stringify(v)).length <= 8192,
      ),
  })
  .refine(
    (v) => v.mode !== "REMOTE" || v.providerLocationIds.length === 0,
    "Дистанційна послуга не має адреси",
  );
export function validateOffer(
  value: unknown,
  slug: (typeof categorySlugs)[number],
) {
  const parsed = offerInputSchema.parse(value);
  return { ...parsed, details: detailsSchemas[slug].parse(parsed.details) };
}
export type ProviderInput = z.infer<typeof providerInputSchema>;
export type Details = Record<string, string | string[] | number | boolean>;
export function validationFeedback(error: z.ZodError) {
  const labels: Record<string, string> = {
    kind: "Тип надавача",
    publicName: "Ім’я або назва",
    description: "Опис",
    phone: "Телефон",
    telegram: "Telegram",
    viber: "Viber",
    whatsapp: "WhatsApp",
    website: "Вебсайт",
    categoryId: "Категорія послуги",
    title: "Назва послуги",
    mode: "Формат надання",
    price: "Ціна",
    speciesIds: "Види тварин",
    providerLocationIds: "Місця надання",
    details: "Особливості послуги",
    detailsVersion: "Версія особливостей",
  };
  return Error(
    error.issues
      .map(
        (issue) =>
          `${labels[String(issue.path[0])] ?? "Форма"}: ${/[А-Яа-яІіЇїЄєҐґ]/.test(issue.message) ? issue.message : "Перевірте значення та допустимі межі поля"}`,
      )
      .join(". "),
  );
}
export type OfferInput = Omit<z.infer<typeof offerInputSchema>, "details"> & {
  details: Details;
};
export const emptyProvider: ProviderInput = {
  kind: "INDIVIDUAL",
  publicName: "",
  description: "",
  phone: null,
  telegram: null,
  viber: null,
  whatsapp: null,
  website: null,
};
