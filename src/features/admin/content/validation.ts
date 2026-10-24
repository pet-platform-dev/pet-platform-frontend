import { z } from "zod";
export const editorFields = z.object({
  title: z.string().trim().min(5, "Заголовок: від 5 до 160 символів").max(160),
  description: z.string().max(5000),
  price: z
    .string()
    .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Перевірте ціну")
    .nullable(),
  reason: z.string().max(1000).optional(),
});
export function readyDraftError(v: {
  status: string;
  speciesId: string | null;
  locationId: string | null;
  description: string;
  imageIds: string[];
  kind: string;
  price: string | null;
}) {
  if (
    v.status === "READY_FOR_REVIEW" &&
    (!v.speciesId ||
      !v.locationId ||
      v.description.trim().length < 10 ||
      !v.imageIds.length ||
      (v.kind === "SALE" && !(Number(v.price) > 0)))
  )
    return "Для перевірки потрібні вид, місце, опис, фото та коректна ціна.";
  return null;
}
