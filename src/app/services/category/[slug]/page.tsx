import { ApiError } from "@/shared/api/client";
import { notFound } from "next/navigation";
import { ServicesCatalog } from "@/features/services/catalog/catalog";
import { getServiceCategories } from "@/entities/service-offer/public-api.server";
import { categorySlugs } from "@/entities/service-offer/model";
import { servicesMetadata } from "@/features/services/metadata";
export async function generateMetadata({
  params,
}: PageProps<"/services/category/[slug]">) {
  const { slug } = await params;
  if (!categorySlugs.some((s) => s === slug)) notFound();
  try {
    const c = (await getServiceCategories()).find((c) => c.slug === slug);
    if (!c) notFound();
    return servicesMetadata(
      c.nameUk,
      c.description,
      `/services/category/${slug}`,
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return servicesMetadata(
      "Категорія послуг",
      "Послуги для домашніх тварин.",
      `/services/category/${slug}`,
    );
  }
}
export default async function ServiceCategoryPage({
  params,
  searchParams,
}: PageProps<"/services/category/[slug]">) {
  const { slug } = await params;
  if (!categorySlugs.some((s) => s === slug)) notFound();
  return <ServicesCatalog category={slug} searchParams={await searchParams} />;
}
