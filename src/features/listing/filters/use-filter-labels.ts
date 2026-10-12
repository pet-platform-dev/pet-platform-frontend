"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Listing } from "@/entities/listing/model/listing";
import { getRegions } from "@/entities/location/regions";
import type { FilterUpdate } from "./model";
import type { FilterLabels } from "./filter-url-state";
const labelKey = ["catalog-reference-labels"] as const;
const emptyLabels = (): FilterLabels => ({
  breeds: {},
  regions: {},
  locations: {},
});
export function useFilterLabels(regionIds?: string[]) {
  const client = useQueryClient();
  const cache = useQuery({
    queryKey: labelKey,
    queryFn: emptyLabels,
    initialData: emptyLabels,
    enabled: false,
  });
  const regions = useQuery({
    queryKey: ["regions"],
    queryFn: getRegions,
    enabled: Boolean(regionIds?.length),
    staleTime: 60_000,
  });
  const labels = {
    ...cache.data,
    regions: {
      ...cache.data.regions,
      ...Object.fromEntries(
        (regions.data ?? []).map((item) => [item.id, item]),
      ),
    },
  };
  function remember(update: FilterUpdate) {
    if (
      update.field !== "breeds" &&
      update.field !== "regions" &&
      update.field !== "locations"
    )
      return;
    client.setQueryData<FilterLabels>(labelKey, (old) => {
      const current = old ?? emptyLabels();
      return {
        ...current,
        [update.field]: {
          ...current[update.field],
          ...Object.fromEntries(update.value.map((item) => [item.id, item])),
        },
      };
    });
  }
  return { labels, remember };
}
export function useCatalogLabels(
  listings?: {
    pet: Listing["pet"];
    location: Pick<
      Listing["location"],
      "id" | "countryCode" | "region" | "city"
    >;
  }[],
) {
  const client = useQueryClient();
  useEffect(() => {
    if (!listings?.length) return;
    client.setQueryData<FilterLabels>(labelKey, (old) => {
      const labels = old ?? emptyLabels(),
        breeds = { ...labels.breeds },
        locations = { ...labels.locations };
      for (const item of listings) {
        const breed = item.pet.breed,
          species = item.pet.species.slug;
        if (
          breed &&
          !breeds[breed.id] &&
          (species === "dog" || species === "cat")
        )
          breeds[breed.id] = { ...breed, species };
        if (!locations[item.location.id])
          locations[item.location.id] = {
            ...item.location,
            district: null,
            community: null,
            settlementType: null,
            katottgCode: null,
          };
      }
      return { ...labels, breeds, locations };
    });
  }, [client, listings]);
}
