"use client";
import { getLocations } from "./api";
import type { Location } from "./model";
import { LargeReferenceSelect } from "@/shared/ui/large-reference-select";
const types = { CITY: "Місто", SETTLEMENT: "Селище", VILLAGE: "Село" };
export function locationContext(location: Location) {
  return [
    location.settlementType ? types[location.settlementType] : null,
    location.region,
    location.district ? `${location.district} район` : null,
    location.community ? `${location.community} громада` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function LocationSelector({
  selected,
  onSelect,
  error,
}: {
  selected: Location | null;
  onSelect: (location: Location | null) => void;
  error?: string;
}) {
  return (
    <LargeReferenceSelect<Location>
      label="Місце"
      placeholder="Введіть назву міста або села"
      hint="Введіть щонайменше 2 символи та оберіть місце зі списку."
      queryKey={["locations"]}
      fetchPage={getLocations}
      itemLabel={(location) => location.city}
      itemContext={locationContext}
      selected={selected}
      onSelect={onSelect}
      error={error}
      minSearchLength={2}
      rowHeight={128}
      desktopRowHeight={88}
    />
  );
}
