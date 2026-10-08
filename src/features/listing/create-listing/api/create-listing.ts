import { z } from "zod";
import { authenticatedRequest } from "@/shared/api/client";
import {
  createListingPayload,
  type CreateListingFormInput,
} from "../model/schema";
const createdDraftSchema = z.object({
  id: z.uuid(),
  status: z.literal("DRAFT"),
});
export async function createListing(input: CreateListingFormInput) {
  const data = await authenticatedRequest<unknown>("/listings", {
    method: "POST",
    body: JSON.stringify(createListingPayload(input)),
  });
  return createdDraftSchema.parse(data);
}
