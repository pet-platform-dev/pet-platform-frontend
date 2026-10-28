import { ReferenceMultiSelect } from "@/shared/ui/reference-multi-select";
import { breedLabel } from "@/entities/breed/model";
import { getBreeds } from "@/features/pet/api";
import type { Species } from "@/entities/species/model";
export type SelectedBreed = { id: string; name: string; nameUk: string | null };
export function BreederBreedSelector({
  selected,
  onChange,
  error,
  species,
}: {
  selected: SelectedBreed[];
  onChange: (items: SelectedBreed[]) => void;
  error?: string;
  species?: Species["slug"];
}) {
  return (
    <ReferenceMultiSelect<SelectedBreed>
      key={species ?? "all"}
      label="Породи"
      optional
      hint="Оберіть до 50 порід собак або котів."
      placeholder="Почніть вводити назву породи"
      queryKey={["breeds", species ?? "all"]}
      fetchPage={(search, page) => getBreeds(species, search, page)}
      itemLabel={breedLabel}
      selected={selected}
      onChange={onChange}
      error={error}
      rowHeight={64}
      desktopRowHeight={48}
    />
  );
}
