"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { getSeller, getSellerListings } from "@/entities/seller/api";
import { SellerContacts } from "@/entities/seller/seller-card";
import { ListingCard } from "@/entities/listing/ui/listing-card";
import { listingDate } from "@/entities/listing/model/presentation";
import type { Seller } from "@/entities/seller/model";
export function SellerProfile({
  id,
  initialSeller,
}: {
  id: string;
  initialSeller?: Seller;
}) {
  const seller = useQuery({
    queryKey: ["seller", id],
    queryFn: ({ signal }) => getSeller(id, signal),
    initialData: initialSeller,
  });
  const listings = useInfiniteQuery({
    queryKey: ["seller-listings", id],
    queryFn: ({ pageParam, signal }) =>
      getSellerListings(id, pageParam, signal),
    initialPageParam: 1,
    enabled: seller.isSuccess,
    getNextPageParam: (page) =>
      page.meta.page < page.meta.pages ? page.meta.page + 1 : undefined,
  });
  if (seller.isPending)
    return <p role="status">Завантажуємо профіль продавця…</p>;
  if (seller.isError)
    return (
      <section>
        <h1>
          {seller.error instanceof ApiError && seller.error.status === 404
            ? "Продавця не знайдено"
            : "Не вдалося завантажити профіль"}
        </h1>
        {!(seller.error instanceof ApiError && seller.error.status === 404) && (
          <button
            className="button secondary"
            onClick={() => void seller.refetch()}
          >
            Спробувати ще раз
          </button>
        )}
      </section>
    );
  const profile = seller.data;
  return (
    <section className="seller-profile">
      <div className="listing-detail-panel">
        <h1>{profile.displayName}</h1>
        {profile.location && (
          <p>
            {profile.location.city}, {profile.location.region}
          </p>
        )}
        <p className="muted">
          На платформі з {listingDate(profile.memberSince)}
        </p>
        <SellerContacts
          key={profile.id + (profile.phone ?? "")}
          seller={profile}
        />
      </div>
      <h2>Оголошення продавця</h2>
      {listings.isPending ? (
        <p role="status">Завантажуємо оголошення…</p>
      ) : listings.isError ? (
        <div role="alert">
          <p>Не вдалося завантажити оголошення.</p>
          <button
            className="button secondary"
            onClick={() => void listings.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : listings.data?.pages.some((page) => page.data.length) ? (
        <div className="listings-grid">
          {listings.data.pages
            .flatMap((page) => page.data)
            .map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
        </div>
      ) : (
        <p>У продавця поки немає активних оголошень.</p>
      )}
      {listings.hasNextPage && (
        <button
          className="button secondary"
          disabled={listings.isFetchingNextPage}
          onClick={() => void listings.fetchNextPage()}
        >
          {listings.isFetchingNextPage ? "Завантажуємо…" : "Показати ще"}
        </button>
      )}
    </section>
  );
}
