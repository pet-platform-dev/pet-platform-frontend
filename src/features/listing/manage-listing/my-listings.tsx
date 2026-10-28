"use client";
import { PublicationState } from "@/shared/ui/publication-state";
import {
  isPublicPublication,
  canSubmitPublication,
} from "@/shared/lib/moderation";
import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import {
  listingHeading,
  listingPrice,
  listingLocation,
  listingDate,
  listingTypeLabels,
  listingGender,
} from "@/entities/listing/model/presentation";
import { ListingPlaceholder } from "@/entities/listing/ui/listing-placeholder";
import { ListingImage } from "@/entities/listing/ui/listing-image";
import { getOwnListings } from "./api";
import { PreparedNotice } from "@/features/breeder/handoff/prepared-notice";
import { ListingActions } from "./listing-actions";
import { ListingManagementSkeleton } from "./listing-management-skeleton";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import {
  statusGroups,
  editable,
  type StatusGroup,
  type OwnListing,
} from "./model";
export function OwnerListingCard({ listing }: { listing: OwnListing }) {
  return (
    <article className="owner-listing-card">
      <div className="owner-cover">
        {listing.images.length ? (
          <ListingImage
            species={listing.pet.species.slug}
            src={listing.images[0].thumbnailUrl}
            alt={listingHeading(listing.pet)}
            width="480"
            height="360"
            loading="lazy"
          />
        ) : (
          <ListingPlaceholder species={listing.pet.species.slug} />
        )}
      </div>
      <div className="owner-card-body">
        <PublicationState row={listing} />
        <h2>{listingHeading(listing.pet)}</h2>
        <p className="muted">
          {[
            formatPetAge(listing.pet.birthDate),
            listingGender(listing.pet.gender),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p>{listingLocation(listing.location)}</p>
        <p>
          {listing.type === "SALE"
            ? `${listingTypeLabels.SALE} · ${listingPrice(listing)}`
            : listingPrice(listing)}
        </p>
        {listing.pet.name?.trim() && (
          <p className="muted">Ім’я: {listing.pet.name.trim()}</p>
        )}
        <p className="muted">
          Оновлено:{" "}
          <time dateTime={listing.updatedAt}>
            {listingDate(listing.updatedAt)}
          </time>
        </p>
        <div className="form-actions">
          <Link
            className="button primary"
            href={`/listings/${listing.id}/edit`}
          >
            {editable(listing.status, listing.moderationStatus)
              ? "Редагувати"
              : "Переглянути"}
          </Link>
          {isPublicPublication(listing) && (
            <Link className="button secondary" href={`/listings/${listing.id}`}>
              У каталозі
            </Link>
          )}
          {canSubmitPublication(listing) && (
            <Link
              className="button secondary"
              href={`/listings/${listing.id}/edit#publication`}
            >
              Подати на публікацію
            </Link>
          )}
          <ListingActions listing={listing} showArchive={false} />
        </div>
      </div>
    </article>
  );
}
function OwnList() {
  const session = useSession();
  const [group, setGroup] = useState<StatusGroup>("all");
  const query = useInfiniteQuery({
    queryKey: ["my-listings", session.data?.id, group],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      getOwnListings(group, pageParam, signal),
    getNextPageParam: (page, pages) =>
      page.hasMore ? pages.length + 1 : undefined,
  });
  const listings =
    query.data?.pages
      .flatMap((page) => page.data)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ) ?? [];
  return (
    <section>
      <div className="owner-page-heading">
        <h1>Мої оголошення</h1>
        <Link className="button primary" href="/listings/new">
          Створити оголошення
        </Link>
      </div>
      {session.data?.accountType === "BREEDER" &&
        session.data.verificationStatus === "VERIFIED" && (
          <PreparedNotice userId={session.data.id} />
        )}
      <nav aria-label="Статус оголошень" className="owner-status-filters">
        {Object.entries(statusGroups).map(([key, value]) => (
          <button
            key={key}
            type="button"
            className={`button ${key === group ? "primary" : "secondary"}`}
            aria-pressed={key === group}
            aria-current={key === group ? "true" : undefined}
            onClick={() => setGroup(key as StatusGroup)}
          >
            {value.label}
          </button>
        ))}
      </nav>
      {query.isPending ? (
        <ListingManagementSkeleton />
      ) : query.isError ? (
        <div role="alert">
          <p>Не вдалося завантажити ваші оголошення.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : listings.length ? (
        <div className="owner-listings">
          {listings.map((listing) => (
            <OwnerListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="catalog-state">
          <h2>
            {group === "all"
              ? "У вас ще немає оголошень"
              : "У цій категорії поки немає оголошень"}
          </h2>
          <Link className="button primary" href="/listings/new">
            Створити оголошення
          </Link>
        </div>
      )}
      {query.hasNextPage && (
        <button
          className="button secondary"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Завантажуємо…" : "Показати ще"}
        </button>
      )}
    </section>
  );
}
export function MyListingsPage() {
  return (
    <RequireSession>
      <OwnList />
    </RequireSession>
  );
}
