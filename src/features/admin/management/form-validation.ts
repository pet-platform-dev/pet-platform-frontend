import { z } from "zod";
import {
  breederProfileFields,
  type BreederValues,
} from "@/features/breeder/editor/validation";
const plain = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (s) => !/<\/?[a-z][^>]*>|<!--/i.test(s),
      "Вкажіть звичайний текст без HTML",
    );
export const consentSchema = z.strictObject({
  consentConfirmed: z.literal(true, {
    error: "Підтвердьте наявність дозволу власника на підготовку чернетки.",
  }),
  consentAt: z
    .string()
    .min(1, "Вкажіть фактичну дату згоди")
    .refine(
      (s) => Number.isFinite(Date.parse(s)) && Date.parse(s) <= Date.now(),
      "Вкажіть фактичну дату згоди без майбутнього часу",
    )
    .transform((s) => new Date(s).toISOString()),
  consentScope: plain(1000).min(
    10,
    "Опишіть обсяг отриманого дозволу (щонайменше 10 символів)",
  ),
  consentSource: z.enum(["OWNER_REQUEST", "OWNER_MESSAGE", "OWNER_DOCUMENT"]),
  sourceReference: plain(200).min(
    3,
    "Вкажіть посилання на джерело дозволу або коротку довідку",
  ),
});
export function parseManagedFields(
  values: BreederValues,
  draft: boolean,
  locationId: string | null,
  breedIds: string[],
  operatorNotes: string,
) {
  return z
    .strictObject({
      ...breederProfileFields,
      kennelName: draft
        ? breederProfileFields.kennelName.nullable().optional()
        : breederProfileFields.kennelName,
      ...(draft ? { operatorNotes: plain(1000).nullable().optional() } : {}),
    })
    .safeParse({
      ...values,
      kennelName: draft && !values.kennelName.trim() ? null : values.kennelName,
      startedYear: values.startedYear.trim()
        ? Number(values.startedYear)
        : null,
      locationId,
      breedIds,
      ...(draft ? { operatorNotes: operatorNotes.trim() || null } : {}),
    });
}
