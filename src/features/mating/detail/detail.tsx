"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { matingKeys } from "../cache";
import { ApiError } from "@/shared/api/client";
import { ListingDetailSkeleton } from "@/widgets/listing-details/listing-detail-skeleton";
import {
  ListingDetailError,
  ListingUnavailable,
} from "@/widgets/listing-details/listing-detail-state";
import { getMatingDetailData, type MatingDetailData } from "./data";
import { MatingDetailContent } from "./content";
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function MatingDetail({
  id,
  initialData,
  initialFailed = false,
  returnHref = "/mating",
  returnLabel = "До оголошень про в’язку",
}: {
  id: string;
  initialData?: MatingDetailData;
  initialFailed?: boolean;
  returnHref?: string;
  returnLabel?: string;
}) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const { data: user, isPending: sessionPending } = useSession();
  const query = useQuery({
    queryKey: matingKeys.publicDetail(id),
    queryFn: ({ signal }) => getMatingDetailData(id, signal),
    initialData,
    enabled: !initialFailed,
    retry: false,
    staleTime: 0,
  });
  const failed =
    query.isError ||
    (initialFailed && !query.isFetchedAfterMount && !query.isFetching);
  // Preserve the route's freshly checked public DTO during SSR/hydration.
  // Client refetch still conceals cached content and actions until settled.
  const serverData = !hydrated && !failed ? initialData : undefined;
  const detail = serverData ?? query.data;
  return (
    <main className="listing-detail-shell mating-detail">
      <Link href={returnHref} className="text-link listing-back-link">
        ← {returnLabel}
      </Link>
      {failed ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <ListingUnavailable
            catalogHref="/mating"
            catalogLabel="До оголошень про в’язку"
          />
        ) : (
          <ListingDetailError
            retry={() => {
              void query.refetch();
            }}
            pending={query.isFetching}
          />
        )
      ) : !detail || (!serverData && (query.isPending || query.isFetching)) ? (
        <ListingDetailSkeleton />
      ) : (
        <MatingDetailContent
          detail={detail}
          isOwner={user?.id === detail.row.owner.id}
          contactsReady={hydrated && !sessionPending}
        />
      )}
    </main>
  );
}
