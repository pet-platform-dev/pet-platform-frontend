"use client";
import { useQuery } from "@tanstack/react-query";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { getSpecies } from "@/features/pet/api";
import { BreedSelector, type BreedChoice } from "@/features/pet/breed-selector";
import { LocationSelector } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
export function ContentReferences({
  speciesId,
  breed,
  location,
  onChange,
  pets = false,
}: {
  speciesId: string;
  breed: BreedChoice | null;
  location: Location | null;
  onChange: (v: {
    speciesId: string;
    breed: BreedChoice | null;
    location: Location | null;
  }) => void;
  pets?: boolean;
}) {
  const species = useQuery({ queryKey: ["species"], queryFn: getSpecies });
  const slug = species.data?.find((s) => s.id === speciesId)?.slug;
  return (
    <>
      <div className="field">
        <span>Вид тварини</span>
        <SelectDropdown
          label="Вид тварини"
          value={speciesId}
          options={[
            { value: "", label: "Усі види" },
            ...(species.data ?? []).map((s) => ({
              value: s.id,
              label: s.slug === "cat" ? "Кіт" : "Собака",
            })),
          ]}
          onChange={(id) => onChange({ speciesId: id, breed: null, location })}
        />
      </div>
      <BreedSelector
        species={slug === "dog" || slug === "cat" ? slug : undefined}
        selected={breed}
        onSearching={() => {}}
        onSelect={(b) => onChange({ speciesId, breed: b, location })}
      />
      {!pets && (
        <LocationSelector
          selected={location}
          onSelect={(l) => onChange({ speciesId, breed, location: l })}
        />
      )}
    </>
  );
}
