import Link from "next/link";
import { ApiError } from "@/shared/api/client";
import {
  getServiceCategories,
  getServiceOffers,
  getServiceProviders,
  getServiceLocation,
} from "@/entities/service-offer/public-api.server";
import {
  parseServiceQuery,
  serviceHref,
  serializeServiceQuery,
  type SearchParams,
} from "@/entities/service-offer/query";
import { ServiceCatalogFilters } from "./catalog-filters";
import { ServiceOfferCard, ServiceProviderCard } from "./cards";
import { ServicePagination } from "./pagination";
import { notFound } from "next/navigation";
export function ServicesUnavailable({
  base = "/services",
  message = "Не вдалося завантажити послуги. Спробуйте ще раз.",
}: {
  base?: string;
  message?: string;
}) {
  return (
    <section className="services-state" role="alert">
      <h2>{message}</h2>
      <Link className="button secondary" href={base}>
        Спробувати ще раз
      </Link>
    </section>
  );
}
export async function ServicesCatalog({
  searchParams,
  category,
  providers = false,
}: {
  searchParams: SearchParams;
  category?: string;
  providers?: boolean;
}) {
  const base = category
    ? `/services/category/${category}`
    : providers
      ? "/service-providers"
      : "/services";
  const parsed = parseServiceQuery(
    category ? { ...searchParams, category } : searchParams,
  );
  if (!parsed.success)
    return (
      <main className="catalog-shell services-shell">
        <h1>Перевірте параметри пошуку</h1>
        <p>Фільтри мають некоректне значення.</p>
        <Link href={base}>Скинути фільтри</Link>
      </main>
    );
  const q = parsed.data;
  let data, categories, location;
  try {
    categories = await getServiceCategories();
    if (category && !categories.some((c) => c.slug === category)) notFound();
    [data, location] = await Promise.all([
      providers ? getServiceProviders(q) : getServiceOffers(q),
      getServiceLocation(q.locationId),
    ]);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return (
      <main className="catalog-shell services-shell">
        <h1>Послуги для улюбленців</h1>
        <ServicesUnavailable
          base={serviceHref(base, category ? { ...q, category: undefined } : q)}
        />
      </main>
    );
  }
  const current = categories.find((c) => c.slug === category);
  const returnTo = serviceHref(
    base,
    category ? { ...q, category: undefined } : q,
  );
  return (
    <main className="catalog-shell services-shell">
      <header className="catalog-intro">
        <p className="services-eyebrow">Турбота поруч</p>
        <h1>
          {current?.nameUk ??
            (providers
              ? "Спеціалісти та організації"
              : "Послуги для улюбленців")}
        </h1>
        <p>
          {current?.description ??
            "Знайдіть догляд, підтримку та допомогу для свого улюбленця."}
        </p>
        <nav className="services-actions" aria-label="Розділи послуг">
          <Link
            href="/services"
            aria-current={!providers && !category ? "page" : undefined}
          >
            Усі послуги
          </Link>
          <Link
            href="/service-providers"
            aria-current={providers ? "page" : undefined}
          >
            Надавачі послуг
          </Link>
        </nav>
      </header>
      <nav className="services-categories" aria-label="Категорії послуг">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/services/category/${c.slug}`}
            aria-current={category === c.slug ? "page" : undefined}
          >
            {c.nameUk}
          </Link>
        ))}
      </nav>
      <ServiceCatalogFilters
        key={serializeServiceQuery(q)}
        query={q}
        base={base}
        categories={categories}
        location={location}
        fixedCategory={Boolean(category)}
      />
      <section aria-label={providers ? "Надавачі послуг" : "Результати пошуку"}>
        <p role="status" className="services-count">
          Знайдено: {data.meta.total}
        </p>
        {data.data.length ? (
          <div className="services-grid">
            {providers
              ? (
                  data.data as Awaited<
                    ReturnType<typeof getServiceProviders>
                  >["data"]
                ).map((p) => <ServiceProviderCard key={p.id} provider={p} />)
              : (
                  data.data as Awaited<
                    ReturnType<typeof getServiceOffers>
                  >["data"]
                ).map((o) => (
                  <ServiceOfferCard key={o.id} offer={o} returnTo={returnTo} />
                ))}
          </div>
        ) : (
          <div className="services-state">
            <h2>
              {q.page > 1
                ? "На цій сторінці немає результатів"
                : "За цими фільтрами послуг поки немає"}
            </h2>
            <p>Спробуйте іншу категорію або змініть фільтри.</p>
            <Link className="button secondary" href={base}>
              Скинути фільтри
            </Link>
          </div>
        )}
        <ServicePagination
          base={base}
          query={{ ...q, ...(category ? { category: undefined } : {}) }}
          pages={data.meta.pages}
          label="Сторінки послуг"
        />
      </section>
    </main>
  );
}
