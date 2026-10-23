"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@/entities/user/model";
import { clearSession, currentUser, signOut } from "@/shared/api/client";
import { clearFormRecovery } from "@/features/listing/form-recovery";
import { refreshPersonalIdentity } from "./personal-profile-cache";
import { refreshReviewPublicCache } from "@/features/reviews/cache";
import { removeAdminMutations } from "@/shared/lib/admin-cache-privacy";
import { currentSessionGeneration } from "@/shared/api/client";
import { refreshVerificationSession } from "./email-verification/session-sync";

export const sessionKey = ["current-user"] as const;
const sessionSource = crypto.randomUUID();
export function isSessionQuery({ queryKey }: { queryKey: readonly unknown[] }) {
  return [
    "current-user",
    "notifications",
    "conversations",
    "admin-moderation",
    "admin-access",
    "report-sent",
    "mating-mine",
    "mating-owned",
    "mating-active",
    "my-pets",
    "pet",
    "pet-care",
    "pet-media",
    "my-listings",
    "owned-listing",
    "profile",
    "own-breeder",
    "breeder-animals",
    "breeder-notice",
    "favorites",
    "favorite-state",
    "favorite-batch",
    "seller-review-me",
  ].includes(String(queryKey[0]));
}
export function clearPrivateQueries(client: QueryClient) {
  removeAdminMutations(client);
  const mutations = client.getMutationCache();
  for (const mutation of mutations.getAll())
    if (
      [
        "user-reports",
        "notifications",
        "conversations",
        "pet-care",
        "favorite-toggle",
      ].includes(String(mutation.options.mutationKey?.[0]))
    )
      mutations.remove(mutation);
  // Cancel before removal so an in-flight private response cannot repopulate the cache.
  void client.cancelQueries({ predicate: isSessionQuery });
  client.removeQueries({
    predicate: (query) =>
      isSessionQuery(query) && query.queryKey[0] !== "current-user",
  });
}
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
      }),
  );
  useEffect(() => {
    const channel = new BroadcastChannel("pet-platform-session");
    channel.onmessage = (event) => {
      if (event.data?.source === sessionSource) return;
      const kind =
        typeof event.data === "string" ? event.data : event.data?.kind;
      if (kind === "favorites") {
        const user = client.getQueryData<User>(sessionKey);
        if (user && user.id === event.data?.userId) {
          void client.invalidateQueries({ queryKey: ["favorites", user.id] });
          void client.invalidateQueries({
            queryKey: ["favorite-batch", user.id],
          });
        }
        return;
      }
      if (kind === "email-verification") {
        void refreshVerificationSession(
          client,
          currentSessionGeneration(),
        ).catch(() => {});
        return;
      }
      if (kind === "reviews") {
        const user = client.getQueryData<User>(sessionKey);
        if (user && user.id === event.data?.userId)
          void client.invalidateQueries({
            queryKey: ["seller-review-me", user.id],
          });
        return;
      }
      if (kind === "review-management") {
        const user = client.getQueryData<User>(sessionKey);
        if (
          user &&
          user.id === event.data?.userId &&
          typeof event.data?.targetId === "string" &&
          /^[0-9a-f-]{36}$/i.test(event.data.targetId)
        ) {
          void client.invalidateQueries({
            queryKey: ["seller-review-me", user.id, event.data.targetId],
          });
          void refreshReviewPublicCache(client, event.data.targetId);
        }
        return;
      }
      if (kind === "account-type" || kind === "profile") {
        if (kind === "profile") {
          const user = client.getQueryData<User>(sessionKey);
          if (user) void refreshPersonalIdentity(client, user.id);
        }
        void client.resetQueries({ queryKey: sessionKey });
        return;
      }
      if (kind !== "login" && kind !== "logout") return;
      clearSession();
      clearPrivateQueries(client);
      if (kind === "logout") {
        clearFormRecovery();
        client.setQueryData(sessionKey, null);
      } else {
        clearFormRecovery();
        void client.resetQueries({ queryKey: sessionKey });
      }
    };
    const expire = () => {
      clearPrivateQueries(client);
      client.setQueryData(sessionKey, null);
    };
    window.addEventListener("pet-platform-session-expired", expire);
    return () => {
      channel.close();
      window.removeEventListener("pet-platform-session-expired", expire);
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function notifySessionChange(
  kind:
    | "login"
    | "logout"
    | "account-type"
    | "profile"
    | "favorites"
    | "reviews"
    | "review-management"
    | "email-verification" = "login",
  userId?: string,
  targetId?: string,
) {
  const channel = new BroadcastChannel("pet-platform-session");
  channel.postMessage({
    kind,
    source: sessionSource,
    ...(userId ? { userId } : {}),
    ...(targetId ? { targetId } : {}),
  });
  channel.close();
}
export function useSession() {
  return useQuery<User | null>({ queryKey: sessionKey, queryFn: currentUser });
}
export function useLogout() {
  const client = useQueryClient();
  return async () => {
    await signOut();
    clearFormRecovery();
    clearPrivateQueries(client);
    client.setQueryData(sessionKey, null);
    notifySessionChange("logout");
  };
}
