import { ReferenceMultiSelect } from "@/shared/ui/reference-multi-select";
import { breedLabel } from "@/entities/breed/model";
import { getBreeds } from "@/features/pet/api";
export type SelectedBreed = { id: string; name: string; nameUk: string | null };
export function BreederBreedSelector({
  selected,
  onChange,
  error,
}: {
  selected: SelectedBreed[];
  onChange: (items: SelectedBreed[]) => void;
  error?: string;
}) {
  return (
    <ReferenceMultiSelect<SelectedBreed>
      label="Породи"
      optional
      hint="Оберіть до 50 порід собак або котів."
      placeholder="Почніть вводити назву породи"
      queryKey={["breeds", "all"]}
      fetchPage={(search, page) => getBreeds(undefined, search, page)}
      itemLabel={breedLabel}
      selected={selected}
      onChange={onChange}
      error={error}
      rowHeight={64}
      desktopRowHeight={48}
    />
  );
}
