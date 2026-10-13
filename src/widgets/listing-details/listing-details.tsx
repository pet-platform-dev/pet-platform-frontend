"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getListing } from "@/entities/listing/api/get-listing";
import type { Listing } from "@/entities/listing/model/listing";
import { ApiError } from "@/shared/api/client";
import { ListingDetailContent } from "./listing-detail-content";
import { ListingDetailSkeleton } from "./listing-detail-skeleton";
import { ListingDetailError, ListingUnavailable } from "./listing-detail-state";
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ListingDetails({
  id,
  initialListing,
  initialFailed = false,
  returnHref = "/listings",
}: {
  id: string;
  initialListing?: Listing;
  initialFailed?: boolean;
  returnHref?: string;
}) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const query = useQuery({
    queryKey: ["listing", id],
    queryFn: ({ signal }) => getListing(id, signal),
    initialData: initialListing,
    enabled: !initialFailed,
    retry: false,
    staleTime: 0,
  });
  const failed =
    query.isError ||
    (initialFailed && !query.isFetchedAfterMount && !query.isFetching);
  // Fresh route truth wins during SSR/hydration; refetch conceals older cached DTOs.
  const serverData = !hydrated && !failed ? initialListing : undefined;
  const listing = serverData ?? query.data;
  return (
    <main className="listing-detail-shell">
      <Link href={returnHref} className="text-link listing-back-link">
        ← До оголошень
      </Link>
      {failed ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <ListingUnavailable />
        ) : (
          <ListingDetailError
            retry={() => {
              void query.refetch();
            }}
            pending={query.isFetching}
          />
        )
      ) : !listing || (!serverData && (query.isPending || query.isFetching)) ? (
        <ListingDetailSkeleton />
      ) : (
        <ListingDetailContent listing={listing} />
      )}
    </main>
  );
}
