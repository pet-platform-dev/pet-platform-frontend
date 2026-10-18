"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getSpecies } from "@/features/pet/api";
import { publicRequest } from "@/shared/api/client";
import type { Breed } from "@/entities/breed/model";
import type { Location } from "@/entities/location/model";
import {
  changeDirectorySpecies,
  directoryHref,
  parseDirectoryQuery,
  type DirectoryQuery,
} from "@/entities/breeder/directory-query";

type References = {
  breed: Pick<Breed, "id" | "name" | "nameUk" | "speciesId"> | null;
  location: Location | null;
};
export function useDirectoryFilters(initial: DirectoryQuery) {
  const params = useSearchParams();
  const query = params ? parseDirectoryQuery(params) : initial;
  const href = directoryHref(query);
  const raw = params?.toString();
  const [edit, setEdit] = useState({ base: href, value: query.q ?? "" });
  if (edit.base !== href) setEdit({ base: href, value: query.q ?? "" });
  const search = edit.base === href ? edit.value : (query.q ?? "");
  const species = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
    staleTime: 60_000,
  });
  const references = useQuery({
    queryKey: [
      "breeder-filter-references",
      query.breedId ?? "",
      query.locationId ?? "",
    ],
    queryFn: ({ signal }) =>
      publicRequest<References>(
        `/breeders/filters?${new URLSearchParams({ ...(query.breedId ? { breedId: query.breedId } : {}), ...(query.locationId ? { locationId: query.locationId } : {}) })}`,
        false,
        { signal },
      ),
    enabled: Boolean(query.breedId || query.locationId),
    staleTime: 60_000,
  });
  const navigate = useCallback(
    (next: DirectoryQuery, mode: "push" | "replace" = "push") => {
      const target = directoryHref(next);
      if (window.location.pathname + window.location.search !== target)
        window.history[mode === "push" ? "pushState" : "replaceState"](
          null,
          "",
          target,
        );
    },
    [],
  );
  useEffect(() => {
    if (raw !== undefined && (raw ? "/breeders?" + raw : "/breeders") !== href)
      window.history.replaceState(null, "", href);
  }, [href, raw]);
  useEffect(() => {
    if (search.trim() === (query.q ?? "")) return;
    const timer = setTimeout(
      () =>
        navigate(
          { ...query, q: search.trim() || undefined, page: 1 },
          "replace",
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, query, navigate]);
  const current = () => ({ ...query, q: search.trim() || undefined, page: 1 });
  return {
    query,
    search,
    species,
    references,
    setSearch: (value: string) => setEdit({ base: href, value }),
    setSpecies: (value: DirectoryQuery["species"]) => {
      const selectedSpecies = species.data?.find(
        (s) => s.id === references.data?.breed?.speciesId,
      )?.slug;
      navigate(
        changeDirectorySpecies(current(), value, selectedSpecies === value),
      );
    },
    setBreed: (breedId?: string) => navigate({ ...current(), breedId }),
    setLocation: (locationId?: string) =>
      navigate({ ...current(), locationId }),
    reset: () => {
      setEdit({ base: href, value: "" });
      navigate({ page: 1 });
    },
  };
}
