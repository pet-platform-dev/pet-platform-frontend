import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { emptyFilters, filterReducer, filtersToQuery, agePresets, hasFilters } =
  await load("src/features/listing/filters/model.ts");
const { priceErrors, resultCount } = await load(
  "src/features/listing/filters/price-validation.ts",
);
const { serializeCatalogQuery, listingsQueryKey, catalogSorts } = await load(
  "src/entities/listing/model/catalog-query.ts",
);
const { ListingFiltersPanel } = await load(
  "src/features/listing/filters/listing-filters-panel.tsx",
);
const { CatalogSearchSort } = await load(
  "src/widgets/listings-catalog/catalog-search-sort.tsx",
);
const { CatalogResults } = await load(
  "src/widgets/listings-catalog/catalog-results.tsx",
);
const initial = () => ({ filters: emptyFilters(), page: 5, sort: "oldest" });
const change = (state, field, value) =>
  filterReducer(state, { kind: "filter", update: { field, value } });
const breed = {
  id: "breed-id",
  name: "Malinois",
  nameUk: "Малінуа",
  species: "dog",
};
const location = {
  id: "location-id",
  city: "Світловодськ",
  region: "Кіровоградська область",
  district: null,
  community: null,
  settlementType: "CITY",
  katottgCode: null,
  countryCode: "UA",
};
for (const [field, value, key] of [
  ["species", "dog", "species"],
  ["species", "cat", "species"],
  ["breeds", [breed], "breedIds"],
  ["locations", [location], "locationIds"],
  ["type", "SALE", "type"],
  ["type", "FREE", "type"],
  ["type", "ADOPTION", "type"],
  ["gender", "MALE", "gender"],
  ["gender", "FEMALE", "gender"],
  ["gender", "UNKNOWN", "gender"],
]) {
  test(`${field} ${typeof value === "string" ? value : key} maps to exact API parameter and resets page`, () => {
    const state = change(initial(), field, value),
      query = filtersToQuery(state);
    assert.deepEqual(
      query[key],
      typeof value === "string" ? value : value.map((item) => item.id),
    );
    assert.equal(query.page, 1);
  });
}
test("changing species clears dog breed, retaining the same species preserves it", () => {
  let state = change(initial(), "species", "dog");
  state = change(state, "breeds", [breed]);
  assert.equal(change(state, "species", "dog").filters.breeds[0].id, breed.id);
  assert.deepEqual(change(state, "species", "cat").filters.breeds, []);
  assert.deepEqual(change(state, "species", undefined).filters.breeds, [breed]);
});
for (const [index, preset] of agePresets.entries())
  test(`age ${preset.label} uses inclusive documented calendar boundaries`, () => {
    const query = filtersToQuery(change(initial(), "age", preset.value));
    const ranges = [
      [0, 3],
      [3, 6],
      [6, 12],
      [12, 24],
      [24, 60],
      [60, undefined],
    ];
    assert.equal(query.ageMinMonths, ranges[index][0]);
    assert.equal(query.ageMaxMonths, ranges[index][1]);
  });
test("decimal-safe prices retain cents and normalize Ukrainian comma without floating point", () => {
  let state = change(initial(), "priceMin", " 9999999999,98 ");
  state = change(state, "priceMax", "9999999999.99");
  const query = filtersToQuery(state);
  assert.equal(query.priceMin, "9999999999.98");
  assert.equal(query.priceMax, "9999999999.99");
  assert.deepEqual(
    priceErrors(state.filters.priceMin, state.filters.priceMax),
    {},
  );
  assert.deepEqual(priceErrors("0", "0.00"), {});
});
test("invalid, negative, excess precision, overflow and reversed prices show field errors", () => {
  for (const value of [
    "-1",
    "1e3",
    "NaN",
    "Infinity",
    "0.001",
    "10000000000",
    "01",
    "1.",
    "1,2,3",
  ])
    assert.ok(priceErrors(value, "").min, value);
  assert.ok(priceErrors("9999999999.99", "9999999999.98").max);
  assert.ok(priceErrors("", "-1").max);
});
for (const type of ["FREE", "ADOPTION"])
  test(`${type} clears price and disables inputs with explanation`, () => {
    let state = change(initial(), "priceMin", "100");
    state = change(state, "priceMax", "200");
    state = change(state, "type", type);
    assert.equal(state.filters.priceMin, "");
    assert.equal(state.filters.priceMax, "");
    assert.equal(filtersToQuery(state).priceMin, undefined);
    const client = new QueryClient();
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(ListingFiltersPanel, {
          filters: state.filters,
          errors: {},
          onChange() {},
          onClear() {},
        }),
      ),
    );
    client.clear();
    assert.equal((html.match(/disabled=""/g) || []).length, 3);
    assert.ok(html.includes("ціна не застосовується"));
  });
test("clear resets all fields, page and sort; pagination retains filters", () => {
  let state = initial();
  for (const [key, value] of [
    ["species", "dog"],
    ["breeds", [breed]],
    ["locations", [location]],
    ["type", "SALE"],
    ["gender", "MALE"],
    ["age", "3-6"],
    ["q", "цуценя"],
    ["priceMin", "1"],
    ["priceMax", "2"],
  ])
    state = change(state, key, value);
  assert.ok(hasFilters(state.filters));
  const next = filterReducer(state, { kind: "page", page: 2 });
  assert.equal(next.filters.breeds[0].id, breed.id);
  assert.equal(next.page, 2);
  assert.deepEqual(filterReducer(next, { kind: "clear" }), {
    filters: emptyFilters(),
    page: 1,
    sort: "newest",
  });
});
test("every supported sort resets page and custom search/sort UI preserves its selected label", () => {
  const labels = {
    newest: "Спочатку нові",
    oldest: "Спочатку старі",
    price_asc: "Ціна: від нижчої",
    price_desc: "Ціна: від вищої",
  };
  for (const sort of catalogSorts) {
    const state = filterReducer(initial(), { kind: "sort", sort });
    assert.equal(state.page, 1);
    assert.equal(filtersToQuery(state).sort, sort);
    const html = renderToStaticMarkup(
      React.createElement(CatalogSearchSort, {
        search: "",
        sort,
        onSearch() {},
        onSort() {},
      }),
    );
    assert.ok(html.includes(labels[sort]));
    assert.ok(html.includes('role="combobox"'));
    assert.ok(html.includes('aria-haspopup="listbox"'));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(!html.includes("<select"));
    assert.ok(html.includes("Пошук оголошень"));
  }
});
test("serializer omits empty/undefined fields, preserves zero and encodes literal Unicode search", () => {
  const query = {
    page: 1,
    limit: 24,
    sort: "price_asc",
    q: "сві % &",
    species: undefined,
    ageMinMonths: 0,
    priceMin: "0.01",
  };
  const params = new URLSearchParams(serializeCatalogQuery(query));
  assert.equal(params.get("q"), "сві % &");
  assert.equal(params.get("ageMinMonths"), "0");
  assert.equal(params.get("priceMin"), "0.01");
  assert.equal(params.has("species"), false);
});
test("query key includes each of the fourteen API parameters and isolates result caches", () => {
  const client = new QueryClient();
  const base = { page: 1, limit: 24, sort: "newest" };
  client.setQueryData(listingsQueryKey(base), { total: 35 });
  for (const [key, value] of Object.entries({
    q: "cat",
    species: "cat",
    breedIds: ["b"],
    regionIds: ["UA35"],
    locationIds: ["l"],
    type: "FREE",
    gender: "UNKNOWN",
    ageMinMonths: 0,
    ageMaxMonths: 3,
    priceMin: "1.01",
    priceMax: "2.02",
    sort: "oldest",
    page: 2,
    limit: 12,
  }))
    assert.equal(
      client.getQueryData(listingsQueryKey({ ...base, [key]: value })),
      undefined,
      key,
    );
  client.clear();
});
test("Ukrainian filtered totals use correct forms", () => {
  for (const [total, text] of [
    [1, "Знайдено 1 оголошення"],
    [2, "Знайдено 2 оголошення"],
    [5, "Знайдено 5 оголошень"],
    [11, "Знайдено 11 оголошень"],
    [21, "Знайдено 21 оголошення"],
  ])
    assert.equal(resultCount(total), text);
});
const renderResults = (extra = {}) =>
  renderToStaticMarkup(
    React.createElement(CatalogResults, {
      result: {
        isPending: false,
        isError: false,
        data: { data: [], meta: { total: 0, pages: 0, page: 1, limit: 24 } },
      },
      query: { page: 1, limit: 24, sort: "newest" },
      pending: false,
      invalid: false,
      filtered: true,
      onClear() {},
      onPage() {},
      ...extra,
    }),
  );
test("filtered empty state offers clear instead of generic marketplace copy", () => {
  const html = renderResults();
  assert.ok(html.includes("За вибраними параметрами оголошень не знайдено."));
  assert.ok(html.includes("Очистити фільтри"));
  assert.ok(!html.includes("Поки що"));
});
test("error presents retry without changing controls or exposing driver details", () => {
  const html = renderResults({
    result: {
      isError: true,
      isFetching: false,
      error: Error("private SQL stack"),
    },
  });
  assert.ok(html.includes("Не вдалося завантажити оголошення."));
  assert.ok(html.includes("Спробувати ще раз"));
  assert.ok(!html.includes("SQL"));
});
test("debouncing hides stale results and announces loading once; invalid price hides them too", () => {
  const html = renderResults({ pending: true });
  assert.ok(html.includes("listing-skeleton"));
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.ok(!html.includes("не знайдено"));
  assert.ok(
    renderResults({ invalid: true }).includes("Перевірте діапазон ціни"),
  );
});
test("shared selectors retain combobox contract; breed starts disabled and location has settlement label", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListingFiltersPanel, {
        filters: emptyFilters(),
        errors: {},
        onChange() {},
        onClear() {},
      }),
    ),
  );
  client.clear();
  assert.equal((html.match(/role="combobox"/g) || []).length, 3);
  assert.ok(html.includes("Місто або село"));
  assert.ok(html.includes("Введіть назву міста або села"));
  assert.ok(html.includes("Спочатку оберіть вид тварини"));
});

test("multi IDs serialize sorted/deduplicated CSV and equivalent selection orders share cache", () => {
  const base = { page: 1, limit: 24, sort: "newest" };
  const query = {
    ...base,
    breedIds: ["b", "a", "b"],
    locationIds: ["l2", "l1"],
    regionIds: ["UA53", "UA35", "UA35"],
  };
  const params = new URLSearchParams(serializeCatalogQuery(query));
  assert.equal(params.get("breedIds"), "a,b");
  assert.equal(params.get("locationIds"), "l1,l2");
  assert.equal(params.get("regionIds"), "UA35,UA53");
  assert.deepEqual(
    listingsQueryKey(query),
    listingsQueryKey({
      ...base,
      breedIds: ["a", "b"],
      locationIds: ["l1", "l2"],
      regionIds: ["UA35", "UA53"],
    }),
  );
  assert.deepEqual(
    listingsQueryKey({ ...base, breedIds: [], regionIds: [], locationIds: [] }),
    listingsQueryKey(base),
  );
});
test("species removes only incompatible breeds; clearing species preserves choices", () => {
  const cat = { ...breed, id: "cat-breed", species: "cat" };
  let state = change(initial(), "breeds", [breed, cat]);
  assert.deepEqual(change(state, "species", "dog").filters.breeds, [breed]);
  assert.deepEqual(change(state, "species", "cat").filters.breeds, [cat]);
  assert.deepEqual(change(state, "species", undefined).filters.breeds, [
    breed,
    cat,
  ]);
});
test("adding/removing multiple geographic and breed choices resets page one; chips retain context", () => {
  let state = initial();
  const values = {
    breeds: [breed],
    regions: [{ id: "UA35", name: "Кіровоградська область" }],
    locations: [
      location,
      { ...location, id: "second", region: "Полтавська область" },
    ],
  };
  for (const [field, value] of Object.entries(values)) {
    state = change({ ...state, page: 3 }, field, value);
    assert.equal(state.page, 1);
    assert.equal(change({ ...state, page: 3 }, field, []).page, 1);
  }
  const query = filtersToQuery(state);
  assert.deepEqual(query.regionIds, ["UA35"]);
  assert.deepEqual(query.locationIds, ["location-id", "second"]);
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ListingFiltersPanel, {
        filters: state.filters,
        errors: {},
        onChange() {},
        onClear() {},
      }),
    ),
  );
  client.clear();
  assert.ok(html.includes("reference-chips"));
  assert.ok(html.includes("Видалити: Світловодськ"));
  assert.ok(html.includes("Полтавська область"));
  assert.ok(html.includes("Кіровоградська область"));
});
