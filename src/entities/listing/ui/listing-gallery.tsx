"use client";
import type { Listing } from "../model/listing";
import { listingHeading } from "../model/presentation";
import { ListingPlaceholder } from "./listing-placeholder";
import { ImageGallery } from "@/shared/ui/image-gallery";
export { lightboxUrl } from "@/shared/ui/image-gallery";
export function ListingGallery({ listing }: { listing: Listing }) {
  return (
    <ImageGallery
      images={listing.images ?? []}
      heading={listingHeading(listing.pet)}
      emptyFallback={<ListingPlaceholder species={listing.pet.species.slug} />}
      failedFallback={
        <ListingPlaceholder
          species={listing.pet.species.slug}
          caption="Фото тимчасово недоступне"
        />
      }
    />
  );
}
