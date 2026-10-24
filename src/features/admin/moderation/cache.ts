import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { sessionKey } from "@/features/auth/session-provider";
import {
  refreshReviewPublicCache,
  ownReviewKey,
} from "@/features/reviews/cache";
import { invalidateListings } from "@/features/listing/manage-listing/api";
import { refreshMating } from "@/features/mating/cache";
import { ApiError } from "@/shared/api/client";
import { publicAnimalsKey } from "@/entities/breeder/animals";
import { removeAdminMutations } from "@/shared/lib/admin-cache-privacy";
import {
  detailSchema,
  type ContentType,
  type ModerationDetail,
  type ModerationResult,
} from "./model";
import type { QueueState } from "./navigation";
export const adminModerationKeys = {
  root: ["admin-moderation"] as const,
  queue: (userId: string, state?: QueueState) =>
    state
      ? (["admin-moderation", userId, "queue", state] as const)
      : (["admin-moderation", userId, "queue"] as const),
  detail: (userId: string, type: ContentType, id: string) =>
    ["admin-moderation", userId, "detail", type, id] as const,
  access: (userId: string) => ["admin-access", userId] as const,
};
export function currentAdmin(client: QueryClient, userId: string) {
  const user = client.getQueryData<User | null>(sessionKey);
  return (
    user?.id === userId &&
    user.role === "ADMIN" &&
    client.getQueryData<boolean>(adminModerationKeys.access(userId)) !== true
  );
}
export function clearAdminQueries(client: QueryClient) {
  removeAdminMutations(client);
  void client.cancelQueries({ queryKey: adminModerationKeys.root });
  client.removeQueries({ queryKey: adminModerationKeys.root });
  void client.cancelQueries({ queryKey: ["admin-dashboard"] });
  client.removeQueries({ queryKey: ["admin-dashboard"] });
}
export function loseAdminAccess(client: QueryClient, userId: string) {
  if (client.getQueryData<User | null>(sessionKey)?.id !== userId) return;
  client.setQueryData(adminModerationKeys.access(userId), true);
  clearAdminQueries(client);
  void client.invalidateQueries({ queryKey: sessionKey });
}
export async function runAdminRequest<T>(
  client: QueryClient,
  userId: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!currentAdmin(client, userId))
    throw new DOMException("Admin session changed", "AbortError");
  try {
    const data = await work();
    if (!currentAdmin(client, userId))
      throw new DOMException("Admin session changed", "AbortError");
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403)
      loseAdminAccess(client, userId);
    throw error;
  }
}
export async function refreshAfterModeration(
  client: QueryClient,
  userId: string,
  result: ModerationResult,
) {
  if (!currentAdmin(client, userId)) return;
  const key = adminModerationKeys.detail(userId, result.type, result.id);
  client.setQueryData<ModerationDetail>(key, (old) =>
    old && old.type === result.type
      ? detailSchema.parse({
          ...old,
          ...result,
          submittedAt: result.updatedAt,
          moderationStatus:
            result.type === "REVIEW" ? result.status : result.moderationStatus,
        })
      : old,
  );
  const work = [
    client.invalidateQueries({ queryKey: adminModerationKeys.queue(userId) }),
  ];
  if (result.type !== "REVIEW")
    work.push(
      client.invalidateQueries({ queryKey: publicAnimalsKey(result.ownerId) }),
    );
  if (result.type === "LISTING")
    work.push(
      invalidateListings(client, result.id),
      client.invalidateQueries({ queryKey: ["seller", result.ownerId] }),
    );
  else if (result.type === "MATING_LISTING")
    work.push(
      refreshMating(client, userId, undefined, undefined, result.petId),
      client.invalidateQueries({
        queryKey: ["mating-owned", result.ownerId, result.id],
      }),
      client.invalidateQueries({ queryKey: ["seller", result.ownerId] }),
    );
  else
    work.push(
      refreshReviewPublicCache(
        client,
        result.targetUserId,
        result.status === "HIDDEN" ? result.id : undefined,
      ),
      client.invalidateQueries({
        queryKey: ownReviewKey(userId, result.targetUserId),
      }),
    );
  await Promise.all(work);
}
