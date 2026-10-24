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
