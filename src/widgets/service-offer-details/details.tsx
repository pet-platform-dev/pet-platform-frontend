import Link from "next/link";
import type { ServiceOffer } from "@/entities/service-offer/model";
import {
  serviceModeLabels,
  servicePrice,
} from "@/entities/service-offer/presentation";
import {
  ServiceContactsBlock,
  ServiceLocations,
  ServiceGallery,
} from "@/features/services/details/public-content";
import { ServiceOfferFacts } from "@/features/services/details/offer-facts";
export function ServiceOfferDetails({
  offer,
  returnTo,
}: {
  offer: ServiceOffer;
  returnTo: string;
}) {
  return (
    <main className="catalog-shell services-shell">
      <Link className="services-back" href={returnTo}>
        ← До послуг
      </Link>
      <header className="catalog-intro">
        <Link
          className="services-eyebrow"
          href={`/services/category/${offer.category.slug}`}
        >
          {offer.category.nameUk}
        </Link>
        <h1>{offer.title}</h1>
        <p className="services-price">{servicePrice(offer.price)}</p>
        <p className="muted">
          {serviceModeLabels[offer.mode]} ·{" "}
          {offer.species.map((s) => s.label).join(" · ")}
        </p>
      </header>
      <div className="services-detail">
        <div>
          <ServiceGallery images={offer.images} title={offer.title} />
          <section className="services-panel services-section">
            <h2>Опис послуги</h2>
            <p className="services-description">{offer.description}</p>
          </section>
          <ServiceOfferFacts offer={offer} />
        </div>
        <aside>
          <section className="services-panel">
            <h2>Надавач послуги</h2>
            <Link
              className="services-card-link"
              href={`/service-providers/${offer.provider.id}`}
            >
              {offer.provider.publicName} →
            </Link>
          </section>
          <ServiceContactsBlock contacts={offer.provider.contacts} />
          {offer.mode !== "REMOTE" && (
            <ServiceLocations locations={offer.locations} />
          )}
        </aside>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: offer.title,
            description: offer.description,
            serviceType: offer.category.nameUk,
            provider: {
              "@type":
                offer.provider.kind === "ORGANIZATION"
                  ? "Organization"
                  : "Person",
              name: offer.provider.publicName,
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}
