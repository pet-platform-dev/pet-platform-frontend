import { breederDirectoryKey } from "@/entities/breeder/directory";
import { invalidateBreederAnimals } from "../animals/cache";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import type { OwnBreeder } from "@/entities/breeder/owner-api";
import { ownBreederKey } from "@/entities/breeder/owner-api";
import { breederSchema } from "@/entities/breeder/model";
import type { Seller } from "@/entities/seller/model";
export async function updateBreederCache(
  client: QueryClient,
  userId: string,
  profile: OwnBreeder | null,
) {
  // Late mutations must not restore another account's private cache after logout/login.
  if (client.getQueryData<User | null>(["current-user"])?.id !== userId)
    return false;
  await client.cancelQueries({ queryKey: ownBreederKey(userId) });
  await Promise.all([
    client.cancelQueries({ queryKey: ["seller", userId] }),
    client.cancelQueries({ queryKey: ["breeder", userId] }),
  ]);
  if (client.getQueryData<User | null>(["current-user"])?.id !== userId)
    return false;
  client.setQueryData(ownBreederKey(userId), profile);
  const publicProfile = profile && !profile.publicationHeld ? profile : null;
  client.setQueryData(
    ["breeder", userId],
    publicProfile ? breederSchema.parse(publicProfile) : null,
  );
  const seller =
    profile?.contactPerson ?? client.getQueryData<Seller>(["seller", userId]);
  if (seller)
    client.setQueryData(["seller", userId], {
      ...seller,
      breeder: publicProfile ? { kennelName: publicProfile.kennelName } : null,
    });
  await client.invalidateQueries({ queryKey: breederDirectoryKey });
  await invalidateBreederAnimals(client, userId);
  if (!profile) {
    client.removeQueries({ queryKey: ["breeder-animals", userId] });
    await client.invalidateQueries({ queryKey: ["pet"] });
  }
  await client.invalidateQueries({
    predicate: (query) => {
      if (query.queryKey[0] === "seller-listings")
        return query.queryKey[1] === userId;
      if (!["listing", "owned-listing"].includes(String(query.queryKey[0])))
        return false;
      const data = query.state.data;
      return Boolean(
        data &&
        typeof data === "object" &&
        "seller" in data &&
        data.seller &&
        typeof data.seller === "object" &&
        "id" in data.seller &&
        data.seller.id === userId,
      );
    },
  });
  return client.getQueryData<User | null>(["current-user"])?.id === userId;
}
