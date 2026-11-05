import { notFound } from "next/navigation";
import {
  getServiceProvider,
  getProviderOffers,
} from "@/entities/service-offer/public-api.server";
import { ServiceProviderProfile } from "@/widgets/service-provider-profile/profile";
import { ServicesUnavailable } from "@/features/services/catalog/catalog";
import { ApiError } from "@/shared/api/client";
import { servicesMetadata } from "@/features/services/metadata";
import { serviceQuerySchema } from "@/entities/service-offer/query";
export async function generateMetadata({
  params,
}: PageProps<"/service-providers/[id]">) {
  const { id } = await params;
  try {
    const p = await getServiceProvider(id);
    return servicesMetadata(
      p.publicName,
      p.description ?? "Послуги для домашніх тварин",
      `/service-providers/${id}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return servicesMetadata(
      "Профіль недоступний",
      "Спробуйте відкрити сторінку пізніше.",
      `/service-providers/${id}`,
    );
  }
}
export default async function ProviderPage({
  params,
  searchParams,
}: PageProps<"/service-providers/[id]">) {
  const { id } = await params;
  const search = await searchParams;
  const parsed = serviceQuerySchema.safeParse(search);
  if (!parsed.success)
    return (
      <main className="catalog-shell services-shell">
        <h1>Перевірте параметри сторінки</h1>
        <a href={`/service-providers/${id}`}>Скинути параметри</a>
      </main>
    );
  let provider, offers;
  try {
    [provider, offers] = await Promise.all([
      getServiceProvider(id),
      getProviderOffers(id, parsed.data),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (!(e instanceof ApiError)) throw e;
    return (
      <main className="catalog-shell services-shell">
        <h1>Профіль тимчасово недоступний</h1>
        <ServicesUnavailable base={`/service-providers/${id}`} />
      </main>
    );
  }
  return <ServiceProviderProfile provider={provider} offers={offers} />;
}
