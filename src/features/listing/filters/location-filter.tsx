import { getLocations } from "@/entities/location/api";
import { locationContext } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import { ReferenceMultiSelect } from "@/shared/ui/reference-multi-select";
export function LocationFilter({
  selected,
  onChange,
}: {
  selected: Location[];
  onChange: (value: Location[]) => void;
}) {
  return (
    <ReferenceMultiSelect<Location>
      label="Місто або село"
      optional
      placeholder="Введіть назву міста або села"
      hint="Пошук за назвою населеного пункту, щонайменше 2 символи."
      queryKey={["locations"]}
      fetchPage={getLocations}
      itemLabel={(location) => location.city}
      itemContext={locationContext}
      selected={selected}
      onChange={onChange}
      minSearchLength={2}
      rowHeight={128}
      desktopRowHeight={88}
    />
  );
}
