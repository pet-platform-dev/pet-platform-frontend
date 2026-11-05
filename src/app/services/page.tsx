import { ServicesCatalog } from "@/features/services/catalog/catalog";
import { servicesMetadata } from "@/features/services/metadata";
export const metadata = servicesMetadata(
  "Послуги для улюбленців",
  "Догляд, підтримка та допомога для домашніх тварин на платформі Лапа.",
  "/services",
);
export default async function ServicesPage({
  searchParams,
}: PageProps<"/services">) {
  return <ServicesCatalog searchParams={await searchParams} />;
}
