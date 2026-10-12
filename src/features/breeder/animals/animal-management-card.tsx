import Link from "next/link";
import { breederPetEditorHref } from "@/features/pet/navigation/editor-return";
import type { OwnBreederAnimal } from "@/entities/breeder/animals";
import { AnimalCard } from "./animal-card";
import { VisibilityControl } from "./visibility-control";
import { listingPrice } from "@/entities/listing/model/presentation";
import { PetMatingActions } from "@/features/mating/pet-mating-actions";
import { listingHeading } from "@/entities/listing/model/presentation";
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
      <p className="breeder-listing-status">
        {offer?.status === "ACTIVE"
          ? "Активне оголошення"
          : offer
            ? "Незавершене оголошення"
            : "Немає активного оголошення"}
        {offer?.status === "ACTIVE" && " · " + listingPrice(offer)}
      </p>
      <div className="breeder-animal-actions">
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
            {offer.status === "ACTIVE" && (
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
