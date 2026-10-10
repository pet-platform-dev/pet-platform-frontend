"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getSellerListings } from "@/entities/seller/api";
import { ListingCard } from "@/entities/listing/ui/listing-card";
export function SellerProfileListings({
  id,
  breeder,
}: {
  id: string;
  breeder: boolean;
}) {
  const listings = useInfiniteQuery({
    queryKey: ["seller-listings", id],
    queryFn: ({ pageParam, signal }) =>
      getSellerListings(id, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.meta.page < page.meta.pages ? page.meta.page + 1 : undefined,
  });
  return (
    <section
      className="seller-profile-listings"
      aria-labelledby="profile-listings"
    >
      <h2 id="profile-listings">
        {breeder ? "Оголошення розплідника" : "Оголошення продавця"}
      </h2>
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
              <ListingCard
                key={listing.id}
                listing={listing}
                headingLevel={3}
              />
            ))}
        </div>
      ) : (
        <p>
          {breeder
            ? "У цього розплідника поки немає активних оголошень."
            : "У продавця поки немає активних оголошень."}
        </p>
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
