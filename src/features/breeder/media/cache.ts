import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { ownBreederKey, type OwnBreeder } from "@/entities/breeder/owner-api";
import { breederSchema } from "@/entities/breeder/model";
export async function updateBreederMediaCache(
  client: QueryClient,
  profile: OwnBreeder,
) {
  if (client.getQueryData<User | null>(["current-user"])?.id !== profile.userId)
    return false;
  await Promise.all([
    client.cancelQueries({ queryKey: ownBreederKey(profile.userId) }),
    client.cancelQueries({ queryKey: ["breeder", profile.userId] }),
  ]);
  if (client.getQueryData<User | null>(["current-user"])?.id !== profile.userId)
    return false;
  client.setQueryData(ownBreederKey(profile.userId), profile);
  client.setQueryData(
    ["breeder", profile.userId],
    breederSchema.parse(profile),
  );
  return true;
}
