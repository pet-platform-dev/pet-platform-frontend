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

export const sessionKey = ["current-user"] as const;
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
      clearSession();
      client.removeQueries({ queryKey: ["my-pets"] });
      client.removeQueries({ queryKey: ["pet"] });
      void client.cancelQueries();
      if (event.data === "logout") {
        client.setQueryData(sessionKey, null);
      } else {
        void client.resetQueries({ queryKey: sessionKey });
      }
    };
    const expire = () => {
      void client.cancelQueries();
      client.removeQueries({ queryKey: ["my-pets"] });
      client.removeQueries({ queryKey: ["pet"] });
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
  channel.postMessage(kind);
  channel.close();
}
export function useSession() {
  return useQuery<User | null>({ queryKey: sessionKey, queryFn: currentUser });
}
export function useLogout() {
  const client = useQueryClient();
  return async () => {
    await signOut();
    client.clear();
    client.setQueryData(sessionKey, null);
    notifySessionChange("logout");
  };
}
