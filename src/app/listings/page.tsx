import type { Metadata } from "next";
import { parseFilterUrl } from "@/features/listing/filters/filter-url-parser";
import { ListingsCatalog } from "@/widgets/listings-catalog/listings-catalog";
export const metadata: Metadata = {
  title: "Оголошення про тварин — Лапа",
  description: "Актуальні оголошення про собак і котів від власників.",
};
export default async function ListingsPage({
  searchParams,
}: PageProps<"/listings">) {
  return <ListingsCatalog query={parseFilterUrl(await searchParams)} />;
}
