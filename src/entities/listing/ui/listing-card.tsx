import type { Listing } from "../model/listing";
import Link from "next/link";
import {
  listingDate,
  listingGender,
  listingHeading,
  listingLocation,
  listingPrice,
  listingTypeLabels,
} from "../model/presentation";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { ListingPlaceholder } from "./listing-placeholder";
import { ListingImage } from "./listing-image";
export function ListingCard({
  listing,
  headingLevel = 2,
  detailHref = `/listings/${listing.id}`,
}: {
  listing: Listing;
  detailHref?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const { pet } = listing;
  const age = formatPetAge(pet.birthDate);
  const gender = listingGender(pet.gender);
  const dateValue = listing.publishedAt ?? listing.createdAt;
  const date = listingDate(dateValue);
  return (
    <article className="listing-card">
      <Link
        className="listing-card-link"
        href={detailHref}
        prefetch={false}
        aria-label={`Переглянути оголошення: ${listingHeading(pet)} — ${listingPrice(listing)}`}
      >
        {listing.images?.length ? (
          <ListingImage
            species={pet.species.slug}
            className="listing-cover"
            src={listing.images[0].thumbnailUrl}
            alt={`${listingHeading(pet)} — фото 1`}
            width="480"
            height="360"
            loading="lazy"
          />
        ) : (
          <ListingPlaceholder species={pet.species.slug} />
        )}
        <div className="listing-card-body">
          <span
            className={`listing-type listing-type-${listing.type.toLowerCase()}`}
          >
            {listingTypeLabels[listing.type]}
          </span>
          <Heading>{listingHeading(pet)}</Heading>
          {(gender || age) && (
            <p className="listing-metadata">
              {[age, gender].filter(Boolean).join(" • ")}
            </p>
          )}
          <p className="listing-location">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            {listingLocation(listing.location)}
          </p>
          <div className="listing-card-footer">
            <p className="listing-price">{listingPrice(listing)}</p>
            {date && <time dateTime={dateValue}>{date}</time>}
            {pet.name?.trim() && (
              <p className="listing-pet-name">Ім’я: {pet.name.trim()}</p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
