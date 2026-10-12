import type { QueryClient } from "@tanstack/react-query";
import { sessionKey } from "@/features/auth/session-provider";
import type { User } from "@/entities/user/model";
import type { OwnMating } from "@/entities/mating-listing/model";
import { publicPetKey } from "@/entities/pet/query-keys";
export const matingKeys = {
  publicSeller: (ownerId: string, page: number) =>
    ["mating-public", "seller", ownerId, page] as const,
  publicDetail: (id: string) => ["mating-public", "detail", id] as const,
  mine: (userId: string) => ["mating-mine", userId] as const,
  detail: (userId: string, id: string) => ["mating-owned", userId, id] as const,
  active: (userId: string) => ["mating-active", userId] as const,
};
export function currentMatingUser(client: QueryClient, userId: string) {
  return client.getQueryData<User>(sessionKey)?.id === userId;
}
export async function refreshMating(
  client: QueryClient,
  userId: string,
  id?: string,
  row?: OwnMating | null,
  affectedPetId?: string,
) {
  if (!currentMatingUser(client, userId)) return;
  if (id && row) client.setQueryData(matingKeys.detail(userId, id), row);
  if (id && row === null)
    client.removeQueries({ queryKey: matingKeys.detail(userId, id) });
  const petId = affectedPetId ?? row?.pet?.id;
  await Promise.all([
    client.invalidateQueries({ queryKey: ["my-pets", userId] }),
    client.invalidateQueries({ queryKey: ["breeder-animals", userId] }),
    ...(petId
      ? [client.invalidateQueries({ queryKey: publicPetKey(petId) })]
      : []),
    client.invalidateQueries({ queryKey: ["mating-public"] }),
    client.invalidateQueries({ queryKey: matingKeys.mine(userId) }),
    client.invalidateQueries({ queryKey: matingKeys.active(userId) }),
    ...(id && row !== null
      ? [client.invalidateQueries({ queryKey: matingKeys.detail(userId, id) })]
      : []),
  ]);
}
