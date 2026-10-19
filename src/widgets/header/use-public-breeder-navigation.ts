"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Seller } from "@/entities/seller/model";
import type { Breeder } from "@/entities/breeder/model";

export function cachedPublicBreeder(client: QueryClient, pathname: string) {
  const id = /^\/sellers\/([^/]+)$/.exec(pathname)?.[1];
  if (!id) return false;
  const seller = client.getQueryState<Seller>(["seller", id]);
  const breeder = client.getQueryState<Breeder | null>(["breeder", id]);
  return (
    seller?.status === "success" &&
    breeder?.status === "success" &&
    Boolean(seller.data?.breeder && breeder.data?.userId === id)
  );
}
// Observe existing public profile state. Do not create an early query that
// would displace the detail page's SSR initialData, or fetch from the header.
export function usePublicBreederNavigation(pathname: string) {
  const client = useQueryClient();
  const subscribe = useCallback(
    (notify: () => void) => client.getQueryCache().subscribe(notify),
    [client],
  );
  const snapshot = useCallback(
    () => cachedPublicBreeder(client, pathname),
    [client, pathname],
  );
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
