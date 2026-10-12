"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicPet,
  publicPetKey,
  type PublicPet,
} from "@/entities/pet/public-profile";
import { ApiError } from "@/shared/api/client";
import { ListingDetailSkeleton } from "@/widgets/listing-details/listing-detail-skeleton";
import { ListingDetailError } from "@/widgets/listing-details/listing-detail-state";
import { PublicPetContent } from "./public-pet-content";
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function PublicPetProfile({
  id,
  initialData,
}: {
  id: string;
  initialData: PublicPet;
}) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientSnapshot,
    serverSnapshot,
  );
  const query = useQuery({
    queryKey: publicPetKey(id),
    queryFn: ({ signal }) => getPublicPet(id, signal),
    initialData,
    staleTime: 0,
  });
  if (query.isError)
    return (
      <main className="listing-detail-shell">
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <section className="listing-detail-panel">
            <h1>Профіль тварини не знайдено</h1>
            <p>Цей профіль недоступний.</p>
            <Link className="button secondary" href="/mating">
              До оголошень про в’язку
            </Link>
          </section>
        ) : (
          <ListingDetailError
            retry={() => void query.refetch()}
            pending={query.isFetching}
          />
        )}
      </main>
    );
  // The route already checked public visibility. Preserve that fresh DTO in SSR
  // and hydration, then suppress cached actions while the client revalidates.
  if (!hydrated) return <PublicPetContent pet={initialData} />;
  if (query.isPending || query.isFetching)
    return (
      <main className="listing-detail-shell">
        <ListingDetailSkeleton />
      </main>
    );
  return <PublicPetContent pet={query.data} />;
}
