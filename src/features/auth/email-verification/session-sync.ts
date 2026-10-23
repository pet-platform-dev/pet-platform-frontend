import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { currentSessionGeneration } from "@/shared/api/client";

/** Re-read this browser's account only; confirmation never supplies an identity to cache. */
export async function refreshVerificationSession(
  client: QueryClient,
  generation: number,
) {
  if (
    generation !== currentSessionGeneration() ||
    !client.getQueryData<User | null>(["current-user"])
  )
    return;
  await client.cancelQueries({ queryKey: ["current-user"] });
  if (generation !== currentSessionGeneration()) return;
  await client.invalidateQueries({ queryKey: ["current-user"] });
}
