import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getListing } from "@/entities/listing/api/get-listing";
import { listingMetadata } from "@/entities/listing/model/detail-presentation";
import { ApiError } from "@/shared/api/client";
import { ListingDetails } from "@/widgets/listing-details/listing-details";
import { safeCatalogReturn } from "@/features/listing/navigation/catalog-return";
// One canonical API helper, memoized only for this server render/metadata pair.
const loadListing = cache(getListing);

export async function generateMetadata({
  params,
}: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    return listingMetadata(await loadListing(id));
  } catch (error) {
    return {
      title:
        error instanceof ApiError && error.status === 404
          ? "Оголошення не знайдено — Лапа"
          : "Оголошення — Лапа",
      description: "Оголошення про собак і котів від власників.",
      robots: { index: false, follow: false },
    };
  }
}
export default async function ListingPage({
  params,
  searchParams,
}: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const returnHref = safeCatalogReturn((await searchParams).returnTo);
  let listing;
  try {
    listing = await loadListing(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return <ListingDetails id={id} initialFailed returnHref={returnHref} />;
  }
  return (
    <ListingDetails id={id} initialListing={listing} returnHref={returnHref} />
  );
}
