import Link from "next/link";
import type { MatingDetailData } from "./data";
import {
  listingHeading,
  listingGender,
  listingLocation,
} from "@/entities/listing/model/presentation";
import { speciesLabel } from "@/entities/species/model";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { feeLabel } from "@/entities/mating-listing/model";
import { ListingImage } from "@/entities/listing/ui/listing-image";
import { ListingPlaceholder } from "@/entities/listing/ui/listing-placeholder";
import { SellerCard } from "@/entities/seller/seller-card";
export function MatingDetailContent({
  detail,
  isOwner,
  contactsReady = true,
  reportAction,
}: {
  detail: MatingDetailData;
  isOwner: boolean;
  contactsReady?: boolean;
  reportAction?: React.ReactNode;
}) {
  const { row, seller, petProfileHref } = detail,
    { pet } = row;
  const heading = listingHeading(pet),
    age = formatPetAge(pet.birthDate),
    gender = listingGender(pet.gender);
  const edit = (
    <Link
      className="button secondary"
      href={`/mating/${encodeURIComponent(row.id)}/edit`}
    >
      Редагувати оголошення
    </Link>
  );
  return (
    <div className="listing-detail-grid mating-detail-grid">
      <div className="listing-detail-media mating-detail-image">
        {pet.profileImage ? (
          <ListingImage
            src={pet.profileImage.url}
            species={pet.species.slug}
            alt={heading + (pet.name?.trim() ? " — " + pet.name.trim() : "")}
            width="800"
            height="600"
          />
        ) : (
          <ListingPlaceholder species={pet.species.slug} />
        )}
      </div>
      <section
        className="listing-detail-summary"
        aria-labelledby="mating-heading"
      >
        <p className="eyebrow">Оголошення про в’язку</p>
        <h1 id="mating-heading">{heading}</h1>
        {pet.name?.trim() && (
          <p className="listing-detail-name">
            Ім’я: <span>{pet.name.trim()}</span>
          </p>
        )}
        <p className="listing-detail-metadata">
          {[age, gender].filter(Boolean).join(" · ")}
        </p>
        <p className="listing-detail-location">
          {listingLocation(row.location)}
        </p>
        <p className="listing-detail-price">{feeLabel(row.fee)}</p>
        {petProfileHref && (
          <Link href={petProfileHref} className="button secondary">
            Переглянути профіль тварини
          </Link>
        )}
      </section>
      <section
        className="listing-detail-description listing-detail-panel"
        aria-labelledby="mating-about"
      >
        <h2 id="mating-about">Про тварину та умови в’язки</h2>
        <p className="listing-description-text">{row.description}</p>
        <p className="mating-safety-note">
          Вік та стан здоров’я тварини слід оцінювати індивідуально. За потреби
          проконсультуйтеся з ветеринаром.
        </p>
      </section>
      <div className="listing-detail-sidebar">
        <section
          className="listing-detail-panel"
          aria-labelledby="mating-animal"
        >
          <h2 id="mating-animal">Про тварину</h2>
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
        {seller ? (
          <SellerCard
            seller={seller}
            heading={seller.breeder ? "Розплідник" : "Власник"}
            hideContacts={isOwner || !contactsReady}
            contactHeading="Зв’язатися з власником"
          >
            {isOwner && edit}
          </SellerCard>
        ) : (
          <section className="listing-detail-panel">
            <h2>Власник</h2>
            <p>{row.owner.displayName}</p>
            {isOwner && edit}
            <Link
              href={`/sellers/${encodeURIComponent(row.owner.id)}`}
              className="button secondary"
            >
              Переглянути профіль
            </Link>
          </section>
        )}
        {reportAction}
      </div>
    </div>
  );
}
