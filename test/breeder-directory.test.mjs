import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
} from "../node_modules/@tanstack/react-query/build/modern/index.js";
import { load } from "./helpers/load-frontend.mjs";
const {
  breederDirectorySchema,
  directoryKey,
  directoryPage,
  getBreederDirectory,
} = await load("src/entities/breeder/directory.ts");
const { BreederCard } = await load("src/features/breeders/breeder-card.tsx");
const { BreederDirectory } = await load(
  "src/features/breeders/breeder-directory.tsx",
);
const { BreederDirectorySkeleton } = await load(
  "src/features/breeders/breeder-directory-skeleton.tsx",
);
const { MobileNavigation } = await load(
  "src/widgets/header/mobile-navigation.tsx",
);
const { navigationActive } = await load(
  "src/widgets/header/navigation-active.ts",
);
const card = {
  userId: "11111111-1111-4111-8111-111111111111",
  kennelName: "ДужеДовгаНазва".repeat(10),
  description: "Турбота про тварин",
  location: { city: "Світловодськ", region: "Кіровоградська область" },
  logo: null,
  breedCount: 1,
  species: ["dog"],
  breeds: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Malinois",
      nameUk: "Малінуа",
      species: "dog",
    },
  ],
};
const response = {
  data: [card],
  meta: { page: 1, limit: 24, total: 25, pages: 2 },
};
const render = (component) => renderToStaticMarkup(component);
function directory(data, state, initial = { page: 1 }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, gcTime: 0 },
    },
  });
  if (data) client.setQueryData(directoryKey(initial), data);
  if (state) {
    const query = client
      .getQueryCache()
      .build(client, { queryKey: directoryKey(initial) });
    query.setState({ status: "error", error: new Error("PRIVATE SQL") });
  }
  const html = render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(BreederDirectory, { initial }),
    ),
  );
  client.clear();
  return html;
}
test("public card keeps kennel identity, canonical profile link, safe fallback and Ukrainian breed/location", () => {
  const html = render(React.createElement(BreederCard, { breeder: card }));
  assert.ok(html.includes(`/sellers/${card.userId}`));
  for (const value of [
    card.kennelName,
    "Світловодськ",
    "Кіровоградська область",
    "Малінуа",
    "Переглянути розплідник",
  ])
    assert.ok(html.includes(value));
  assert.ok(html.includes("breeder-directory-avatar"));
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.ok(!html.includes("<button"));
});
test("discovery chips show two public breeds with exact +N and complete mixed-species context", () => {
  const many = {
    ...card,
    breedCount: 5,
    species: ["cat", "dog"],
    breeds: [
      card.breeds[0],
      { ...card.breeds[0], id: card.userId, nameUk: "Німецька вівчарка" },
      {
        ...card.breeds[0],
        id: "33333333-3333-4333-8333-333333333333",
        nameUk: "Третя порода",
      },
    ],
  };
  const html = render(React.createElement(BreederCard, { breeder: many }));
  assert.ok(html.includes("Собаки та коти"));
  assert.ok(html.includes("Німецька вівчарка"));
  assert.ok(!html.includes("Третя порода"));
  assert.ok(html.includes(">+3</li>"));
  assert.ok(html.includes("Інші породи у профілі: 3"));
  assert.ok(html.includes('aria-label="Породи розплідника"'));
});
test("sparse cards omit absent content; logo space is reserved and images stay lazy/decorative", () => {
  const sparse = render(
    React.createElement(BreederCard, {
      breeder: {
        ...card,
        description: null,
        location: null,
        breeds: [],
        breedCount: 0,
        species: [],
      },
    }),
  );
  assert.ok(!sparse.includes("breeder-directory-description"));
  assert.ok(!sparse.includes("breeder-directory-location"));
  assert.ok(!sparse.includes("Породи розплідника"));
  assert.ok(!sparse.includes(">+"));
  const image = render(
    React.createElement(BreederCard, {
      breeder: {
        ...card,
        logo: {
          url: "https://res.cloudinary.com/fixture/image/upload/logo.png",
        },
      },
    }),
  );
  for (const value of [
    'width="56"',
    'height="56"',
    'loading="lazy"',
    'alt=""',
    "breeder-directory-logo",
  ])
    assert.ok(image.includes(value));
});
test("card clamps have full accessible names and matching noninteractive skeleton structure", () => {
  const html = render(
    React.createElement(BreederCard, {
      breeder: { ...card, description: "Повний опис ".repeat(20) },
    }),
  );
  assert.ok(
    html.includes('aria-label="Переглянути розплідник ' + card.kennelName),
  );
  const skeleton = render(React.createElement(BreederDirectorySkeleton));
  for (const value of [
    "breeder-directory-logo",
    "breeder-directory-location",
    "breeder-directory-species",
    "breeder-directory-breeds",
    "breeder-directory-description",
    "breeder-directory-cta",
  ])
    assert.ok(skeleton.includes(value));
  assert.ok(!skeleton.includes("<a ") && !skeleton.includes("<button"));
});
test("result summary uses the existing count with Ukrainian plural forms", async () => {
  const { breederCountLabel } = await load("src/entities/breeder/directory.ts");
  for (const [n, word] of [
    [0, "розплідників"],
    [1, "розплідник"],
    [2, "розплідники"],
    [5, "розплідників"],
    [11, "розплідників"],
    [21, "розплідник"],
  ])
    assert.equal(breederCountLabel(n), `Знайдено ${n} ${word}`);
});

const { parseDirectoryQuery, directoryHref, changeDirectorySpecies } =
  await load("src/entities/breeder/directory-query.ts");
test("filter URLs normalize invalid/repeated params and omit defaults", () => {
  assert.equal(
    directoryHref(
      parseDirectoryQuery(
        new URLSearchParams(
          "q=++&species=DOG&breedId=bad&locationId=bad&page=0&sort=name",
        ),
      ),
    ),
    "/breeders",
  );
  assert.equal(
    directoryHref(
      parseDirectoryQuery(new URLSearchParams("q=a&q=b&page=2&page=3")),
    ),
    "/breeders",
  );
  const q = {
    q: "Роял",
    species: "dog",
    breedId: card.breeds[0].id,
    locationId: card.userId,
    page: 2,
  };
  assert.deepEqual(
    parseDirectoryQuery(
      new URL(directoryHref(q), "http://localhost").searchParams,
    ),
    q,
  );
  assert.ok(directoryHref(q).includes("page=2"));
  assert.notDeepEqual(directoryKey(q), directoryKey({ ...q, q: "new" }));
  assert.notDeepEqual(
    directoryKey(q),
    directoryKey({ ...q, locationId: undefined }),
  );
});
test("species changes clear only incompatible breed and always reset pagination", () => {
  const q = { page: 2, species: "dog", breedId: card.breeds[0].id };
  assert.equal(changeDirectorySpecies(q, "cat", false).breedId, undefined);
  assert.equal(changeDirectorySpecies(q, "dog", true).breedId, q.breedId);
  assert.equal(changeDirectorySpecies(q, undefined, false).breedId, q.breedId);
  assert.equal(changeDirectorySpecies(q, "cat", false).page, 1);
});
test("filtered empty differs from globally empty and pagination keeps filters", () => {
  const initial = { q: "Роял", species: "dog", page: 1 };
  const empty = {
    data: [],
    meta: { page: 1, limit: 24, total: 0, pages: 0, hasPublicBreeders: true },
  };
  const html = directory(empty, false, initial);
  assert.ok(html.includes("Розплідників за цими параметрами не знайдено"));
  assert.ok(html.includes("Спробуйте змінити або скинути фільтри."));
  assert.ok(html.includes("Скинути фільтри"));
  assert.ok(
    directory(
      { ...empty, meta: { ...empty.meta, hasPublicBreeders: false } },
      false,
      initial,
    ).includes("Розплідників поки немає"),
  );
  const results = directory(response, false, initial);
  assert.ok(results.includes("species=dog&amp;page=2"));
  for (const label of [
    "Пошук",
    "Вид тварини",
    "Порода",
    "Місто",
    "Усі породи",
    "Усі міста",
  ])
    assert.ok(results.includes(label));
  assert.ok(!results.includes("<select"));
  assert.ok(!results.includes("Animal type"));
});
test("directory schema bounds and strips private fields; pagination parser is strict", () => {
  const safe = breederDirectorySchema.parse({
    ...response,
    data: [{ ...card, email: "PRIVATE", pets: ["HIDDEN"] }],
  });
  assert.ok(!JSON.stringify(safe).includes("PRIVATE"));
  assert.ok(!JSON.stringify(safe).includes("HIDDEN"));
  assert.equal(
    breederDirectorySchema.safeParse({
      ...response,
      data: Array(25).fill(card),
    }).success,
    false,
  );
  assert.equal(
    breederDirectorySchema.safeParse({
      ...response,
      meta: { ...response.meta, pages: 99 },
    }).success,
    false,
  );
  for (const value of [undefined, "0", "-1", "1.5", "1e2", "100001", ["2"]])
    assert.equal(directoryPage(value), 1);
  assert.equal(directoryPage("2"), 2);
  assert.deepEqual(directoryKey({ page: 2 }), ["breeder-directory", "page=2"]);
});
test("directory is anonymous, semantic and paginated without fake filters/native selects", () => {
  const html = directory(response);
  assert.ok(html.includes("<h1>Розплідники</h1>"));
  assert.ok(html.includes('href="/breeders?page=2"'));
  assert.ok(!html.includes("<select"));
  assert.ok(html.includes('placeholder="Назва розплідника"'));
  assert.ok(!html.includes("Увійдіть"));
});
test("empty and out-of-range states are honest, errors are safe and retry is accessible", () => {
  const empty = directory({
    data: [],
    meta: { page: 1, limit: 24, total: 0, pages: 0 },
  });
  assert.ok(empty.includes("Розплідників поки немає"));
  assert.ok(!empty.includes("за цими параметрами"));
  const outside = directory({ ...response, data: [] });
  assert.ok(outside.includes("До першої сторінки"));
  const error = directory(null, true);
  assert.ok(error.includes("Не вдалося завантажити розплідники."));
  assert.ok(error.includes("Спробувати ще раз"));
  assert.ok(!error.includes("PRIVATE SQL"));
});
test("loading skeleton is noninteractive and not noisy", () => {
  const html = render(React.createElement(BreederDirectorySkeleton));
  assert.ok(html.includes('role="status"'));
  assert.ok(html.includes('aria-hidden="true"'));
  assert.equal(
    (html.match(/breeder-directory-card breeder-directory-skeleton/g) || [])
      .length,
    6,
  );
  assert.ok(!html.includes("<a "));
  assert.ok(directory().includes("Завантажуємо розплідники"));
});
test("anonymous and signed-in mobile menus include directory after mating with segment-aware active state", () => {
  for (const authenticated of [true, false]) {
    const html = render(
      React.createElement(MobileNavigation, {
        authenticated,
        pending: false,
        pathname: "/breeders",
      }),
    );
    assert.ok(
      html.indexOf('href="/mating"') < html.indexOf('href="/breeders"'),
    );
    assert.ok(
      html
        .match(/<a[^>]+>/g)
        .find((tag) => tag.includes('href="/breeders"'))
        .includes('aria-current="page"'),
    );
  }
  assert.ok(navigationActive("/breeders", "/breeders"));
  assert.ok(navigationActive("/breeders/example", "/breeders"));
  assert.ok(!navigationActive("/breeders-other", "/breeders"));
  assert.ok(!navigationActive("/sellers/example", "/account"));
});
test("directory request is public, bounded, cancellable and never requests per-card data", async () => {
  const original = globalThis.fetch;
  const signal = new AbortController().signal;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.ok(String(url).endsWith("/breeders?limit=24"));
    assert.ok(!options.headers.Authorization);
    assert.ok(options.signal);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    assert.equal(
      (await getBreederDirectory({ page: 1 }, signal)).data.length,
      1,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      () => getBreederDirectory({ page: 0 }),
      /Некоректна сторінка/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
