import type { Listing } from "@/entities/listing/model/listing";
import {
  listingDate,
  listingGender,
  listingHeading,
  listingLocation,
  listingPrice,
  listingTypeLabels,
} from "@/entities/listing/model/presentation";
import { supportingListingTitle } from "@/entities/listing/model/detail-presentation";
import { ListingGallery } from "@/entities/listing/ui/listing-gallery";
import { speciesLabel } from "@/entities/species/model";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { SellerCard } from "@/entities/seller/seller-card";

export function ListingDetailContent({ listing }: { listing: Listing }) {
  const { pet } = listing;
  const heading = listingHeading(pet);
  const age = formatPetAge(pet.birthDate);
  const gender = listingGender(pet.gender);
  const title = supportingListingTitle(listing);
  const dateValue = listing.publishedAt ?? listing.createdAt;
  const date = listingDate(dateValue);
  return (
    <>
      <div className="listing-detail-grid">
        <div className="listing-detail-media">
          <ListingGallery listing={listing} />
        </div>
        <section
          className="listing-detail-summary"
          aria-labelledby="listing-heading"
        >
          <p className="eyebrow">З турботою до нової родини</p>
          <h1 id="listing-heading">{heading}</h1>
          <span
            className={`listing-type listing-type-${listing.type.toLowerCase()}`}
          >
            {listingTypeLabels[listing.type]}
          </span>
          {(age || gender) && (
            <p className="listing-detail-metadata">
              {[age, gender].filter(Boolean).join(" • ")}
            </p>
          )}
          <p className="listing-detail-location">
            {listingLocation(listing.location)}
          </p>
          <p className="listing-detail-price">{listingPrice(listing)}</p>
          {pet.name?.trim() && (
            <p className="listing-detail-name">
              Ім’я: <span>{pet.name.trim()}</span>
            </p>
          )}
          {date && (
            <p className="listing-detail-date">
              {listing.publishedAt ? "Опубліковано" : "Додано"}{" "}
              <time dateTime={dateValue}>{date}</time>
            </p>
          )}
        </section>
        <section
          className="listing-detail-description listing-detail-panel"
          aria-labelledby="listing-about"
        >
          <p className="eyebrow">Знайомство ближче</p>
          <h2 id="listing-about">Про оголошення</h2>
          {title && <p className="listing-detail-title">{title}</p>}
          <p className="listing-description-text">{listing.description}</p>
        </section>
        <div className="listing-detail-sidebar">
          <section
            className="listing-detail-panel"
            aria-labelledby="listing-animal"
          >
            <h2 id="listing-animal">Про тварину</h2>
            <dl className="listing-detail-facts">
              <div>
                <dt>Вид</dt>
                <dd>{speciesLabel(pet.species.slug)}</dd>
              </div>
              <div>
                <dt>Порода</dt>
                <dd>{heading}</dd>
              </div>
              {age && (
                <div>
                  <dt>Вік</dt>
                  <dd>{age}</dd>
                </div>
              )}
              {gender && (
                <div>
                  <dt>Стать</dt>
                  <dd>{gender}</dd>
                </div>
              )}
            </dl>
          </section>
          <SellerCard seller={listing.seller} />
        </div>
      </div>
    </>
  );
}
