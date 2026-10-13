import type { QueryClient } from "@tanstack/react-query";
export function removeAdminMutations(client: QueryClient) {
  const cache = client.getMutationCache();
  for (const mutation of cache.getAll())
    if (mutation.options.mutationKey?.[0] === "admin-moderation")
      cache.remove(mutation);
}
