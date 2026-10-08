import type { Listing } from "./listing";
import { breedLabel } from "@/entities/breed/model";
import { speciesLabel } from "@/entities/species/model";

export function listingHeading(
  pet: Pick<Listing["pet"], "breed" | "species">,
): string {
  return pet.breed
    ? breedLabel(pet.breed)
    : `${speciesLabel(pet.species.slug)} · Породу не вказано`;
}
export const listingTypeLabels = {
  SALE: "Продаж",
  FREE: "Безкоштовно",
  ADOPTION: "Прилаштування",
} as const;
const money = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const dates = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  day: "numeric",
  month: "short",
  year: "numeric",
});
export function listingPrice(listing: Pick<Listing, "type" | "price">): string {
  if (listing.type !== "SALE") return listingTypeLabels[listing.type];
  return listing.price === null
    ? "Ціну не вказано"
    : money.format(Number(listing.price));
}
export function listingLocation(
  location: Pick<Listing["location"], "city" | "region">,
): string {
  const city = location.city.trim();
  const region = location.region.trim();
  return !region || city === region ? city : `${city}, ${region}`;
}
export function listingDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dates.format(date);
}
export function listingGender(gender: Listing["pet"]["gender"]): string | null {
  return gender === "MALE"
    ? "Хлопчик"
    : gender === "FEMALE"
      ? "Дівчинка"
      : null;
}
