import { categorySchema } from "@/entities/service-offer/model";
import type {
  OwnedOffer,
  OwnedProvider,
} from "@/entities/service-provider/model";
import type { z } from "zod";

export function offerCategories(
  active: z.infer<typeof categorySchema>[],
  saved: OwnedOffer | undefined,
  kind: OwnedProvider["kind"],
) {
  if (!saved || active.some((c) => c.id === saved.categoryId)) return active;
  const retained = categorySchema.safeParse({
    ...saved.category,
    nameUk: `${saved.category.nameUk}${saved.category.isActive ? "" : " (неактивна)"}`,
    description: "",
    allowedProviderKinds: [kind],
  });
  return retained.success ? [...active, retained.data] : active;
}
