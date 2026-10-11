"use client";
import type { PublicPet } from "@/entities/pet/public-profile";
import { ImageGallery, type GalleryImage } from "@/shared/ui/image-gallery";
import { ListingPlaceholder } from "@/entities/listing/ui/listing-placeholder";
export function publicPetImages(pet: PublicPet): GalleryImage[] {
  const images: GalleryImage[] = pet.profileImage
    ? [
        {
          id: "profile-" + pet.id,
          url: pet.profileImage.url.replace(
            "/image/upload/",
            "/image/upload/f_auto,q_auto,c_limit,w_1200/",
          ),
          thumbnailUrl: pet.profileImage.thumbnailUrl,
        },
      ]
    : [];
  const urls = new Set(pet.profileImage ? [pet.profileImage.url] : []);
  for (const image of pet.gallery) {
    if (!urls.has(image.url)) {
      images.push({
        id: image.id,
        url: image.displayUrl,
        thumbnailUrl: image.thumbnailUrl,
      });
      urls.add(image.url);
    }
  }
  // An ACTIVE cover remains a safe final preview when Pet has no media of its own.
  if (!images.length && pet.activeListingSummary?.cover)
    images.push({
      id: "active-" + pet.activeListingSummary.id,
      url: pet.activeListingSummary.cover.thumbnailUrl,
      thumbnailUrl: pet.activeListingSummary.cover.thumbnailUrl,
    });
  return images;
}
export function PetGallery({
  pet,
  heading,
}: {
  pet: PublicPet;
  heading: string;
}) {
  return (
    <ImageGallery
      images={publicPetImages(pet)}
      heading={heading}
      emptyFallback={<ListingPlaceholder species={pet.species.slug} />}
      failedFallback={
        <ListingPlaceholder
          species={pet.species.slug}
          caption="Фото тимчасово недоступне"
        />
      }
    />
  );
}
