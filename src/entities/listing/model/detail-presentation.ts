import type { Listing } from "./listing";
import { listingHeading, listingPrice } from "./presentation";

export function sellerName(seller: Listing["seller"]): string {
  return seller.displayName;
}
export function supportingListingTitle(listing: Listing): string | null {
  const title = listing.title.trim();
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .toLocaleLowerCase("uk-UA")
      .replace(/\s+/g, " ")
      .trim();
  return normalize(title) === normalize(listingHeading(listing.pet))
    ? null
    : title;
}
export function listingMetadata(listing: Listing) {
  return {
    title: `${listingHeading(listing.pet)} — ${listingPrice(listing)} — Лапа`,
    description: listing.description.replace(/\s+/g, " ").trim().slice(0, 160),
  };
}
