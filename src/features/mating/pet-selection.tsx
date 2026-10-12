"use client";
import Link from "next/link";
import type { Pet } from "@/entities/pet/model";
import { genderLabel } from "@/entities/pet/model";
import type { MatingPet, OwnMating } from "@/entities/mating-listing/model";
import { listingHeading } from "@/entities/listing/model/presentation";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { PetPreview } from "@/entities/pet/ui/pet-preview";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { activeConflict, genderRequired, petEligible } from "./model";
export function MatingPetSummary({ pet }: { pet: MatingPet | Pet }) {
  const age = formatPetAge(pet.birthDate),
    name = pet.name?.trim();
  return (
    <div className="mating-pet-summary">
      <PetPreview
        image={pet.profileImage}
        species={pet.species.slug}
        alt={name || listingHeading(pet)}
      />
      <div>
        <h2>{listingHeading(pet)}</h2>
        {name && <p className="muted">{name}</p>}
        <p>
          {genderLabel[pet.gender]}
          {age ? " · " + age : ""}
        </p>
      </div>
    </div>
  );
}
export function PetEligibility({
  pet,
  active,
}: {
  pet: MatingPet | Pet;
  active?: OwnMating;
}) {
  if (!petEligible(pet))
    return (
      <div className="mating-notice" role="status">
        <p>{genderRequired}</p>
        <Link className="button secondary" href={`/pets/${pet.id}/edit`}>
          Вказати стать тварини
        </Link>
      </div>
    );
  if (active)
    return (
      <div className="mating-notice" role="status">
        <p>{activeConflict}</p>
        <Link className="button secondary" href={`/mating/${active.id}/edit`}>
          Редагувати активне оголошення
        </Link>
        <p className="muted">
          Можна зберегти чернетку. Публікація стане доступною після завершення
          активного оголошення.
        </p>
      </div>
    );
  return null;
}
export function MatingPetSelection({
  pets,
  petId,
  onSelect,
  active,
  error,
}: {
  pets: Pet[];
  petId: string;
  onSelect: (id: string) => void;
  active: OwnMating[];
  error?: string;
}) {
  const selected = pets.find((pet) => pet.id === petId);
  return (
    <section className="mating-panel" aria-label="Тварина для оголошення">
      <h2>Ваша тварина</h2>
      <p className="muted">Оберіть свою тварину, для якої шукаєте пару.</p>
      {pets.length ? (
        <>
          <SelectDropdown
            label="Тварина"
            value={petId}
            onChange={onSelect}
            invalid={Boolean(error)}
            describedBy={error ? "mating-pet-error" : undefined}
            options={[
              { value: "", label: "Оберіть свою тварину" },
              ...pets.map((pet) => ({
                value: pet.id,
                label: [
                  listingHeading(pet),
                  pet.name?.trim(),
                  genderLabel[pet.gender],
                  formatPetAge(pet.birthDate),
                ]
                  .filter(Boolean)
                  .join(" · "),
              })),
            ]}
          />
          {error && (
            <p className="field-error" id="mating-pet-error">
              {error}
            </p>
          )}
          {selected && (
            <>
              <MatingPetSummary pet={selected} />
              <PetEligibility
                pet={selected}
                active={active.find((row) => row.pet.id === selected.id)}
              />
            </>
          )}
        </>
      ) : (
        <>
          <p>Спочатку додайте свою тварину.</p>
          <Link className="button secondary" href="/pets/new">
            Додати тварину
          </Link>
        </>
      )}
    </section>
  );
}
