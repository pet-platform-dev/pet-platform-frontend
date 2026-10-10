import type { ReactNode } from "react";
import type { BreederAnimal } from "@/entities/breeder/animals";
import { PetPreview } from "@/entities/pet/ui/pet-preview";
import {
  listingHeading,
  listingGender,
} from "@/entities/listing/model/presentation";
import { formatPetAge } from "@/shared/lib/format-pet-age";
export function AnimalCard({
  animal,
  children,
}: {
  animal: BreederAnimal;
  children?: ReactNode;
}) {
  const title = listingHeading(animal);
  return (
    <article className="breeder-animal-card" data-pet-id={animal.id}>
      <PetPreview
        image={animal.previewImage}
        species={animal.species.slug}
        alt={title}
      />
      <div className="breeder-animal-content">
        <h3>{title}</h3>
        <p className="muted">
          {[listingGender(animal.gender), formatPetAge(animal.birthDate)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {animal.name?.trim() && (
          <p className="breeder-animal-name">{animal.name}</p>
        )}
        {children}
      </div>
    </article>
  );
}
