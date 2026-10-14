import Link from "next/link";
import { isPublicPublication } from "@/shared/lib/moderation";
import { PublicationState } from "@/shared/ui/publication-state";
import { breederPetEditorHref } from "@/features/pet/navigation/editor-return";
import type { OwnBreederAnimal } from "@/entities/breeder/animals";
import { AnimalCard } from "./animal-card";
import { VisibilityControl } from "./visibility-control";
import { listingPrice } from "@/entities/listing/model/presentation";
import { PetMatingActions } from "@/features/mating/pet-mating-actions";
import { listingHeading } from "@/entities/listing/model/presentation";
import { petCareHref } from "@/features/pet-care/model";
export function AnimalManagementCard({
  animal,
  userId,
}: {
  animal: OwnBreederAnimal;
  userId: string;
}) {
  const offer = animal.currentListing;
  return (
    <AnimalCard animal={animal}>
      <VisibilityControl animal={animal} userId={userId} />
      {offer ? (
        <>
          <PublicationState row={offer} />
          <p className="breeder-listing-status">{listingPrice(offer)}</p>
        </>
      ) : (
        <p className="breeder-listing-status">Немає активного оголошення</p>
      )}
      <div className="breeder-animal-actions">
        <Link className="button secondary" href={petCareHref(animal.id)}>
          Догляд
        </Link>
        {animal.showOnBreederProfile && (
          <Link className="text-link" href={"/pets/" + animal.id}>
            Переглянути профіль тварини
          </Link>
        )}
        <Link
          className="button secondary"
          href={breederPetEditorHref(animal.id)}
        >
          Редагувати тварину
        </Link>
        {offer ? (
          <>
            {isPublicPublication(offer) && (
              <Link className="button secondary" href={offer.href}>
                Переглянути оголошення
              </Link>
            )}
            <Link className="button secondary" href={offer.href + "/edit"}>
              Редагувати оголошення
            </Link>
          </>
        ) : (
          <Link
            className="button primary"
            href={"/listings/new?petId=" + animal.id}
          >
            Створити оголошення
          </Link>
        )}
      </div>
      <PetMatingActions
        petId={animal.id}
        petLabel={animal.name?.trim() || listingHeading(animal)}
        activeMatingListing={animal.activeMatingListing}
        returnTo="/profile/breeder/animals"
      />
    </AnimalCard>
  );
}
