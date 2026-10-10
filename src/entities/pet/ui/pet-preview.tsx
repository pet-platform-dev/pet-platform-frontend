import { ListingImage } from "@/entities/listing/ui/listing-image";
import { ListingPlaceholder } from "@/entities/listing/ui/listing-placeholder";
export function PetPreview({
  image,
  species,
  alt,
}: {
  image: { thumbnailUrl: string } | null | undefined;
  species: string;
  alt: string;
}) {
  return (
    <div className="pet-preview">
      {image ? (
        <ListingImage
          src={image.thumbnailUrl}
          species={species}
          alt={alt}
          width="480"
          height="360"
          loading="lazy"
        />
      ) : (
        <ListingPlaceholder species={species} />
      )}
    </div>
  );
}
