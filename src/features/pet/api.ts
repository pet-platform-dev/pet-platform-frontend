import { authenticatedRequest, publicRequest } from "@/shared/api/client";
import type { Paginated } from "@/shared/api/pagination";
import type { Species } from "@/entities/species/model";
import type { Breed } from "@/entities/breed/model";
import type { Pet, PetInput } from "@/entities/pet/model";
export const getSpecies = () => publicRequest<Species[]>("/species");
export const getBreeds = (
  species: string | undefined,
  search: string,
  page: number,
) =>
  publicRequest<Paginated<Breed>>(
    `/breeds?${new URLSearchParams({ ...(species ? { species } : {}), search, page: String(page), limit: "50", sort: "name_asc" })}`,
    true,
  );
export const getPets = (page: number) =>
  authenticatedRequest<Paginated<Pet>>(
    `/pets/me?page=${page}&limit=24`,
    {},
    true,
  );
export const getPet = (id: string) =>
  authenticatedRequest<Pet>(`/pets/${encodeURIComponent(id)}`);
export const savePet = (input: PetInput, id?: string) =>
  authenticatedRequest<Pet>(id ? `/pets/${encodeURIComponent(id)}` : "/pets", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(input),
  });
export const deletePet = (id: string) =>
  authenticatedRequest<void>(`/pets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
