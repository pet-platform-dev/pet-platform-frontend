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

export const sessionKey = ["current-user"] as const;
const sessionSource = crypto.randomUUID();
export function isSessionQuery({ queryKey }: { queryKey: readonly unknown[] }) {
  return [
    "current-user",
    "my-pets",
    "pet",
    "my-listings",
    "owned-listing",
  ].includes(String(queryKey[0]));
}
export function clearPrivateQueries(client: QueryClient) {
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
export function notifySessionChange(kind: "login" | "logout" = "login") {
  const channel = new BroadcastChannel("pet-platform-session");
  channel.postMessage({ kind, source: sessionSource });
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
