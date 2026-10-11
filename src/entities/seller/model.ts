import { z } from "zod";
import { reviewSummarySchema } from "@/entities/review/model";
const phone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/)
  .nullable();
export const sellerSchema = z.object({
  reviewSummary: reviewSummarySchema.optional(),
  id: z.string(),
  displayName: z.string().min(1).max(201),
  location: z
    .object({
      id: z.string(),
      countryCode: z.string(),
      city: z.string(),
      region: z.string(),
      slug: z.string(),
    })
    .nullable(),
  phone,
  telegram: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]{4,31}$/)
    .nullable(),
  viber: phone,
  whatsapp: phone,
  memberSince: z.string(),
  breeder: z
    .object({ kennelName: z.string().min(1).max(160) })
    .nullable()
    .optional(),
});
export type Seller = z.infer<typeof sellerSchema>;
export const phoneInput = z
  .string()
  .trim()
  .max(40, "Телефон надто довгий")
  .refine(
    (value) => !value || /^\+[1-9]\d{7,14}$/.test(value.replace(/[ ()-]/g, "")),
    "Вкажіть міжнародний номер, наприклад +380501234567",
  );
export const profileInputSchema = z.object({
  phone: phoneInput,
  viber: phoneInput,
  whatsapp: phoneInput,
  telegram: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value),
      "Вкажіть Telegram username: 5–32 латинські символи, цифри або _",
    ),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export function messengerLinks(seller: Seller) {
  return [
    seller.telegram && {
      label: "Telegram",
      href: `https://t.me/${encodeURIComponent(seller.telegram)}`,
    },
    seller.viber && {
      label: "Viber",
      href: `viber://chat?number=${encodeURIComponent(seller.viber)}`,
    },
    seller.whatsapp && {
      label: "WhatsApp",
      href: `https://wa.me/${seller.whatsapp.slice(1)}`,
    },
  ].filter((link): link is { label: string; href: string } => Boolean(link));
}

export function sellerIdentity(seller: Seller) {
  return seller.breeder?.kennelName ?? seller.displayName;
}
