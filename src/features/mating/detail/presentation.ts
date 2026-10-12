import type { PublicMatingDetail } from "@/entities/mating-listing/model";
import { listingHeading } from "@/entities/listing/model/presentation";
export function matingMetadata(row: PublicMatingDetail) {
  return {
    title: `${listingHeading(row.pet)} — в’язка у ${row.location.city} — Лапа`,
    description: `${listingHeading(row.pet)}. В’язка: ${row.location.city}, ${row.location.region}. Умови та публічні контакти власника.`,
  };
}
