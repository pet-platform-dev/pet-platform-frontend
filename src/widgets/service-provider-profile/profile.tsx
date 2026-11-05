import Link from "next/link";
import { SafeImage } from "@/shared/ui/safe-image";
import type {
  ServiceProvider,
  OffersPage,
} from "@/entities/service-offer/model";
import { providerKindLabels } from "@/entities/service-offer/presentation";
import {
  ServiceContactsBlock,
  ServiceLocations,
  ServiceGallery,
} from "@/features/services/details/public-content";
import { ServiceOfferCard } from "@/features/services/catalog/cards";
import { ServicePagination } from "@/features/services/catalog/pagination";
export function ServiceProviderProfile({
  provider,
  offers,
}: {
  provider: ServiceProvider;
  offers: OffersPage;
}) {
  return (
    <main className="catalog-shell services-shell">
      <Link className="services-back" href="/service-providers">
        ← До надавачів послуг
      </Link>
      {provider.cover && (
        <div className="services-cover">
          <SafeImage
            src={provider.cover.url}
            alt=""
            width={1200}
            height={400}
          />
        </div>
      )}
      <header className="services-profile-heading">
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
        <div>
          <p className="services-eyebrow">
            {providerKindLabels[provider.kind]}
          </p>
          <h1>{provider.publicName}</h1>
          <p className="muted">
            {provider.kind === "ORGANIZATION"
              ? "Послуги від організації"
              : "Індивідуальні послуги для улюбленців"}
          </p>
        </div>
      </header>
      <div className="services-detail">
        <div>
          <section className="services-panel">
            <h2>
              {provider.kind === "ORGANIZATION"
                ? "Про організацію"
                : "Про спеціаліста"}
            </h2>
            <p className="services-description">{provider.description}</p>
          </section>
          {Boolean(provider.gallery?.length) && (
            <section className="services-panel">
              <h2>Фотогалерея</h2>
              <ServiceGallery
                images={provider.gallery ?? []}
                title={provider.publicName}
              />
            </section>
          )}
        </div>
        <aside>
          <ServiceContactsBlock contacts={provider.contacts} />
          <ServiceLocations locations={provider.locations} />
        </aside>
      </div>
      <section className="services-section" aria-label="Послуги надавача">
        <h2>Послуги надавача</h2>
        {offers.data.length ? (
          <div className="services-grid">
            {offers.data.map((o) => (
              <ServiceOfferCard key={o.id} offer={o} />
            ))}
          </div>
        ) : (
          <p className="services-state">Опублікованих послуг поки немає.</p>
        )}
        <ServicePagination
          base={`/service-providers/${provider.id}`}
          query={{ page: offers.meta.page, sort: "newest", limit: 24 }}
          pages={offers.meta.pages}
          label="Сторінки послуг надавача"
        />
      </section>
    </main>
  );
}
