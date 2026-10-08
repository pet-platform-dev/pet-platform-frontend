import type { Metadata } from "next";
import { catalogQuery } from "@/entities/listing/model/catalog-query";
import { ListingsCatalog } from "@/widgets/listings-catalog/listings-catalog";
export const metadata: Metadata = {
  title: "Оголошення про тварин — Лапа",
  description: "Актуальні оголошення про собак і котів від власників.",
};
export default async function ListingsPage({
  searchParams,
}: PageProps<"/listings">) {
  return <ListingsCatalog query={catalogQuery(await searchParams)} />;
}
