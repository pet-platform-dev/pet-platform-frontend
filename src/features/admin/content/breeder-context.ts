import type { Location } from "@/entities/location/model";
export type BreederListingContext = {
  id: string;
  source: "OPERATOR_PREPARED" | "OWNER_MANAGED";
  name: string | null;
  location?: Pick<Location, "id" | "city" | "region" | "countryCode"> | null;
};
export function withoutBreederReferences(body: Record<string, unknown>) {
  const fields = { ...body };
  delete fields.breederDraftId;
  delete fields.breederProfileId;
  delete fields.ownerReference;
  return fields;
}
