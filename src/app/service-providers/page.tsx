import { ServicesCatalog } from "@/features/services/catalog/catalog";
import { servicesMetadata } from "@/features/services/metadata";
export const metadata = servicesMetadata(
  "Спеціалісти та організації",
  "Публічні профілі надавачів послуг для домашніх тварин.",
  "/service-providers",
);
export default async function ServiceProvidersPage({
  searchParams,
}: PageProps<"/service-providers">) {
  return <ServicesCatalog providers searchParams={await searchParams} />;
}
