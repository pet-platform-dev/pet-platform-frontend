"use client";
import { getBreeds } from "./api";
import { breedLabel } from "@/entities/breed/model";
import { LargeReferenceSelect } from "@/shared/ui/large-reference-select";
export type BreedChoice = {
  id: string;
  name: string;
  nameUk: string | null;
  isActive?: boolean;
};
export function BreedSelector({
  species,
  selected,
  onSelect,
  error,
  onSearching,
  hint,
}: {
  species: "dog" | "cat" | undefined;
  selected: BreedChoice | null;
  onSelect: (breed: BreedChoice | null) => void;
  hint?: string;
  error?: string;
  onSearching: (value: boolean) => void;
}) {
  return (
    <LargeReferenceSelect<BreedChoice>
      key={species ?? "none"}
      label="Порода"
      clearLabel="Очистити породу"
      optional
      hint={
        hint ??
        "Якщо порода невідома або змішана, залиште поле порожнім. Назви без перевіреного перекладу подано англійською."
      }
      placeholder={
        species
          ? "Почніть вводити назву породи"
          : "Спочатку оберіть вид тварини"
      }
      queryKey={["breeds", species]}
      fetchPage={(search, page) => getBreeds(species!, search, page)}
      itemLabel={breedLabel}
      itemContext={(breed) =>
        breed.isActive === false ? "Недоступна для нового вибору" : ""
      }
      selected={selected}
      onSelect={onSelect}
      onSearching={onSearching}
      error={error}
      disabled={!species}
      rowHeight={64}
      desktopRowHeight={48}
    />
  );
}
