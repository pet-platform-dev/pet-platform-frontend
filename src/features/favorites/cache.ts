import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Listing } from "@/entities/listing/model/listing";
import type { Paginated } from "@/shared/api/pagination";
import type { User } from "@/entities/user/model";
export const favoriteStateKey = (userId: string, id: string) =>
  ["favorite-state", userId, id] as const;
export const favoritePagesKey = (userId: string) =>
  ["favorites", userId] as const;
export const favoriteBatchKey = (userId: string) =>
  ["favorite-batch", userId] as const;
const locks = new WeakMap<QueryClient, Set<string>>();
export function lockFavorite(client: QueryClient, userId: string, id: string) {
  let set = locks.get(client);
  if (!set) {
    set = new Set();
    locks.set(client, set);
  }
  const key = userId + ":" + id;
  if (set.has(key)) return false;
  set.add(key);
  return true;
}
export function unlockFavorite(
  client: QueryClient,
  userId: string,
  id: string,
) {
  locks.get(client)?.delete(userId + ":" + id);
}
export function favoriteLocked(
  client: QueryClient,
  userId: string,
  id: string,
) {
  return locks.get(client)?.has(userId + ":" + id) ?? false;
}
export function favoriteOwnerCurrent(client: QueryClient, userId: string) {
  return client.getQueryData<User | null>(["current-user"])?.id === userId;
}
type RemovedRow = { key: QueryKey; item: Listing; index: number };
export function optimisticFavorite(
  client: QueryClient,
  userId: string,
  id: string,
  active: boolean,
) {
  const previous = client.getQueryData<boolean>(favoriteStateKey(userId, id));
  const removed: RemovedRow[] = [];
  if (!favoriteOwnerCurrent(client, userId)) return { previous, removed };
  client.setQueryData(favoriteStateKey(userId, id), active);
  if (!active)
    for (const [key, page] of client.getQueriesData<Paginated<Listing>>({
      queryKey: favoritePagesKey(userId),
    })) {
      if (!page) continue;
      const index = page.data.findIndex((item) => item.id === id);
      if (index >= 0) {
        removed.push({ key, item: page.data[index], index });
        const total = Math.max(0, page.meta.total - 1);
        client.setQueryData(key, {
          data: page.data.filter((item) => item.id !== id),
          meta: {
            ...page.meta,
            total,
            pages: Math.ceil(total / page.meta.limit),
          },
        });
      }
    }
  return { previous, removed };
}
export function rollbackFavorite(
  client: QueryClient,
  userId: string,
  id: string,
  snapshot: ReturnType<typeof optimisticFavorite>,
) {
  if (!favoriteOwnerCurrent(client, userId)) return;
  client.setQueryData(favoriteStateKey(userId, id), snapshot.previous);
  for (const row of snapshot.removed)
    client.setQueryData<Paginated<Listing>>(row.key, (page) => {
      if (!page || page.data.some((item) => item.id === id)) return page;
      const data = [...page.data];
      data.splice(Math.min(row.index, data.length), 0, row.item);
      const total = page.meta.total + 1;
      return {
        data,
        meta: {
          ...page.meta,
          total,
          pages: Math.ceil(total / page.meta.limit),
        },
      };
    });
}
