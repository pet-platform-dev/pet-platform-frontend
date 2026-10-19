import type { Breed } from "@/entities/breed/model";
import type { Location } from "@/entities/location/model";
import type { Species } from "@/entities/species/model";
import type { DirectoryQuery } from "@/entities/breeder/directory-query";

export type DirectoryReferences = {
  breed: Pick<Breed, "id" | "name" | "nameUk" | "speciesId"> | null;
  location: Location | null;
};

// Only confirmed public lookups may remove stale/invalid filter IDs. Pending or
// failed lookups preserve the URL so a network error cannot silently clear it.
export function resolveDirectoryReferences(
  query: DirectoryQuery,
  references: DirectoryReferences | undefined,
  species: Species[] | undefined,
): DirectoryQuery {
  if (!references) return query;
  const breed = references.breed;
  const incompatible =
    query.species &&
    species &&
    breed &&
    species.find((item) => item.id === breed.speciesId)?.slug !== query.species;
  const breedId =
    query.breedId && (breed?.id !== query.breedId || incompatible)
      ? undefined
      : query.breedId;
  const locationId =
    query.locationId && references.location?.id !== query.locationId
      ? undefined
      : query.locationId;
  return breedId === query.breedId && locationId === query.locationId
    ? query
    : { ...query, breedId, locationId, page: 1 };
}
