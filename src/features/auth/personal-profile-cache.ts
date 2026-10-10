import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
export async function refreshPersonalIdentity(
  client: QueryClient,
  userId: string,
) {
  if (client.getQueryData<User>(["current-user"])?.id !== userId) return false;
  await client.invalidateQueries({
    predicate: (query) => {
      const [kind, id] = query.queryKey;
      if (
        ["seller", "breeder", "own-breeder", "seller-listings"].includes(
          String(kind),
        )
      )
        return id === userId;
      if (kind === "profile") return true;
      if (!["listing", "owned-listing"].includes(String(kind))) return false;
      const value = query.state.data;
      return Boolean(
        value &&
        typeof value === "object" &&
        "seller" in value &&
        value.seller &&
        typeof value.seller === "object" &&
        "id" in value.seller &&
        value.seller.id === userId,
      );
    },
  });
  return client.getQueryData<User>(["current-user"])?.id === userId;
}
