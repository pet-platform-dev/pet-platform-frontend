import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import {
  createListingPayload,
  createListingFormSchema,
  type CreateListingFormInput,
} from "../model/schema";
const createdDraftSchema = z.object({
  id: z.uuid(),
  status: z.literal("DRAFT"),
});
import { petFormSchema } from "@/features/pet/validation";
export type UnifiedListingInput = {
  input: CreateListingFormInput;
  pet?: z.output<typeof petFormSchema>;
  uploadSessionId?: string;
  imageIds: string[];
};
export function unifiedListingPayload({
  input,
  pet,
  uploadSessionId,
  imageIds,
}: UnifiedListingInput) {
  const fields = createListingFormSchema
    .safeExtend({ petId: z.string() })
    .parse(input);
  const listing = {
    locationId: fields.locationId,
    type: fields.type,
    title: fields.title,
    description: fields.description,
    ...(fields.type === "SALE" ? { price: fields.price } : {}),
    ...(uploadSessionId ? { uploadSessionId } : {}),
    ...(imageIds.length ? { imageIds } : {}),
  };
  if (!pet) return { ...createListingPayload(input), ...listing };
  return {
    ...listing,
    pet: {
      speciesId: pet.speciesId,
      breedId: pet.breedId,
      name: pet.name,
      gender: pet.gender,
      birthDate: pet.birthDate,
      color: pet.color,
      hasPassport: pet.hasPassport,
      hasPedigree: pet.hasPedigree,
      vaccinated: pet.vaccinated,
    },
  };
}
export async function createUnifiedListing(value: UnifiedListingInput) {
  return createdDraftSchema.parse(
    await authenticatedRequest<unknown>(
      value.pet ? "/listings/with-pet" : "/listings",
      { method: "POST", body: JSON.stringify(unifiedListingPayload(value)) },
    ),
  );
}
export async function createListing(input: CreateListingFormInput) {
  const data = await authenticatedRequest<unknown>("/listings", {
    method: "POST",
    body: JSON.stringify(createListingPayload(input)),
  });
  return createdDraftSchema.parse(data);
}
