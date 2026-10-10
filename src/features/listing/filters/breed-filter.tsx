import { getBreeds } from "@/features/pet/api";
import { breedLabel } from "@/entities/breed/model";
import { ReferenceMultiSelect } from "@/shared/ui/reference-multi-select";
import type { Filters, FilterBreed } from "./model";
export function BreedFilter({
  species,
  selected,
  onChange,
}: {
  species: Filters["species"];
  selected: FilterBreed[];
  onChange: (value: FilterBreed[]) => void;
}) {
  return (
    <ReferenceMultiSelect<FilterBreed>
      key={species ?? "none"}
      label="Породи"
      optional
      hint={
        species
          ? "Оберіть одну або кілька порід цього виду."
          : "Оберіть собак або котів, щоб знайти породи."
      }
      placeholder={
        species
          ? "Почніть вводити назву породи"
          : "Спочатку оберіть вид тварини"
      }
      queryKey={["breeds", species]}
      fetchPage={async (search, page) => {
        const result = await getBreeds(species!, search, page);
        return {
          ...result,
          data: result.data.map((breed) => ({ ...breed, species: species! })),
        };
      }}
      itemLabel={breedLabel}
      selected={selected}
      onChange={onChange}
      disabled={!species}
      rowHeight={64}
      desktopRowHeight={48}
    />
  );
}
