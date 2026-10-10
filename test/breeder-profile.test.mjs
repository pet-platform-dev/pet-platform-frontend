import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { breederSchema, breederTitle } = await load(
  "src/entities/breeder/model.ts",
);
const { sellerSchema, sellerIdentity } = await load(
  "src/entities/seller/model.ts",
);
const { BreederProfilePage } = await load(
  "src/features/breeder/public-profile/breeder-profile-page.tsx",
);
const { BreederProfileSkeleton } = await load(
  "src/features/breeder/public-profile/breeder-profile-skeleton.tsx",
);
const { ProfileError } = await load(
  "src/widgets/seller-profile/profile-error.tsx",
);
const { SellerProfile } = await load(
  "src/widgets/seller-profile/seller-profile.tsx",
);
const { SellerCard } = await load("src/entities/seller/seller-card.tsx");
const { ApiError } = await load("src/shared/api/client.ts");
const id = "11111111-1111-4111-8111-111111111111";
const seller = {
  id,
  displayName: "Олександр Єпік",
  location: null,
  phone: null,
  telegram: null,
  viber: null,
  whatsapp: null,
  memberSince: "2026-10-10T00:00:00Z",
};
const profile = {
  media: { logo: null, cover: null, gallery: [], videos: [] },
  userId: id,
  kennelName: "Royal Malinois",
  description: "Любимо тварин.\nРозводимо собак і котів.",
  location: {
    id,
    countryCode: "UA",
    city: "Світловодськ",
    region: "Кіровоградська область",
    slug: "svitlovodsk",
  },
  startedYear: 2018,
  website: "https://example.com/",
  breeds: [
    {
      id,
      name: "Malinois",
      nameUk: "Малінуа",
      slug: "malinois",
      isActive: true,
      species: { id, name: "Dog", slug: "dog" },
    },
  ],
  contactPerson: seller,
};
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
function publicPage(initialSeller, initialBreeder, setup = () => {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  setup(client);
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(SellerProfile, { id, initialSeller, initialBreeder }),
    ),
  );
  client.clear();
  return html;
}
test("safe breeder contract strips injected private/owner/provider fields", () => {
  const data = breederSchema.parse({
    ...profile,
    email: "secret@example.invalid",
    id: "private",
    contactPerson: {
      ...seller,
      email: "private@example.invalid",
      role: "ADMIN",
    },
    breeds: [{ ...profile.breeds[0], externalId: "private" }],
  });
  assert.deepEqual(data, profile);
  assert.ok(!JSON.stringify(data).includes("email"));
});
test("SELLER and incomplete BREEDER preserve full-name fallback", () => {
  for (const breeder of [undefined, null]) {
    const html = publicPage({ ...seller, breeder }, null);
    assert.ok(html.includes("<h1>Олександр Єпік</h1>"));
    assert.ok(html.includes("Оголошення продавця"));
    assert.ok(!html.includes("Приватний продавець"));
  }
});
test("profile uses kennel h1, secondary full owner name and all optional domain sections", () => {
  const html = render(BreederProfilePage, { profile });
  for (const text of [
    "<h1>Royal Malinois</h1>",
    "Контактна особа: Олександр Єпік",
    "Про розплідник",
    "Світловодськ",
    "Кіровоградська область",
    "Малінуа",
    "Працює з 2018 року",
    "Вебсайт",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes("Любимо тварин."));
  assert.ok(!html.includes("yearsOfExperience"));
  assert.ok(!html.includes("filter"));
});
test("website has safe new-tab attributes and accessible label", () => {
  const html = render(BreederProfilePage, { profile });
  assert.ok(html.includes('href="https://example.com/"'));
  assert.ok(html.includes('target="_blank"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('aria-label="Вебсайт розплідника'));
});
for (const website of [
  "javascript:alert(1)",
  "data:text/html,test",
  "ftp://example.com",
  "https://name:secret@example.com",
  "https://example.com/white space",
  "https://example.com/" + "x".repeat(2050),
])
  test("rejects unsafe website " + website.slice(0, 30), () =>
    assert.equal(
      breederSchema.safeParse({ ...profile, website }).success,
      false,
    ),
  );
test("omits empty description/breeds/website/experience/contacts sections", () => {
  const html = render(BreederProfilePage, {
    profile: {
      ...profile,
      description: null,
      breeds: [],
      startedYear: null,
      website: null,
      location: null,
    },
  });
  for (const text of [
    "Про розплідник",
    "<h2>Породи</h2>",
    "<h2>Досвід</h2>",
    "<h2>Вебсайт</h2>",
    "<h2>Контакти</h2>",
  ])
    assert.ok(!html.includes(text), text);
  assert.ok(!html.includes("<button"));
});
for (const [field, value, label] of [
  ["phone", "+380501234567", "Показати телефон"],
  ["telegram", "fixture_user", "Telegram"],
  ["viber", "+380501234568", "Viber"],
  ["whatsapp", "+380501234569", "WhatsApp"],
])
  test("reuses optional contact " + field, () => {
    const html = render(BreederProfilePage, {
      profile: { ...profile, contactPerson: { ...seller, [field]: value } },
    });
    assert.ok(html.includes(label));
    assert.ok(!html.includes("email"));
  });
test("listing seller card chooses kennel identity without lookup; keeps stable profile link", () => {
  const enriched = sellerSchema.parse({
    ...seller,
    breeder: { kennelName: profile.kennelName },
  });
  const html = render(SellerCard, { seller: enriched });
  assert.equal(sellerIdentity(enriched), profile.kennelName);
  assert.equal(sellerIdentity(seller), seller.displayName);
  assert.ok(html.includes("Royal Malinois"));
  assert.ok(html.includes("Олександр Єпік"));
  assert.ok(html.includes("/sellers/" + id));
  assert.ok(html.includes("Переглянути профіль"));
});
test("breeder profile renders own empty ACTIVE-only listing state", () => {
  const html = publicPage(
    { ...seller, breeder: { kennelName: profile.kennelName } },
    profile,
    (client) =>
      client.setQueryData(["seller-listings", id], {
        pages: [{ data: [], meta: { page: 1, pages: 0, total: 0, limit: 24 } }],
        pageParams: [1],
      }),
  );
  assert.ok(html.includes("Оголошення розплідника"));
  assert.ok(
    html.includes("У цього розплідника поки немає активних оголошень."),
  );
  assert.ok(!html.includes("Оголошення продавця"));
});
test("404 full-profile race falls back safely rather than crashing", () => {
  const html = publicPage(
    { ...seller, breeder: { kennelName: profile.kennelName } },
    null,
  );
  assert.ok(html.includes("<h1>Олександр Єпік</h1>"));
});
test("loading exposes a readable status with decorative skeleton", () => {
  const html = render(BreederProfileSkeleton, {});
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.ok(html.includes("Завантажуємо профіль"));
});
test("not-found has no retry; other errors are neutral and retryable", () => {
  const missing = render(ProfileError, {
      error: new ApiError(404, "PRIVATE"),
      retry() {},
    }),
    failed = render(ProfileError, {
      error: new Error("PRIVATE_SQL"),
      retry() {},
    });
  assert.ok(missing.includes("Продавця не знайдено"));
  assert.ok(!missing.includes("<button"));
  assert.ok(failed.includes("Спробувати ще раз"));
  assert.ok(!failed.includes("PRIVATE_SQL"));
});
test("metadata follows kennel identity", () =>
  assert.equal(
    breederTitle(profile.kennelName),
    "Royal Malinois — профіль розплідника",
  ));
test("profile projection contains no visible internal identifiers", () => {
  const html = render(BreederProfilePage, { profile });
  assert.ok(!html.includes(id));
});

test("fresh shared seller contacts take precedence over a stale breeder contact snapshot", () => {
  const html = publicPage(
    {
      ...seller,
      telegram: "fresh_contact",
      breeder: { kennelName: profile.kennelName },
    },
    { ...profile, contactPerson: { ...seller, telegram: "old_contact" } },
  );
  assert.ok(html.includes("https://t.me/fresh_contact"));
  assert.ok(!html.includes("old_contact"));
});
