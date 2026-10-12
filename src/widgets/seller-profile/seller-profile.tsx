"use client";
import { PublicBreederAnimals } from "@/features/breeder/animals/public-breeder-animals";
import { SellerReviews } from "@/features/reviews/seller-reviews";
import { BreederCreatedNotice } from "@/features/breeder/editor/breeder-created-notice";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { getSeller } from "@/entities/seller/api";
import type { Seller } from "@/entities/seller/model";
import { getBreeder } from "@/entities/breeder/api";
import type { Breeder } from "@/entities/breeder/model";
import { BreederProfilePage } from "@/features/breeder/public-profile/breeder-profile-page";
import { BreederProfileSkeleton } from "@/features/breeder/public-profile/breeder-profile-skeleton";
import { SellerProfileHeader } from "./seller-profile-header";
import { SellerProfileListings } from "./seller-profile-listings";
import { ProfileError } from "./profile-error";
import { PublicProfileMating } from "@/features/mating/profile/public-profile-mating";
export function SellerProfile({
  id,
  initialSeller,
  initialBreeder,
}: {
  id: string;
  initialSeller?: Seller;
  initialBreeder?: Breeder | null;
}) {
  const seller = useQuery({
    queryKey: ["seller", id],
    queryFn: ({ signal }) => getSeller(id, signal),
    initialData: initialSeller,
    staleTime: 30_000,
  });
  const breeder = useQuery({
    queryKey: ["breeder", id],
    queryFn: async ({ signal }) => {
      try {
        return await getBreeder(id, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: Boolean(seller.data?.breeder),
    initialData: initialBreeder,
    staleTime: 30_000,
  });
  if (seller.isPending || (seller.data?.breeder && breeder.isPending))
    return <BreederProfileSkeleton />;
  if (seller.isError)
    return (
      <ProfileError error={seller.error} retry={() => void seller.refetch()} />
    );
  if (seller.data.breeder && breeder.isError)
    return (
      <ProfileError
        error={breeder.error}
        retry={() => void breeder.refetch()}
      />
    );
  const profile =
    seller.data.breeder && breeder.data
      ? { ...breeder.data, contactPerson: seller.data }
      : null;
  return (
    <section className="seller-profile">
      <BreederCreatedNotice userId={id} />
      {profile ? (
        <>
          <BreederProfilePage profile={profile} />
          <PublicBreederAnimals key={id} userId={id} />
        </>
      ) : (
        <SellerProfileHeader profile={seller.data} />
      )}
      <SellerProfileListings id={id} breeder={Boolean(profile)} />
      <PublicProfileMating key={`mating-${id}`} ownerId={id} />
      <SellerReviews
        key={id}
        targetId={id}
        initialSummary={profile?.reviewSummary ?? seller.data.reviewSummary}
      />
    </section>
  );
}
