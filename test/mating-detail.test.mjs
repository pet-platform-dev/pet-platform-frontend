import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup as renderRaw } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";
import { load } from "./helpers/load-frontend.mjs";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row = {
  id,
  status: "ACTIVE",
  title: "Оголошення",
  description: "Перший рядок\nДругий рядок",
  fee: null,
  currency: "UAH",
  createdAt: "2026-01-01",
  location: {
    id,
    countryCode: "UA",
    city: "Київ",
    region: "Київська область",
    slug: "kyiv",
    district: null,
    community: null,
    settlementType: null,
  },
  pet: {
    id,
    name: "Рекс",
    gender: "MALE",
    birthDate: "2020-01-02",
    species: { id, name: "Собака", slug: "dog" },
    breed: { id, name: "Malinois", nameUk: "Малінуа", slug: "malinois" },
    profileImage: null,
  },
  owner: { id: ownerId, displayName: "Олександр Єпік" },
};
const seller = {
  id: ownerId,
  displayName: "Олександр Єпік",
  breeder: null,
  location: null,
  phone: null,
  telegram: null,
  viber: null,
  whatsapp: null,
  memberSince: "2020-01-01",
};
async function detail(overrides = {}) {
  assert.ok(
    existsSync("src/features/mating/detail/content.tsx"),
    "public mating detail content must exist",
  );
  const { MatingDetailContent } = await load(
    "src/features/mating/detail/content.tsx",
  );
  return renderToStaticMarkup(
    React.createElement(MatingDetailContent, {
      detail: { row, seller, petProfileHref: null, ...overrides },
      isOwner: false,
    }),
  );
}
test("ACTIVE detail presents breed, optional name, gender, age, location and description", async () => {
  const html = await detail();
  for (const text of [
    "Малінуа",
    "Рекс",
    "Хлопчик",
    "Київ",
    "Київська область",
    "Про тварину та умови в’язки",
    "Перший рядок\nДругий рядок",
    "Олександр Єпік",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Без імені|mailto:|Редагувати оголошення/);
  assert.match(html, /href="\/sellers\//);
});
test("unnamed Pet omits name rather than manufacturing a name", async () => {
  const html = await detail({
    row: { ...row, pet: { ...row.pet, name: null } },
  });
  assert.doesNotMatch(html, /Без імені|Ім’я:/);
});
for (const [fee, label] of [
  [null, "За домовленістю"],
  ["0.00", "Безкоштовно"],
  ["1234.56", "1 234,56 ₴"],
]) {
  test("detail displays exact fee " + label, async () =>
    assert.ok((await detail({ row: { ...row, fee } })).includes(label)),
  );
}
test("breeder identity uses kennel name with full contact name secondary", async () => {
  const html = await detail({
    seller: { ...seller, breeder: { kennelName: "Розплідник Сонце" } },
  });
  assert.ok(html.indexOf("Розплідник Сонце") < html.indexOf("Олександр Єпік"));
});
test("configured contacts only, email absent, text is escaped", async () => {
  const html = await detail({
    seller: {
      ...seller,
      telegram: "contact_pet",
      whatsapp: "+380501234567",
      email: "private@example.test",
    },
    row: { ...row, description: "<script>alert(1)</script>" },
  });
  assert.match(html, /t\.me\/contact_pet/);
  assert.match(html, /wa\.me\/380501234567/);
  assert.doesNotMatch(
    html,
    /Показати телефон|viber:\/\/|private@example|<script>/,
  );
  assert.match(html, /&lt;script&gt;/);
});
test("public Pet CTA depends on confirmed public availability", async () => {
  assert.doesNotMatch(await detail(), /Переглянути профіль тварини/);
  assert.match(
    await detail({ petProfileHref: "/pets/" + id }),
    /Переглянути профіль тварини/,
  );
});
test("owner gets edit action and no self contact controls", async () => {
  assert.ok(existsSync("src/features/mating/detail/content.tsx"));
  const { MatingDetailContent } = await load(
    "src/features/mating/detail/content.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(MatingDetailContent, {
      detail: {
        row,
        seller: { ...seller, phone: "+380501234567", telegram: "contact_pet" },
        petProfileHref: null,
      },
      isOwner: true,
    }),
  );
  assert.match(html, /Редагувати оголошення/);
  assert.match(html, /\/edit/);
  assert.doesNotMatch(html, /Показати телефон|Зв’язатися з власником|t\.me/);
});
test("unresolved session hides contacts without granting owner edit action", async () => {
  const { MatingDetailContent } = await load(
    "src/features/mating/detail/content.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(MatingDetailContent, {
      detail: {
        row,
        seller: { ...seller, phone: "+380501234567" },
        petProfileHref: null,
      },
      isOwner: false,
      contactsReady: false,
    }),
  );
  assert.doesNotMatch(
    html,
    /Редагувати оголошення|Показати телефон|Зв’язатися з власником/,
  );
});
test("detail schema strips private data and rejects inactive statuses", async () => {
  const { publicMatingDetailSchema } = await load(
    "src/entities/mating-listing/model.ts",
  );
  assert.ok(
    publicMatingDetailSchema,
    "separate public detail allowlist is required",
  );
  const parsed = publicMatingDetailSchema.parse({
    ...row,
    email: "secret",
    publishedAt: "private",
    pet: { ...row.pet, notes: "private" },
  });
  assert.equal(parsed.description, row.description);
  assert.ok(
    !("email" in parsed) &&
      !("publishedAt" in parsed) &&
      !("notes" in parsed.pet),
  );
  for (const status of ["DRAFT", "CLOSED", "ARCHIVED", "HIDDEN"])
    assert.equal(
      publicMatingDetailSchema.safeParse({ ...row, status }).success,
      false,
    );
});
test("mating return context survives detail URL, rejects external and private routes", async () => {
  assert.ok(existsSync("src/features/mating/detail/navigation.ts"));
  const { safeMatingReturn, matingDetailHref } = await load(
    "src/features/mating/detail/navigation.ts",
  );
  const query = {
    page: 2,
    limit: 24,
    sort: "price_desc",
    species: "dog",
    ageMinMonths: 24,
  };
  const target = new URL(
    matingDetailHref(id, query),
    "https://local.test",
  ).searchParams.get("returnTo");
  assert.equal(
    safeMatingReturn(target),
    "/mating?species=dog&ageMinMonths=24&sort=price_desc&page=2",
  );
  for (const value of [
    undefined,
    ["/mating"],
    "https://evil.test",
    "//evil.test",
    "/mating/my",
    "/mating/../admin",
    "/mating?x=1#bad",
    "/mating\\evil",
  ])
    assert.equal(safeMatingReturn(value), "/mating");
});
test("public detail key cannot cross into owner-private namespace", async () => {
  const { matingKeys } = await load("src/features/mating/cache.ts");
  assert.ok(matingKeys.publicDetail);
  assert.deepEqual(matingKeys.publicDetail(id), [
    "mating-public",
    "detail",
    id,
  ]);
  assert.notDeepEqual(
    matingKeys.publicDetail(id),
    matingKeys.detail(ownerId, id),
  );
});
test("route includes standard safe not-found, metadata and loading boundary", () => {
  const path = "src/app/mating/[id]/page.tsx";
  assert.ok(existsSync(path), "public detail route is required");
  const source = readFileSync(path, "utf8");
  assert.match(source, /notFound\(/);
  assert.match(source, /generateMetadata/);
  assert.ok(existsSync("src/app/mating/[id]/loading.tsx"));
});
test("detail has accessible stable loading and retryable error states", async () => {
  const { MatingDetail } = await load("src/features/mating/detail/detail.tsx");
  const loading = renderToStaticMarkup(
    React.createElement(MatingDetail, { id }),
  );
  assert.match(loading, /role="status"/);
  assert.match(loading, /listing-detail-skeleton/);
  const error = renderToStaticMarkup(
    React.createElement(MatingDetail, { id, initialFailed: true }),
  );
  assert.match(error, /role="alert"/);
  assert.match(error, /Спробувати ще раз/);
  assert.doesNotMatch(error, /Перший рядок/);
});

test("fresh public mating detail renders server content with production query defaults", async () => {
  const { MatingDetail } = await load("src/features/mating/detail/detail.tsx");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["current-user"], null);
  try {
    const markup = renderRaw(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(MatingDetail, {
          id,
          initialData: { row, seller, petProfileHref: null },
        }),
      ),
    );
    assert.match(markup, /Про тварину та умови в’язки/);
    assert.match(markup, /Перший рядок/);
    assert.doesNotMatch(markup, /listing-detail-skeleton/);
  } finally {
    client.clear();
  }
});
test("failed server load overrides pre-existing public cache and presents Retry", async () => {
  const { MatingDetail } = await load("src/features/mating/detail/detail.tsx");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["current-user"], null);
  client.setQueryData(["mating-public", "detail", id], {
    row,
    seller,
    petProfileHref: null,
  });
  try {
    const html = renderRaw(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(MatingDetail, { id, initialFailed: true }),
      ),
    );
    assert.match(html, /Спробувати ще раз/);
    assert.doesNotMatch(html, /Перший рядок|Зв’язатися з власником/);
  } finally {
    client.clear();
  }
});
test("each failed server response starts a fresh detail failure gate, including route refresh", async () => {
  const { default: Page } = await load("src/app/mating/[id]/page.tsx");
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ message: "Unavailable" }, { status: 503 });
  try {
    const props = {
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    };
    const first = await Page(props),
      second = await Page(props);
    assert.equal(first.props.initialFailed, true);
    assert.ok(first.key, "failed server render must reset the client observer");
    assert.notEqual(
      first.key,
      second.key,
      "repeated failures cannot retain a previously recovered gate",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("public detail loader bounds contacts/Pet lookups and handles private Pet visibility", async () => {
  const { getMatingDetailData } = await load(
    "src/features/mating/detail/data.ts",
  );
  const original = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    paths.push(path);
    if (path.endsWith("/mating-listings/" + id + "/public"))
      return Response.json({ data: row });
    if (path.endsWith("/sellers/" + ownerId))
      return Response.json({
        data: { ...seller, breeder: { kennelName: "Розплідник Сонце" } },
      });
    return Response.json(
      { message: "Профіль тварини не знайдено" },
      { status: 404 },
    );
  };
  try {
    const detail = await getMatingDetailData(id);
    assert.equal(detail.petProfileHref, null);
    assert.equal(detail.seller.displayName, "Олександр Єпік");
    assert.deepEqual(paths, [
      "/api/v1/mating-listings/" + id + "/public",
      "/api/v1/sellers/" + ownerId,
      "/api/v1/pets/" + id + "/public",
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
