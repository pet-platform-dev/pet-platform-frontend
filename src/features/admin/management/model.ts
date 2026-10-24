import { z } from "zod";
export const sourceSchema = z.enum(["OWNER_MANAGED", "OPERATOR_PREPARED"]);
export type BreederSource = z.infer<typeof sourceSchema>;
const date = z.iso.datetime();
export const userSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().email(),
  role: z.enum(["USER", "BREEDER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]),
  accountType: z.enum(["SELLER", "BREEDER"]),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
  createdAt: date,
});
const meta = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(50),
  total: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
});
export const usersSchema = z.object({ data: z.array(userSchema), meta });
export const userDetailSchema = userSchema.extend({
  counts: z.object({
    pets: z.number().int().nonnegative(),
    listings: z.number().int().nonnegative(),
    matingListings: z.number().int().nonnegative(),
  }),
  breederProfile: z.object({ id: z.uuid(), kennelName: z.string() }).nullable(),
  sellerPath: z.string(),
  breederPath: z.string().nullable(),
});
export const breederRowSchema = z.object({
  id: z.uuid(),
  kennelName: z.string().nullable(),
  source: sourceSchema,
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  userId: z.uuid().nullable(),
  createdAt: date,
  updatedAt: date,
  consentConfirmed: z.boolean().optional(),
});
export const breedersSchema = z.object({
  data: z.array(breederRowSchema),
  meta,
});
export const breederDetailSchema = breederRowSchema
  .omit({ userId: true })
  .extend({
    userId: z.uuid().optional(),
    description: z.string().nullable(),
    website: z.string().nullable(),
    startedYear: z.number().int().nullable(),
    locationId: z.uuid().nullable(),
    location: z
      .object({
        id: z.uuid(),
        city: z.string(),
        region: z.string(),
        countryCode: z.string(),
        slug: z.string(),
      })
      .nullable(),
    breeds: z.array(
      z.object({
        breed: z.object({
          id: z.uuid(),
          name: z.string(),
          nameUk: z.string().nullable(),
        }),
      }),
    ),
    user: z
      .object({
        id: z.uuid(),
        firstName: z.string(),
        lastName: z.string().nullable(),
        accountType: z.enum(["SELLER", "BREEDER"]),
      })
      .optional(),
    consentAt: date.optional(),
    consentScope: z.string().optional(),
    consentSource: z.string().optional(),
    sourceReference: z.string().optional(),
    operatorNotes: z.string().nullable().optional(),
    preparedById: z.uuid().optional(),
    publicPath: z.string().nullable(),
    audit: z.array(
      z.object({
        id: z.uuid(),
        actorId: z.uuid(),
        action: z.enum([
          "CREATE_DRAFT",
          "UPDATE_DRAFT",
          "UPDATE_OWNER_PROFILE",
        ]),
        changedFields: z.array(z.string()),
        createdAt: date,
        revision: date,
      }),
    ),
  });
export type ManagedUser = z.infer<typeof userDetailSchema>;
export type ManagedBreeder = z.infer<typeof breederDetailSchema>;
export const roleLabels = {
  USER: "Користувач",
  BREEDER: "Заводчик (технічна роль)",
  MODERATOR: "Модератор",
  ADMIN: "Адміністратор",
  SUPER_ADMIN: "Суперадміністратор",
};
export const accountLabels = { SELLER: "Власник тварини", BREEDER: "Заводчик" };
export const verificationLabels = {
  UNVERIFIED: "Пошту не підтверджено",
  PENDING: "Очікує підтвердження",
  VERIFIED: "Пошту підтверджено",
  REJECTED: "Відхилено",
};
export const sourceLabels = {
  OWNER_MANAGED: "Профілі власників",
  OPERATOR_PREPARED: "Операторські чернетки",
};
export const sourceConsentLabels = {
  OWNER_REQUEST: "Запит власника",
  OWNER_MESSAGE: "Повідомлення власника",
  OWNER_DOCUMENT: "Документ від власника",
};
