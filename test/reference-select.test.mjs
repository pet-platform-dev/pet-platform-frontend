import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
} from "../node_modules/@tanstack/react-query/build/modern/index.js";
import { load } from "./helpers/load-frontend.mjs";
const { LargeReferenceSelect } = await load(
  "src/shared/ui/large-reference-select.tsx",
);
const { BreedSelector } = await load("src/features/pet/breed-selector.tsx");
const { LocationSelector, locationContext } = await load(
  "src/entities/location/location-selector.tsx",
);
const { getLocations } = await load("src/entities/location/api.ts");
const location = {
  id: "30f10481-3101-55c9-a61a-4360a51b9da2",
  city: "Світловодськ",
  countryCode: "UA",
  region: "Кіровоградська область",
  district: "Олександрійський",
  community: "Світловодська",
  settlementType: "CITY",
  katottgCode: "UA35080170010073614",
};
const render = (component) =>
  renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      {
        client: new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        }),
      },
      component,
    ),
  );
test("shared generic reference combobox exposes linked hint, error and selected item without pagination", () => {
  const html = render(
    React.createElement(LargeReferenceSelect, {
      label: "Довідник",
      hint: "Підказка",
      placeholder: "Пошук",
      queryKey: ["fixture"],
      fetchPage: () => {
        throw Error("must not eagerly fetch");
      },
      itemLabel: (item) => item.name,
      selected: { id: "selected", name: "Вибране" },
      onSelect() {},
      error: "Оберіть значення",
    }),
  );
  for (const text of [
    'role="combobox"',
    'aria-autocomplete="list"',
    'aria-expanded="false"',
    'aria-invalid="true"',
    "aria-describedby",
    "Обрано:",
    "Вибране",
    "Очистити довідник",
    "Оберіть значення",
  ])
    assert.ok(html.includes(text));
  assert.ok(
    !html.includes("Наступна сторінка") && !html.includes("breed-pagination"),
  );
});
test("Breed adapter requires species, preserves translated selection and inactive edit context", () => {
  const disabled = render(
    React.createElement(BreedSelector, {
      onSelect() {},
      onSearching() {},
      selected: null,
    }),
  );
  assert.ok(disabled.includes('disabled=""'));
  assert.ok(disabled.includes("Спочатку оберіть вид тварини"));
  const selected = render(
    React.createElement(BreedSelector, {
      species: "dog",
      selected: {
        id: "breed",
        name: "Malinois",
        nameUk: " Малінуа ",
        isActive: false,
      },
      onSelect() {},
      onSearching() {},
    }),
  );
  assert.ok(selected.includes("Малінуа"));
  assert.ok(selected.includes("Недоступна для нового вибору"));
});
test("Location adapter renders official contextual selection, two-character search hint and clear control", () => {
  const html = render(
    React.createElement(LocationSelector, {
      selected: location,
      onSelect() {},
    }),
  );
  for (const text of [
    "Введіть назву міста або села",
    "Світловодськ",
    "Кіровоградська область",
    "Олександрійський район",
    "Світловодська громада",
    "щонайменше 2 символи",
    "Очистити місце",
  ])
    assert.ok(html.includes(text));
  assert.ok(!html.includes("або області"));
  assert.ok(!html.includes(location.katottgCode));
  assert.ok(!html.includes(location.id));
});
test("same-name Locations have distinct region/community display context; missing hierarchy remains honest", () => {
  assert.notEqual(
    locationContext(location),
    locationContext({ ...location, region: "Інша область", community: "Інша" }),
  );
  assert.equal(
    locationContext({
      ...location,
      region: "Київ",
      district: null,
      community: null,
    }),
    "Місто · Київ",
  );
  assert.equal(
    locationContext({
      ...location,
      settlementType: null,
      region: "Ручне",
      district: null,
      community: null,
    }),
    "Ручне",
  );
});
test("location API validates bounded paginated envelope and uses our public endpoint without auth", async () => {
  const saved = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        data: [location],
        meta: { page: 2, limit: 50, total: 51, pages: 2 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const result = await getLocations("сві", 2);
    assert.deepEqual(result.data, [location]);
    assert.equal(result.meta.page, 2);
    const url = new URL(calls[0].url);
    assert.equal(url.hostname, "localhost");
    assert.equal(url.searchParams.get("search"), "сві");
    assert.equal(url.searchParams.get("limit"), "50");
    assert.equal(url.searchParams.get("page"), "2");
    assert.ok(!calls[0].options.headers.Authorization);
    assert.ok(!calls[0].options.headers["X-CSRF-Token"]);
  } finally {
    globalThis.fetch = saved;
  }
});
test("location API rejects malformed reference/page contracts rather than offering invalid IDs", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: [{ ...location, id: "bad" }],
        meta: { page: 1, limit: 50, total: 1, pages: 1 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  try {
    await assert.rejects(() => getLocations("сві"));
  } finally {
    globalThis.fetch = saved;
  }
});
