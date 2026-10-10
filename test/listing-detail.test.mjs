import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { ListingDetailContent } = await load(
  "src/widgets/listing-details/listing-detail-content.tsx",
);
const { ListingDetails } = await load(
  "src/widgets/listing-details/listing-details.tsx",
);
const { ListingDetailSkeleton } = await load(
  "src/widgets/listing-details/listing-detail-skeleton.tsx",
);
const { ListingUnavailable, ListingDetailError } = await load(
  "src/widgets/listing-details/listing-detail-state.tsx",
);
const { ListingCard } = await load("src/entities/listing/ui/listing-card.tsx");
const { getListing } = await load("src/entities/listing/api/get-listing.ts");
const { ApiError, signIn } = await load("src/shared/api/client.ts");
const { listingMetadata, supportingListingTitle } = await load(
  "src/entities/listing/model/detail-presentation.ts",
);
const { isSessionQuery } = await load("src/features/auth/session-provider.tsx");
const fixture = {
  id: "b3281413-c333-4752-9031-6a2df9274b1a",
  type: "SALE",
  status: "ACTIVE",
  title: "Цуценя бельгійської вівчарки малінуа",
  description: "Перший абзац.\n\nДругий абзац із турботою.",
  price: "25000.00",
  currency: "UAH",
  views: 0,
  publishedAt: "2026-10-01T12:00:00Z",
  closedAt: null,
  createdAt: "2026-09-30T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
  pet: {
    id: "pet",
    name: "Локі",
    gender: "MALE",
    birthDate: "2024-01-01",
    species: { id: "dog", name: "Dog", slug: "dog" },
    breed: {
      id: "breed",
      name: "Belgian Malinois",
      nameUk: "  Малінуа  ",
      slug: "belgian-malinois",
    },
  },
  location: {
    id: "location",
    countryCode: "UA",
    city: "Світловодськ",
    region: "Кіровоградська область",
    slug: "internal-city",
  },
  seller: {
    id: "seller",
    displayName: "Олена Коваль",
    location: null,
    phone: null,
    telegram: null,
    viber: null,
    whatsapp: null,
    memberSince: "2026-10-01T00:00:00Z",
  },
};
const render = (listing = fixture) =>
  renderToStaticMarkup(React.createElement(ListingDetailContent, { listing }));
function state(state, options = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, staleTime: 30000 },
    },
  });
  if (state === "success")
    client.setQueryData(["listing", fixture.id], fixture);
  else if (state instanceof Error)
    client
      .getQueryCache()
      .build(client, { queryKey: ["listing", fixture.id] })
      .setState({ status: "error", error: state });
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListingDetails, { id: fixture.id, ...options }),
    ),
  );
  client.clear();
  return html;
}
test("ACTIVE details use breed as single h1, optional name secondary and useful supporting title", () => {
  const html = render();
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.ok(html.includes(">Малінуа</h1>"));
  assert.ok(html.includes("Ім’я:"));
  assert.ok(html.includes(">Локі</span>"));
  assert.ok(!html.includes(">Локі</h1>"));
  assert.ok(html.includes(fixture.title));
  assert.ok(state("success").includes("← До оголошень"));
});
test("unnamed/null/blank pet does not render fake or empty name information", () => {
  for (const name of [null, "", "   "]) {
    const html = render({ ...fixture, pet: { ...fixture.pet, name } });
    assert.ok(!html.includes("listing-detail-name"));
    assert.ok(!html.includes("Без імені"));
  }
});
test("SALE formats UAH prominently, FREE and ADOPTION have text price and badge", () => {
  assert.ok(/25(?:\u00a0|\u202f| )000\s*₴/.test(render()));
  for (const [type, label] of [
    ["FREE", "Безкоштовно"],
    ["ADOPTION", "Прилаштування"],
  ]) {
    const html = render({ ...fixture, type, price: null });
    assert.ok(html.includes(label));
    assert.ok(!html.includes("0 ₴"));
    assert.ok(!html.includes(">SALE<"));
  }
});
test("details retain Ukrainian age/gender/location/species and publication metadata", () => {
  const html = render();
  assert.ok(!html.includes("Приватний продавець"));
  for (const text of [
    "Хлопчик",
    "Світловодськ, Кіровоградська область",
    "Собака",
    "Опубліковано",
    "2026",
  ])
    assert.ok(html.includes(text));
  assert.ok(html.includes(`dateTime="${fixture.publishedAt}"`));
  assert.ok(!html.includes("internal-city"));
  assert.ok(!html.includes(">MALE<"));
  const fallback = render({ ...fixture, publishedAt: null });
  assert.ok(fallback.includes("Додано"));
  assert.ok(!fallback.includes("Опубліковано"));
});
test("invalid/missing age and UNKNOWN gender are omitted without raw dates or enums", () => {
  const html = render({
    ...fixture,
    pet: { ...fixture.pet, birthDate: "2099-01-01", gender: "UNKNOWN" },
  });
  assert.ok(!html.includes("listing-detail-metadata"));
  assert.ok(!html.includes("2099-01-01"));
  assert.ok(!html.includes("UNKNOWN"));
});
test("description stays plain escaped text with paragraph breaks and no HTML execution", () => {
  const description =
    'Опис\n\n<script>alert("unsafe")</script>' + "довгеслово".repeat(100);
  const html = render({ ...fixture, description });
  assert.ok(html.includes("Опис\n\n&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("listing-description-text"));
});
test("seller uses full chosen public name and profile link without private registration fields", () => {
  const html = render();
  assert.ok(html.includes("Олена Коваль"));
  assert.ok(html.includes("/sellers/seller"));
  for (const text of [
    "email",
    "phone",
    "passwordHash",
    "refreshToken",
    "Написати продавцю",
    "Підтверджено",
    "UNVERIFIED",
  ])
    assert.ok(!html.includes(text));
});
test("curated breed fallback and missing breed preserve a meaningful primary identity", () => {
  for (const nameUk of [null, "", "  "])
    assert.ok(
      render({
        ...fixture,
        pet: { ...fixture.pet, breed: { ...fixture.pet.breed, nameUk } },
      }).includes(">Belgian Malinois</h1>"),
    );
  assert.ok(
    render({ ...fixture, pet: { ...fixture.pet, breed: null } }).includes(
      ">Собака · Породу не вказано</h1>",
    ),
  );
});
test("same breed/title text is not repeated in the supporting title", () => {
  assert.equal(
    supportingListingTitle({ ...fixture, title: "  МАЛІНУА  " }),
    null,
  );
  assert.equal(supportingListingTitle(fixture), fixture.title);
});
test("metadata uses public breed/price and short description, never optional name or private data", () => {
  const metadata = listingMetadata({
    ...fixture,
    description: "  Абзац\n\n" + "текст ".repeat(50),
  });
  assert.ok(metadata.title.startsWith("Малінуа — 25"));
  assert.ok(!metadata.title.includes("Локі"));
  assert.ok(metadata.description.length <= 160);
  assert.ok(!metadata.description.includes("\n"));
});
test("404/private/missing state is indistinguishable and offers valid catalog navigation", () => {
  const html = renderToStaticMarkup(React.createElement(ListingUnavailable));
  assert.ok(html.includes("Оголошення не знайдено"));
  assert.ok(
    html.includes(
      "Можливо, його було видалено, завершено або воно більше недоступне.",
    ),
  );
  assert.ok(html.includes('href="/listings"'));
  assert.ok(
    state(new ApiError(404, "private DRAFT owner secret")).includes(
      "Оголошення не знайдено",
    ),
  );
  assert.ok(
    !state(new ApiError(404, "private DRAFT owner secret")).includes("DRAFT"),
  );
});
test("generic/server/network errors are friendly and retryable, including server initial failure", () => {
  for (const status of [0, 500]) {
    const html = state(new ApiError(status, "secret database stack"));
    assert.ok(html.includes("Не вдалося завантажити оголошення"));
    assert.ok(html.includes("Спробувати ще раз"));
    assert.ok(!html.includes("secret database"));
  }
  assert.ok(
    state("pending", { initialFailed: true }).includes("Спробувати ще раз"),
  );
  assert.ok(
    renderToStaticMarkup(
      React.createElement(ListingDetailError, { retry() {} }),
    ).includes('role="alert"'),
  );
});
test("loading uses one status announcement, hidden decorative skeleton and final-layout classes", () => {
  const html = renderToStaticMarkup(React.createElement(ListingDetailSkeleton));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.ok(html.includes("listing-detail-grid"));
  assert.ok(state("pending").includes("listing-detail-skeleton"));
});
test("catalog card is one semantic detail link without nested links/buttons", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingCard, { listing: fixture }),
  );
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.ok(html.includes(`href="/listings/${fixture.id}"`));
  assert.ok(html.includes("Переглянути оголошення: Малінуа"));
  assert.ok(!html.includes("<button"));
});
test("public detail helper validates ACTIVE identity and omits Bearer/CSRF even after sign-in", async () => {
  const original = globalThis.fetch,
    calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      const data = url.endsWith("/csrf")
        ? { csrfToken: "test-csrf" }
        : url.endsWith("/login")
          ? {
              user: { id: "user" },
              accessToken: "test-only-access",
              expiresIn: 900,
            }
          : {
              ...fixture,
              seller: {
                ...fixture.seller,
                email: "private@example.test",
                passwordHash: "private-marker",
              },
            };
      return new Response(JSON.stringify({ data }), { status: 200 });
    };
    await signIn("login", {});
    const result = await getListing(fixture.id);
    assert.equal(result.pet.name, "Локі");
    assert.equal(result.seller.email, undefined);
    const call = calls.find((c) => c.url.endsWith(`/listings/${fixture.id}`));
    assert.equal(call.options.headers.Authorization, undefined);
    assert.equal(call.options.headers["X-CSRF-Token"], undefined);
    assert.equal(call.options.cache, "no-store");
    const before = calls.length;
    await assert.rejects(
      getListing("invalid/path"),
      (error) => error instanceof ApiError && error.status === 404,
    );
    assert.equal(calls.length, before);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: { ...fixture, id: "wrong-id" } }), {
        status: 200,
      });
    await assert.rejects(getListing(fixture.id));
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: { ...fixture, status: "DRAFT" } }), {
        status: 200,
      });
    await assert.rejects(getListing(fixture.id));
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "private listing exists" }), {
        status: 404,
      });
    await assert.rejects(
      getListing(fixture.id),
      (error) =>
        error instanceof ApiError &&
        error.status === 404 &&
        !error.message.includes("private"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("session expiry cancellation leaves an in-flight public detail query intact", async () => {
  const client = new QueryClient();
  let finish;
  const pending = client.fetchQuery({
    queryKey: ["listing", fixture.id],
    queryFn: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await client.cancelQueries({ predicate: isSessionQuery });
  finish(fixture);
  await pending;
  assert.equal(client.getQueryData(["listing", fixture.id]).id, fixture.id);
  client.clear();
});

test("detail back link renders preserved catalog target in success, loading and error states", () => {
  const returnHref = "/listings?q=малінуа&species=dog&sort=oldest&page=2";
  for (const result of [
    "success",
    "pending",
    new ApiError(500, "unavailable"),
  ]) {
    assert.ok(
      state(result, { returnHref }).includes(
        'href="' + returnHref.replaceAll("&", "&amp;") + '"',
      ),
    );
  }
});
test("direct detail component keeps plain catalog fallback", () => {
  assert.ok(state("success").includes('href="/listings"'));
});
