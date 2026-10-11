import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import type { Seller } from "@/entities/seller/model";
import { refreshPersonalIdentity } from "@/features/auth/personal-profile-cache";

export async function updateContactCache(client: QueryClient, seller: Seller) {
  const current = () =>
    client.getQueryData<User | null>(["current-user"])?.id === seller.id;
  if (!current()) return false;
  await Promise.all(
    ["profile", "seller", "breeder", "own-breeder"].map((kind) =>
      client.cancelQueries({ queryKey: [kind, seller.id] }),
    ),
  );
  if (!current()) return false;
  client.setQueryData(["profile", seller.id], seller);
  client.setQueryData(["seller", seller.id], seller);
  return refreshPersonalIdentity(client, seller.id);
}
