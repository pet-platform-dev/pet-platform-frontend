import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const require = createRequire(import.meta.url);
const modules = new Map();
const dataModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const navigation = dataModule(
  "export function useRouter() { return { push() {} }; }",
);
const link = dataModule(
  `import React from ${JSON.stringify(pathToFileURL(require.resolve("react")).href)}; export default function Link({children,href,scroll,...props}) { return React.createElement("a",{...props,href},children); }`,
);
async function moduleUrl(relative) {
  const full = resolve(relative);
  if (modules.has(full)) return modules.get(full);
  let output = ts.transpileModule(await readFile(full, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  for (const match of [...output.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const dependency = match[1];
    let url;
    if (dependency === "next/navigation") url = navigation;
    else if (dependency === "next/link") url = link;
    else if (dependency.startsWith("@/") || dependency.startsWith(".")) {
      const local = dependency.startsWith("@/")
        ? resolve("src", dependency.slice(2))
        : resolve(dirname(full), dependency);
      const candidates = [local, `${local}.ts`, `${local}.tsx`];
      let source;
      for (const candidate of candidates) {
        try {
          await readFile(candidate);
          source = candidate;
          break;
        } catch {}
      }
      assert.ok(source, `Missing local test module ${dependency}`);
      url = await moduleUrl(source);
    } else if (dependency === "@tanstack/react-query")
      url = pathToFileURL(
        resolve("node_modules/@tanstack/react-query/build/modern/index.js"),
      ).href;
    else url = pathToFileURL(require.resolve(dependency)).href;
    output = output.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = dataModule(output);
  modules.set(full, url);
  return url;
}
async function load(path) {
  return import(await moduleUrl(path));
}
const { listingPrice, listingLocation } = await load(
  "src/entities/listing/model/presentation.ts",
);
const { catalogQuery, catalogHref, catalogPageNumbers } = await load(
  "src/entities/listing/model/catalog-query.ts",
);
const { formatPetAge } = await load("src/shared/lib/format-pet-age.ts");
const { listingsResponseSchema } = await load(
  "src/entities/listing/model/listing.ts",
);
const { ListingCard } = await load("src/entities/listing/ui/listing-card.tsx");
const { ListingSkeletons } = await load(
  "src/entities/listing/ui/listing-skeletons.tsx",
);
const { ListingsCatalog } = await load(
  "src/widgets/listings-catalog/listings-catalog.tsx",
);
const { CatalogPagination } = await load(
  "src/widgets/listings-catalog/catalog-pagination.tsx",
);
const fixture = {
  id: "listing-1",
  type: "SALE",
  status: "ACTIVE",
  title: "Локі шукає родину",
  description: "Опис",
  price: "25000.00",
  currency: "UAH",
  views: 0,
  publishedAt: "2026-10-01T12:00:00.000Z",
  closedAt: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  pet: {
    id: "pet-1",
    name: "Локі",
    gender: "MALE",
    birthDate: "2024-01-01",
    species: { id: "dog", name: "Dog", slug: "dog" },
    breed: {
      id: "breed",
      name: "Belgian Malinois",
      nameUk: null,
      slug: "belgian-malinois",
    },
  },
  location: {
    id: "city",
    countryCode: "UA",
    region: "Кіровоградська область",
    city: "Світловодськ",
    slug: "city-slug",
  },
  seller: {
    id: "owner",
    firstName: "Тест",
    lastName: null,
    role: "USER",
    verificationStatus: "UNVERIFIED",
  },
};
const query = { page: 1, limit: 24, sort: "newest" };
const response = (data = [fixture], total = data.length) => ({
  data,
  meta: { page: 1, limit: 24, total, pages: Math.ceil(total / 24) },
});
function catalog(state) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false } },
  });
  if (state === "error")
    client
      .getQueryCache()
      .build(client, { queryKey: ["listings", query] })
      .setState({
        status: "error",
        error: new Error("secret stack must not render"),
        fetchStatus: "idle",
      });
  else if (state !== "pending") client.setQueryData(["listings", query], state);
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListingsCatalog, { query }),
    ),
  );
  client.clear();
  return html;
}
test("SALE uses uk-UA currency and keeps fractional cents", () => {
  assert.equal(listingPrice(fixture).replaceAll(/\s/g, " "), "25 000 ₴");
  assert.equal(
    listingPrice({ ...fixture, price: "25000.01" }).replaceAll(/\s/g, " "),
    "25 000,01 ₴",
  );
});
test("FREE and ADOPTION display Ukrainian labels without zero currency", () => {
  assert.equal(listingPrice({ type: "FREE", price: null }), "Безкоштовно");
  assert.equal(
    listingPrice({ type: "ADOPTION", price: null }),
    "Прилаштування",
  );
});
test("listing card renders hierarchy, safe location and no detail link", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingCard, { listing: fixture }),
  );
  for (const text of [
    "Локі",
    "Belgian Malinois",
    "Світловодськ",
    "Продаж",
    "Самець",
    "Фото ще не додано",
  ])
    assert.ok(html.includes(text));
  for (const text of [
    "city-slug",
    "ACTIVE",
    "SALE",
    "/listings/listing-1",
    "<img",
  ])
    assert.ok(!html.includes(text));
});
test("card uses trimmed curated breed name with blank fallback", () => {
  for (const nameUk of [null, "", "   ", "  Малінуа  "]) {
    const html = renderToStaticMarkup(
      React.createElement(ListingCard, {
        listing: {
          ...fixture,
          pet: { ...fixture.pet, breed: { ...fixture.pet.breed, nameUk } },
        },
      }),
    );
    assert.ok(html.includes(nameUk?.trim() || "Belgian Malinois"));
  }
});
test("missing breed and age show natural Ukrainian card metadata", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingCard, {
      listing: {
        ...fixture,
        pet: {
          ...fixture.pet,
          breed: null,
          birthDate: null,
          gender: "UNKNOWN",
        },
      },
    }),
  );
  assert.ok(html.includes("Породу не вказано"));
  assert.ok(!html.includes("UNKNOWN"));
  assert.equal(listingLocation({ city: " Київ ", region: "Київ" }), "Київ");
});
test("skeleton cards are hidden from accessibility tree with one loading announcement", () => {
  const html = renderToStaticMarkup(React.createElement(ListingSkeletons));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.equal((html.match(/listing-card listing-skeleton/g) || []).length, 6);
  assert.ok(catalog("pending").includes("listing-skeleton"));
});
test("catalog renders empty state without unavailable feature calls to action", () => {
  const html = catalog(response([]));
  assert.ok(html.includes("Поки що немає активних оголошень"));
  assert.ok(html.includes("Нові оголошення з’являться тут після публікації."));
  assert.ok(!html.includes("Додати оголошення"));
});
test("catalog error shows retry without rendering backend details", () => {
  const html = catalog("error");
  assert.ok(html.includes("Не вдалося завантажити оголошення."));
  assert.ok(html.includes("Спробувати ще раз"));
  assert.ok(!html.includes("secret stack"));
});
test("valid response renders reusable cards and total", () => {
  const html = catalog(response());
  assert.ok(html.includes("listing-card"));
  assert.ok(html.includes("Активних оголошень: 1"));
});
test("URL parsing permits only supported sorts and positive bounded pages", () => {
  assert.deepEqual(catalogQuery({ page: "2", sort: "oldest" }), {
    page: 2,
    limit: 24,
    sort: "oldest",
  });
  for (const page of ["0", "-1", "1.5", "100001", ["1", "2"]])
    assert.equal(catalogQuery({ page }).page, 1);
  assert.equal(catalogQuery({ sort: "price_asc" }).sort, "newest");
  assert.equal(catalogHref(0, "newest"), "/listings?page=1&sort=newest");
});
test("pagination links use URL state and compact numbered windows", () => {
  assert.deepEqual(catalogPageNumbers(1, 8), [1, 2, 3, 4, 5]);
  assert.deepEqual(catalogPageNumbers(8, 8), [4, 5, 6, 7, 8]);
  const html = renderToStaticMarkup(
    React.createElement(CatalogPagination, {
      page: 2,
      pages: 5,
      sort: "oldest",
    }),
  );
  assert.ok(html.includes("page=3&amp;sort=oldest"));
  assert.ok(html.includes('aria-current="page"'));
  assert.ok(html.includes("Наступна сторінка"));
  assert.equal(catalogHref(1, "oldest"), "/listings?page=1&sort=oldest");
});
test("age formats full months and natural Ukrainian year endings", () => {
  const today = new Date("2026-10-08T12:00:00Z");
  for (const [birthDate, expected] of [
    ["2026-07-08", "3 міс."],
    ["2026-09-09", "Менше місяця"],
    ["2025-10-08", "1 рік"],
    ["2024-10-08", "2 роки"],
    ["2021-10-08", "5 років"],
    ["2005-10-08", "21 рік"],
    ["2015-10-08", "11 років"],
  ])
    assert.equal(formatPetAge(birthDate, today), expected);
  for (const birthDate of [null, "bad", "2025-02-29", "2099-01-01"])
    assert.equal(formatPetAge(birthDate, today), null);
});
test("catalog contract validates active nested data, nullable prices and pagination", () => {
  assert.equal(listingsResponseSchema.safeParse(response()).success, true);
  assert.equal(
    listingsResponseSchema.safeParse(
      response([{ ...fixture, type: "FREE", price: null }]),
    ).success,
    true,
  );
  for (const change of [
    { status: "DRAFT" },
    { price: null },
    { type: "FREE" },
    { currency: "USD" },
    { seller: null },
  ])
    assert.equal(
      listingsResponseSchema.safeParse(response([{ ...fixture, ...change }]))
        .success,
      false,
    );
  assert.equal(
    listingsResponseSchema.safeParse({
      ...response(),
      meta: { page: 1, limit: 24, total: 25, pages: 1 },
    }).success,
    false,
  );
});
test("public catalog API retains envelope and sends no Authorization/CSRF", async () => {
  const { getListings } = await load(
    "src/entities/listing/api/get-listings.ts",
  );
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(response()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const data = await getListings({ ...query, page: 2, sort: "oldest" });
    assert.equal(data.data[0].id, fixture.id);
    assert.equal(data.meta.total, 1);
    assert.ok(calls[0].url.endsWith("/listings?page=2&limit=24&sort=oldest"));
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[0].options.headers["X-CSRF-Token"], undefined);
    assert.equal(calls[0].options.cache, "no-store");
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: null }), { status: 200 });
    await assert.rejects(
      getListings(query),
      /Не вдалося завантажити оголошення/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("session expiry cancels private requests while public catalog resolves", async () => {
  const { isSessionQuery } = await load(
    "src/features/auth/session-provider.tsx",
  );
  const client = new QueryClient();
  let finishPublic, finishPrivate;
  const publicResult = client.fetchQuery({
    queryKey: ["listings", query],
    queryFn: () =>
      new Promise((resolve) => {
        finishPublic = resolve;
      }),
  });
  const privateResult = client
    .fetchQuery({
      queryKey: ["my-pets"],
      queryFn: () =>
        new Promise((resolve) => {
          finishPrivate = resolve;
        }),
    })
    .catch(() => undefined);
  await client.cancelQueries({ predicate: isSessionQuery });
  finishPublic(response());
  finishPrivate({ data: ["private-marker"] });
  await publicResult;
  await privateResult;
  assert.equal(client.getQueryData(["listings", query]).data[0].id, fixture.id);
  assert.equal(client.getQueryData(["my-pets"]), undefined);
  client.clear();
});
