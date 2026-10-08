import { z } from "zod";
export const createListingFormSchema = z
  .object({
    petId: z.uuid("Оберіть тварину"),
    locationId: z.uuid("Оберіть місце"),
    type: z.enum(["SALE", "FREE", "ADOPTION"], "Оберіть тип оголошення"),
    title: z
      .string()
      .trim()
      .min(5, "Заголовок має містити щонайменше 5 символів")
      .max(160, "Заголовок має містити не більше 160 символів"),
    description: z
      .string()
      .trim()
      .min(1, "Додайте опис")
      .max(5000, "Опис має містити не більше 5000 символів"),
    price: z.string().trim(),
  })
  .superRefine((input, ctx) => {
    if (input.type !== "SALE") return;
    const message = !input.price
      ? "Вкажіть ціну"
      : !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(input.price)
        ? "Вкажіть ціну до 9 999 999 999.99 з не більш ніж двома десятковими знаками"
        : /^0(?:\.0{1,2})?$/.test(input.price)
          ? "Ціна має бути більшою за 0"
          : null;
    if (message) ctx.addIssue({ code: "custom", path: ["price"], message });
  });
export type CreateListingFormInput = z.input<typeof createListingFormSchema>;
export type CreateListingPayload = Omit<
  z.output<typeof createListingFormSchema>,
  "price"
> & { price?: string };
export function createListingPayload(
  input: CreateListingFormInput,
): CreateListingPayload {
  const value = createListingFormSchema.parse(input);
  return {
    petId: value.petId,
    locationId: value.locationId,
    type: value.type,
    title: value.title,
    description: value.description,
    ...(value.type === "SALE" ? { price: value.price } : {}),
  };
}
