import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/entities/service-offer/model.ts");
const query = await load("src/entities/service-offer/query.ts");
const { servicePrice } = await load(
  "src/entities/service-offer/presentation.ts",
);
const { servicesMetadata } = await load("src/features/services/metadata.ts");
const api = await load("src/entities/service-offer/public-api.server.ts");
const { ServiceOfferCard, ServiceProviderCard } = await load(
  "src/features/services/catalog/cards.tsx",
);
const { ServiceOfferDetails } = await load(
  "src/widgets/service-offer-details/details.tsx",
);
const { ServiceProviderProfile } = await load(
  "src/widgets/service-provider-profile/profile.tsx",
);
const { ServiceContactsBlock } = await load(
  "src/features/services/details/public-content.tsx",
);
const { proxyApi } = await load("src/shared/api/proxy.ts");
const { navigationActive } = await load(
  "src/widgets/header/navigation-active.ts",
);
const { ServicePagination } = await load(
  "src/features/services/catalog/pagination.tsx",
);
const { ServicesCatalog } = await load(
  "src/features/services/catalog/catalog.tsx",
);
const offerRoute = await load("src/app/services/offers/[id]/page.tsx");
const { QueryClient, QueryClientProvider } =
  await import("../node_modules/@tanstack/react-query/build/modern/index.js");
const id = "11111111-1111-4111-8111-111111111111";
const category = {
  id,
  slug: "grooming",
  nameUk: "Грумінг",
  description: "Догляд за тваринами",
  allowedProviderKinds: ["INDIVIDUAL", "ORGANIZATION"],
};
const provider = {
  id,
  kind: "INDIVIDUAL",
  publicName: "Турботливий спеціаліст",
  description: "Дбайливий догляд",
  logo: null,
  cover: null,
  locations: [],
  gallery: [],
  contacts: {
    phone: "+380501234567",
    telegram: "synthetic_name",
    viber: null,
    whatsapp: null,
    website: "https://example.invalid",
  },
};
const offer = {
  id,
  title: "Догляд за шерстю",
  description: "Спокійний догляд",
  category,
  provider,
  mode: "REMOTE",
  price: {
    mode: "FROM",
    amount: "1234567890.12",
    unit: "VISIT",
    currency: "UAH",
  },
  species: [{ id, slug: "dog", label: "Собаки" }],
  locations: [],
  images: [],
  details: { petSizes: ["SMALL"], techniques: ["Стрижка"] },
  detailsVersion: 1,
};
const render = (c) => renderToStaticMarkup(c);

test("S7 URL parser and serializer round-trip normalized filters, page and sort; reject duplicate/unknown/mixed parameters", () => {
  const q = query.serviceQuerySchema.parse({
    q: " Грумінг ",
    species: "dog",
    category: "grooming",
    providerKind: "ORGANIZATION",
    mode: "MOBILE",
    priceModel: "FROM",
    locationId: id,
    regionId: "UA80",
    page: "2",
    sort: "name_asc",
  });
  assert.equal(
    query.parseServiceQuery(
      Object.fromEntries(new URLSearchParams(query.serializeServiceQuery(q))),
    ).data.page,
    2,
  );
  assert.equal(
    query.serializeServiceQuery(query.serviceQuerySchema.parse({})),
    "",
  );
  for (const input of [
    { page: ["1", "2"] },
    { includeDrafts: "true" },
    { q: "x" },
    { mode: "REMOTE", regionId: "UA80" },
    { page: "0" },
    { limit: "25" },
    { category: "bad" },
  ])
    assert.equal(query.parseServiceQuery(input).success, false);
});
test("S7 safe catalog return URL survives refresh and rejects open redirects", () => {
  const target = "/services/category/grooming?q=Догляд&page=2&sort=name_asc";
  assert.equal(query.serviceReturnTarget(target), target);
  assert.equal(
    new URLSearchParams(query.serviceOfferHref(id, target).split("?")[1]).get(
      "returnTo",
    ),
    target,
  );
  for (const bad of [
    "https://evil.invalid/",
    "//evil.invalid/services",
    "/\\evil.invalid",
    "/services/%2f%2fevil",
    "/profile",
    "/services/offers/" + id,
    "/services#evil",
    undefined,
    ["/services"],
  ])
    assert.equal(query.serviceReturnTarget(bad), "/services");
});
test("S7 exact Ukrainian price formatting preserves precision and unit distinctions", () => {
  assert.equal(servicePrice(offer.price), "Від 1 234 567 890,12 ₴ / візит");
  assert.equal(
    servicePrice({
      ...offer.price,
      mode: "FIXED",
      amount: "250.00",
      unit: "HOUR",
    }),
    "250 ₴ / годину",
  );
  assert.equal(
    servicePrice({
      ...offer.price,
      mode: "ON_REQUEST",
      amount: null,
      unit: null,
    }),
    "Ціна за запитом",
  );
});
test("S7 public schemas reject unsafe URLs and retain only public fields", () => {
  const parsed = model.providerSchema.parse({
    ...provider,
    passwordHash: "hidden",
    memberships: ["hidden"],
  });
  assert.equal(parsed.passwordHash, undefined);
  assert.equal(parsed.memberships, undefined);
  for (const website of [
    "javascript:alert(1)",
    "https://user:secret@example.invalid",
    "data:text/html,test",
  ])
    assert.equal(
      model.contactsSchema.safeParse({ ...provider.contacts, website }).success,
      false,
    );
  assert.equal(
    model.providerSchema.safeParse({
      ...provider,
      logo: {
        id,
        type: "LOGO",
        position: 0,
        url: "https://evil.invalid/photo.jpg",
      },
    }).success,
    false,
  );
  assert.equal(
    model.contactsSchema.safeParse({
      ...provider.contacts,
      website: "http://example.invalid",
    }).success,
    true,
  );
});
test("S7 offer/provider cards keep hierarchy, public routes and fallbacks without invented ratings/badges", () => {
  const html = render(
    React.createElement(ServiceOfferCard, {
      offer,
      returnTo: "/services?page=2",
    }),
  );
  assert.match(html, /Догляд за шерстю/);
  assert.match(html, /returnTo=/);
  assert.match(html, /Собаки/);
  assert.doesNotMatch(html, /verified|Рейтинг|Забронювати/);
  for (const kind of ["INDIVIDUAL", "ORGANIZATION"]) {
    const card = render(
      React.createElement(ServiceProviderCard, {
        provider: { ...provider, kind },
      }),
    );
    assert.match(card, /service-providers/);
    assert.match(card, kind === "INDIVIDUAL" ? /Спеціаліст/ : /Організація/);
  }
});
test("S7 profile separates organization/individual identity and compact public-offers empty state", () => {
  for (const kind of ["INDIVIDUAL", "ORGANIZATION"]) {
    const html = render(
      React.createElement(ServiceProviderProfile, {
        provider: { ...provider, kind },
        offers: { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
      }),
    );
    assert.match(
      html,
      kind === "INDIVIDUAL" ? /Про спеціаліста/ : /Про організацію/,
    );
    assert.match(html, /Опублікованих послуг поки немає/);
    assert.doesNotMatch(html, /Створити послугу|Верифікован/);
  }
});
test("S7 structured data and descriptions cannot close script tags or render raw HTML", () => {
  const value = '</script><script>alert("bad")</script>';
  const html = render(
    React.createElement(ServiceOfferDetails, {
      offer: { ...offer, description: value },
      returnTo: "/services",
    }),
  );
  assert.match(html, /&lt;script&gt;/);
  const json = html.match(
    /<script type="application\/ld\+json">([^]*?)<\/script>/,
  )[1];
  assert.equal(json.includes("<"), false);
  assert.equal(JSON.parse(json).description, value);
});
test("S7 contacts reuse safe messenger links, preserve optional fields and never use account email", () => {
  assert.equal(
    render(React.createElement(ServiceContactsBlock, { contacts: undefined })),
    "",
  );
  const html = render(
    React.createElement(ServiceContactsBlock, { contacts: provider.contacts }),
  );
  assert.match(html, /tel:\+380501234567/);
  assert.match(html, /https:\/\/t.me\/synthetic_name/);
  assert.match(html, /noopener noreferrer/);
  assert.doesNotMatch(html, /mailto:/);
});
test("S7 metadata is always noindex during DRAFT_ONLY/staging; canonical never invents or uses preview host", () => {
  const blank = servicesMetadata("Послуги", "Опис", "/services", {});
  assert.equal(blank.robots.index, false);
  assert.equal(blank.alternates, undefined);
  for (const env of [
    { SERVICES_CANONICAL_ORIGIN: "https://lapa-staging.vercel.app" },
    { SERVICES_CANONICAL_ORIGIN: "https://example.org", VERCEL_ENV: "preview" },
    { SERVICES_CANONICAL_ORIGIN: "http://localhost:3017" },
  ])
    assert.equal(
      servicesMetadata("Послуги", "Опис", "/services", env).alternates,
      undefined,
    );
  assert.equal(
    servicesMetadata("Послуги", "Опис", "/services", {
      SERVICES_CANONICAL_ORIGIN: "https://example.org",
    }).alternates.canonical,
    "https://example.org/services",
  );
  assert.equal(navigationActive("/service-providers/" + id, "/services"), true);
});
test("S7 server loaders omit all credentials, use no-store and validate response identities", async () => {
  const before = globalThis.fetch;
  const old = { ...process.env };
  process.env.NEXT_PUBLIC_API_PROXY_ENABLED = "true";
  process.env.API_PROXY_BACKEND_ORIGIN = "https://backend.example";
  process.env.API_PROXY_FRONTEND_ORIGIN = "https://frontend.example";
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://backend.example/api/v1/service-offers/" + id,
      );
      assert.equal(init.credentials, "omit");
      assert.equal(init.cache, "no-store");
      assert.equal(init.redirect, "error");
      assert.equal(new Headers(init.headers).get("authorization"), null);
      assert.equal(new Headers(init.headers).get("cookie"), null);
      return Response.json({ data: offer });
    };
    assert.equal((await api.getServiceOffer(id)).id, id);
    globalThis.fetch = async () =>
      Response.json({
        data: { ...offer, id: "22222222-2222-4222-8222-222222222222" },
      });
    await assert.rejects(api.getServiceOffer(id), (e) => e.status === 404);
    globalThis.fetch = async () => Response.json({}, { status: 404 });
    await assert.rejects(api.getServiceProvider(id), (e) => e.status === 404);
  } finally {
    globalThis.fetch = before;
    for (const k of [
      "NEXT_PUBLIC_API_PROXY_ENABLED",
      "API_PROXY_BACKEND_ORIGIN",
      "API_PROXY_FRONTEND_ORIGIN",
    ]) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
});
test("S7 existing same-origin proxy preserves public query/status/body without new auth semantics", async () => {
  const env = {
    NEXT_PUBLIC_API_PROXY_ENABLED: "true",
    API_PROXY_BACKEND_ORIGIN: "https://backend.example",
    API_PROXY_FRONTEND_ORIGIN: "https://frontend.example",
  };
  const req = new Request(
    "https://frontend.example/api/v1/service-offers?species=dog&page=2&sort=name_asc",
    { headers: { "sec-fetch-site": "same-origin" } },
  );
  const r = await proxyApi(req, ["service-offers"], env, async (url, init) => {
    assert.equal(
      String(url),
      "https://backend.example/api/v1/service-offers?species=dog&page=2&sort=name_asc",
    );
    assert.equal(init.method, "GET");
    return Response.json({
      data: [],
      meta: { page: 2, limit: 24, total: 0, pages: 0 },
    });
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).meta.page, 2);
});
test("S7 reused pagination preserves applied filters and stable page URLs", () => {
  const q = query.serviceQuerySchema.parse({
    q: "Догляд",
    page: 2,
    sort: "name_asc",
  });
  const html = render(
    React.createElement(ServicePagination, {
      base: "/services",
      query: q,
      pages: 3,
    }),
  );
  assert.match(html, /aria-current="page"/);
  assert.match(html, /page=3/);
  assert.match(html, /sort=name_asc/);
  assert.match(html, /%D0%94%D0%BE%D0%B3%D0%BB%D1%8F%D0%B4/);
});
test("S7 actual catalog and detail routes render public content on server and produce safe metadata/not-found", async () => {
  const before = globalThis.fetch;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  try {
    globalThis.fetch = async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/service-categories"))
        return Response.json({ data: [category] });
      if (path.endsWith("/service-offers"))
        return Response.json({
          data: [offer],
          meta: { page: 1, limit: 24, total: 1, pages: 1 },
        });
      return Response.json({ data: offer });
    };
    const catalog = await ServicesCatalog({ searchParams: {} });
    const html = render(
      React.createElement(QueryClientProvider, { client }, catalog),
    );
    assert.match(html, /Догляд за шерстю/);
    assert.match(html, /Результати пошуку/);
    const props = {
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    };
    const meta = await offerRoute.generateMetadata(props);
    assert.equal(meta.title, "Догляд за шерстю — Лапа");
    assert.equal(meta.robots.index, false);
    assert.match(render(await offerRoute.default(props)), /Опис послуги/);
    globalThis.fetch = async () => Response.json({}, { status: 404 });
    await assert.rejects(
      offerRoute.default(props),
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  } finally {
    globalThis.fetch = before;
    client.clear();
  }
});
test("S7 malformed upstream JSON and temporary outages produce safe retryable errors", async () => {
  const before = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("invalid-json", {
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(api.getServiceOffer(id), (e) => e.status === 503);
    globalThis.fetch = async () => {
      throw Error("synthetic connection failure");
    };
    await assert.rejects(
      api.getServiceProvider(id),
      (e) => e.status === 503 && !e.message.includes("synthetic"),
    );
  } finally {
    globalThis.fetch = before;
  }
});
