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
export function ListingCard({ listing }: { listing: Listing }) {
  const { pet } = listing;
  const age = formatPetAge(pet.birthDate);
  const gender = listingGender(pet.gender);
  const dateValue = listing.publishedAt ?? listing.createdAt;
  const date = listingDate(dateValue);
  return (
    <article className="listing-card">
      <Link
        className="listing-card-link"
        href={`/listings/${listing.id}`}
        prefetch={false}
        aria-label={`Переглянути оголошення: ${listingHeading(pet)} — ${listingPrice(listing)}`}
      >
        <ListingPlaceholder species={pet.species.slug} />
        <div className="listing-card-body">
          <span
            className={`listing-type listing-type-${listing.type.toLowerCase()}`}
          >
            {listingTypeLabels[listing.type]}
          </span>
          <h2>{listingHeading(pet)}</h2>
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
