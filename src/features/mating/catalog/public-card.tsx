import Link from "next/link";
import type { PublicMating } from "@/entities/mating-listing/model";
import { feeLabel } from "@/entities/mating-listing/model";
import {
  listingHeading,
  listingLocation,
} from "@/entities/listing/model/presentation";
import { ListingImage } from "@/entities/listing/ui/listing-image";
import { ListingPlaceholder } from "@/entities/listing/ui/listing-placeholder";
import { genderLabel } from "@/entities/pet/model";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { matingDetailHref } from "../detail/navigation";
import type { MatingCatalogQuery } from "./query";
export function PublicMatingCard({
  row,
  query = { page: 1, limit: 24, sort: "newest" },
  returnTo,
  showOwner = true,
}: {
  row: PublicMating;
  query?: MatingCatalogQuery;
  returnTo?: string;
  showOwner?: boolean;
}) {
  const { pet } = row,
    heading = listingHeading(pet),
    age = formatPetAge(pet.birthDate),
    name = pet.name?.trim();
  const href = `/sellers/${encodeURIComponent(row.owner.id)}`;
  return (
    <article className="listing-card mating-public-card">
      <Link
        className="listing-card-link"
        href={matingDetailHref(row.id, query, returnTo)}
        prefetch={false}
      >
        {pet.profileImage ? (
          <ListingImage
            species={pet.species.slug}
            className="listing-cover"
            src={pet.profileImage.thumbnailUrl}
            alt={heading}
            width="480"
            height="360"
            loading="lazy"
          />
        ) : (
          <ListingPlaceholder species={pet.species.slug} />
        )}
        <div className="listing-card-body">
          <h2 title={heading}>{heading}</h2>
          <p className="listing-metadata">
            {[genderLabel[pet.gender], age].filter(Boolean).join(" · ")}
          </p>
          <p className="listing-location" title={listingLocation(row.location)}>
            {listingLocation(row.location)}
          </p>
          <p className="listing-price">{feeLabel(row.fee)}</p>
          {name && <p className="listing-pet-name">Ім’я: {name}</p>}
        </div>
      </Link>
      {showOwner && (
        <div className="mating-public-seller">
          <p>{row.owner.displayName}</p>
          <Link className="button secondary" href={href} prefetch={false}>
            Переглянути профіль
          </Link>
        </div>
      )}
    </article>
  );
}
