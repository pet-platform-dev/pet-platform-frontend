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
function directory(data, state) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false } },
  });
  if (data) client.setQueryData(directoryKey(1), data);
  if (state) {
    const query = client
      .getQueryCache()
      .build(client, { queryKey: directoryKey(1) });
    query.setState({ status: "error", error: new Error("PRIVATE SQL") });
  }
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(BreederDirectory, { page: 1 }),
    ),
  );
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
  assert.deepEqual(directoryKey(2), ["breeder-directory", 2]);
});
test("directory is anonymous, semantic and paginated without fake filters/native selects", () => {
  const html = directory(response);
  assert.ok(html.includes("<h1>Розплідники</h1>"));
  assert.ok(html.includes('href="/breeders?page=2"'));
  assert.ok(!html.includes("<select"));
  assert.ok(!html.includes("<input"));
  assert.ok(!html.includes("Увійдіть"));
});
test("empty and out-of-range states are honest, errors are safe and retry is accessible", () => {
  const empty = directory({
    data: [],
    meta: { page: 1, limit: 24, total: 0, pages: 0 },
  });
  assert.ok(empty.includes("Розплідників поки немає"));
  assert.ok(!empty.includes("фільтр"));
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
  assert.equal((html.match(/breeder-directory-skeleton/g) || []).length, 6);
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
    assert.ok(String(url).endsWith("/breeders?page=1&limit=24"));
    assert.ok(!options.headers.Authorization);
    assert.ok(options.signal);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    assert.equal((await getBreederDirectory(1, signal)).data.length, 1);
    assert.equal(calls, 1);
    await assert.rejects(() => getBreederDirectory(0), /Некоректна сторінка/);
  } finally {
    globalThis.fetch = original;
  }
});
