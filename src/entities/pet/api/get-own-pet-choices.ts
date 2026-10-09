import { authenticatedRequest } from "@/shared/api/client";
import type { Paginated } from "@/shared/api/pagination";
import type { Pet } from "../model";
export async function getOwnPetChoices(signal?: AbortSignal): Promise<Pet[]> {
  const pets: Pet[] = [];
  let page = 1;
  while (true) {
    const result = await authenticatedRequest<Paginated<Pet>>(
      `/pets/me?page=${page}&limit=100`,
      { signal },
      true,
    );
    pets.push(...result.data);
    if (page >= result.meta.pages) return pets;
    page++;
  }
}
