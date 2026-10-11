import Link from "next/link";
import type { PublicPet } from "@/entities/pet/public-profile";
import {
  listingHeading,
  listingGender,
  listingPrice,
} from "@/entities/listing/model/presentation";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { PetGallery } from "./pet-gallery";
import { PublicVideoPlayer } from "@/shared/ui/public-video-player";
export function petProfileTitle(pet: PublicPet) {
  return pet.name?.trim()
    ? pet.name + " — " + listingHeading(pet)
    : listingHeading(pet) + " — профіль тварини";
}
export function PublicPetContent({ pet }: { pet: PublicPet }) {
  const heading = listingHeading(pet),
    offer = pet.activeListingSummary;
  return (
    <main className="listing-detail-shell public-pet-profile">
      <Link href={pet.breederSummary.href} className="text-link">
        ← До розплідника
      </Link>
      <div className="public-pet-top">
        <PetGallery pet={pet} heading={petProfileTitle(pet)} />
        <section className="listing-detail-panel">
          <p className="eyebrow">Профіль тварини</p>
          <h1>{heading}</h1>
          {pet.name?.trim() && <h2 className="public-pet-name">{pet.name}</h2>}
          <p>
            {[listingGender(pet.gender), formatPetAge(pet.birthDate)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {pet.birthDate && (
            <p className="muted">
              Дата народження:{" "}
              <time dateTime={pet.birthDate}>
                {new Intl.DateTimeFormat("uk-UA", { timeZone: "UTC" }).format(
                  new Date(pet.birthDate),
                )}
              </time>
            </p>
          )}
          <p className="muted">Розплідник</p>
          <Link href={pet.breederSummary.href} className="text-link">
            {pet.breederSummary.kennelName}
          </Link>
        </section>
      </div>
      {pet.description?.trim() && (
        <section className="listing-detail-panel">
          <h2>Про тварину</h2>
          <p className="public-pet-text">{pet.description}</p>
        </section>
      )}
      {pet.specialTraits?.trim() && (
        <section className="listing-detail-panel">
          <h2>Чим особлива</h2>
          <p className="public-pet-text">{pet.specialTraits}</p>
        </section>
      )}
      {!!pet.videos.length && (
        <section className="listing-detail-panel">
          <h2>Відео</h2>
          <ul className="breeder-public-videos">
            {pet.videos.map((video, index) => (
              <PublicVideoPlayer
                key={video.id}
                video={video}
                index={index}
                label="Відео тварини"
              />
            ))}
          </ul>
        </section>
      )}
      {offer && (
        <section
          className="listing-detail-panel"
          aria-label="Активне оголошення"
        >
          <h2>Тварина має активне оголошення</h2>
          <p>{listingPrice(offer)}</p>
          <Link href={offer.href} className="button primary">
            Переглянути оголошення
          </Link>
        </section>
      )}
      <section className="listing-detail-panel">
        <h2>Розплідник</h2>
        <p>{pet.breederSummary.kennelName}</p>
        <Link href={pet.breederSummary.href} className="button secondary">
          Переглянути профіль розплідника
        </Link>
      </section>
    </main>
  );
}
