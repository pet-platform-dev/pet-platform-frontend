import { getPublicMatingDetail } from "@/entities/mating-listing/public-api";
import { getSeller } from "@/entities/seller/api";
import { getPublicPet } from "@/entities/pet/public-profile";
import { ApiError } from "@/shared/api/client";
import type { PublicMatingDetail } from "@/entities/mating-listing/model";
import type { Seller } from "@/entities/seller/model";
export type MatingDetailData = {
  row: PublicMatingDetail;
  seller: Seller | null;
  petProfileHref: string | null;
};
export async function getMatingDetailData(
  id: string,
  signal?: AbortSignal,
): Promise<MatingDetailData> {
  const row = await getPublicMatingDetail(id, signal);
  return getMatingDetailContext(row, signal);
}
export async function getMatingDetailContext(
  row: PublicMatingDetail,
  signal?: AbortSignal,
): Promise<MatingDetailData> {
  const seller = await getSeller(row.owner.id, signal);
  if (seller.id !== row.owner.id) throw new Error("Профіль недоступний");
  let petProfileHref: string | null = null;
  // Current public Pet consent is breeder-only. Confirm via its public endpoint;
  // never infer visibility from ownership, or borrow an owner-private Pet query.
  if (seller.breeder) {
    try {
      await getPublicPet(row.pet.id);
      petProfileHref = `/pets/${encodeURIComponent(row.pet.id)}`;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }
  return { row, seller, petProfileHref };
}
