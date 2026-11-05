import Link from "next/link";
import { SafeImage } from "@/shared/ui/safe-image";
import type {
  ServiceOffer,
  ServiceProvider,
} from "@/entities/service-offer/model";
import { serviceOfferHref } from "@/entities/service-offer/query";
import {
  providerKindLabels,
  serviceModeLabels,
  servicePrice,
} from "@/entities/service-offer/presentation";
export function ServiceProviderCard({
  provider,
}: {
  provider: ServiceProvider;
}) {
  return (
    <Link
      prefetch={false}
      className="services-card services-provider-card"
      href={`/service-providers/${provider.id}`}
    >
      <div className="services-logo">
        <SafeImage
          src={provider.logo?.url}
          alt=""
          width={76}
          height={76}
          fallback={
            <span aria-hidden="true">{provider.publicName.slice(0, 1)}</span>
          }
        />
      </div>
      <p className="services-eyebrow">{providerKindLabels[provider.kind]}</p>
      <h2>{provider.publicName}</h2>
      <p className="services-excerpt">{provider.description}</p>
      {provider.locations[0] && (
        <p className="muted">
          {provider.locations[0].location.city} ·{" "}
          {provider.locations[0].location.region}
        </p>
      )}
      <span className="services-card-link">Переглянути профіль →</span>
    </Link>
  );
}
export function ServiceOfferCard({
  offer,
  returnTo = "/services",
}: {
  offer: ServiceOffer;
  returnTo?: string;
}) {
  return (
    <Link
      prefetch={false}
      className="services-card"
      href={serviceOfferHref(offer.id, returnTo)}
    >
      <div className="services-card-image">
        <SafeImage
          src={offer.images[0]?.url}
          alt={offer.title}
          width={560}
          height={350}
          loading="lazy"
          fallback={<span>Фото послуги ще немає</span>}
        />
      </div>
      <div className="services-card-body">
        <p className="services-eyebrow">{offer.category.nameUk}</p>
        <h2>{offer.title}</h2>
        <p className="services-price">{servicePrice(offer.price)}</p>
        <p>{offer.provider.publicName}</p>
        <p className="muted">
          {serviceModeLabels[offer.mode]}
          {offer.locations[0] ? ` · ${offer.locations[0].location.city}` : ""}
        </p>
        <p className="muted">{offer.species.map((s) => s.label).join(" · ")}</p>
      </div>
    </Link>
  );
}
