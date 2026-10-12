import type { QueryClient } from "@tanstack/react-query";
import { sessionKey } from "@/features/auth/session-provider";
import type { User } from "@/entities/user/model";
// Pet classification/profile-image edits can requeue associated advertisements.
export async function refreshPetPublications(
  client: QueryClient,
  userId: string,
  petId: string,
) {
  if (client.getQueryData<User | null>(sessionKey)?.id !== userId) return;
  await Promise.all(
    [
      "my-listings",
      "listings",
      "listing",
      "owned-listing",
      "seller-listings",
      "favorites",
      "favorite-state",
      "favorite-batch",
      "mating-public",
      "mating-mine",
      "mating-owned",
      "mating-active",
    ].map((key) => client.invalidateQueries({ queryKey: [key] })),
  );
  await client.invalidateQueries({ queryKey: ["public-pet", petId] });
}
