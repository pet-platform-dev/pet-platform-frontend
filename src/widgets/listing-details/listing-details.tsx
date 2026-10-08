"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getListing } from "@/entities/listing/api/get-listing";
import type { Listing } from "@/entities/listing/model/listing";
import { ApiError } from "@/shared/api/client";
import { ListingDetailContent } from "./listing-detail-content";
import { ListingDetailSkeleton } from "./listing-detail-skeleton";
import { ListingDetailError, ListingUnavailable } from "./listing-detail-state";

export function ListingDetails({
  id,
  initialListing,
  initialFailed = false,
}: {
  id: string;
  initialListing?: Listing;
  initialFailed?: boolean;
}) {
  const query = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id),
    initialData: initialListing,
    enabled: !initialFailed,
    retry: false,
  });
  const failed =
    query.isError || (initialFailed && query.isPending && !query.isFetching);
  return (
    <main className="listing-detail-shell">
      <Link href="/listings" className="text-link listing-back-link">
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
      ) : query.isPending ? (
        <ListingDetailSkeleton />
      ) : (
        <ListingDetailContent listing={query.data} />
      )}
    </main>
  );
}
