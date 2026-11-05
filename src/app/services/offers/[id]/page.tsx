import { notFound } from "next/navigation";
import { getServiceOffer } from "@/entities/service-offer/public-api.server";
import { serviceReturnTarget } from "@/entities/service-offer/query";
import { ServiceOfferDetails } from "@/widgets/service-offer-details/details";
import { ServicesUnavailable } from "@/features/services/catalog/catalog";
import { ApiError } from "@/shared/api/client";
import { servicesMetadata } from "@/features/services/metadata";
export async function generateMetadata({
  params,
}: PageProps<"/services/offers/[id]">) {
  const { id } = await params;
  try {
    const o = await getServiceOffer(id);
    return servicesMetadata(
      o.title,
      o.description ?? o.category.nameUk,
      `/services/offers/${id}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return servicesMetadata(
      "Послуга недоступна",
      "Спробуйте відкрити сторінку пізніше.",
      `/services/offers/${id}`,
    );
  }
}
export default async function ServiceOfferPage({
  params,
  searchParams,
}: PageProps<"/services/offers/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  let offer;
  try {
    offer = await getServiceOffer(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    if (!(e instanceof ApiError)) throw e;
    return (
      <main className="catalog-shell services-shell">
        <h1>Послуга тимчасово недоступна</h1>
        <ServicesUnavailable base={`/services/offers/${id}`} />
      </main>
    );
  }
  return (
    <ServiceOfferDetails
      offer={offer}
      returnTo={serviceReturnTarget(query.returnTo)}
    />
  );
}
