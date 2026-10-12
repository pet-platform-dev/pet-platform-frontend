import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { parseFilterUrl } = await load(
  "src/features/listing/filters/filter-url-parser.ts",
);
const { filterHref } = await load(
  "src/features/listing/filters/filter-url-serializer.ts",
);
const { urlFilterState } = await load(
  "src/features/listing/filters/filter-url-state.ts",
);
const { filtersToQuery, filterReducer } = await load(
  "src/features/listing/filters/model.ts",
);
const { activeFilterCount } = await load(
  "src/features/listing/filters/active-filter-count.ts",
);
const { listingsQueryKey } = await load(
  "src/entities/listing/model/catalog-query.ts",
);
const { AgeFilter } = await load("src/features/listing/filters/age-filter.tsx");
const { CatalogPagination } = await load(
  "src/widgets/listings-catalog/catalog-pagination.tsx",
);
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const parse = (string) => parseFilterUrl(new URLSearchParams(string));
test("empty URL parses clean defaults; serializing defaults omits limit/sort/page", () => {
  assert.deepEqual(parse(""), { page: 1, limit: 24, sort: "newest" });
  assert.equal(filterHref(parse("sort=newest&page=1&limit=99")), "/listings");
});
for (const [key, value, expected] of [
  ["q", "малінуа % & +", "малінуа % & +"],
  ["species", "dog", "dog"],
  ["species", "cat", "cat"],
  ["breedIds", b + "," + a, [a, b]],
  ["regionIds", "UA53,UA35", ["UA35", "UA53"]],
  ["locationIds", b + "," + a, [a, b]],
  ["type", "SALE", "SALE"],
  ["type", "FREE", "FREE"],
  ["type", "ADOPTION", "ADOPTION"],
  ["gender", "MALE", "MALE"],
  ["gender", "FEMALE", "FEMALE"],
  ["gender", "UNKNOWN", "UNKNOWN"],
  ["ageMinMonths", "0", 0],
  ["ageMaxMonths", "12", 12],
  ["priceMin", "100.01", "100.01"],
  ["priceMax", "9999999999.99", "9999999999.99"],
  ["sort", "price_asc", "price_asc"],
  ["sort", "oldest", "oldest"],
  ["sort", "price_desc", "price_desc"],
  ["page", "2", 2],
]) {
  test(`${key}=${value} survives parse/UI/API/URL round trip`, () => {
    const query = parse(new URLSearchParams({ [key]: value }).toString());
    assert.deepEqual(query[key], expected);
    const again = parse(filterHref(query).split("?")[1] ?? "");
    assert.deepEqual(again, query);
    assert.deepEqual(filtersToQuery(urlFilterState(query)), query);
  });
}
test("CSV arrays deduplicate/sort, merge repeated CSV and equivalent orders share href/key", () => {
  const first = parse(
      `breedIds=${b},${a},${b}&locationIds=${b},${a}&regionIds=UA53,UA35`,
    ),
    second = parse(
      `regionIds=UA35&regionIds=UA53,UA35&locationIds=${a},${b}&breedIds=${a}&breedIds=${b}`,
    );
  assert.equal(filterHref(first), filterHref(second));
  assert.deepEqual(listingsQueryKey(first), listingsQueryKey(second));
});
test("URL order is stable and default page/sort omitted", () => {
  const query = parse(
    `page=2&sort=price_desc&gender=MALE&type=SALE&priceMax=300&q=малінуа&regionIds=UA35&breedIds=${a}&locationIds=${b}&species=dog&ageMaxMonths=12&ageMinMonths=3&priceMin=100`,
  );
  assert.deepEqual(
    [...new URLSearchParams(filterHref(query).split("?")[1]).keys()],
    [
      "q",
      "species",
      "breedIds",
      "regionIds",
      "locationIds",
      "type",
      "gender",
      "ageMinMonths",
      "ageMaxMonths",
      "priceMin",
      "priceMax",
      "sort",
      "page",
    ],
  );
});
test("malformed/unsupported/repeated scalars and unknown parameters are dropped safely", () => {
  const query = parse(
    `q=x&q=y&species=bird&sort=bad&page=-1&type=ALIEN&gender=other&ageMinMonths=601&ageMaxMonths=-2&priceMin=NaN&priceMax=1e2&breedIds=oops,${a}&regionIds=x,UA35&locationIds=invalid&status=DRAFT&limit=100`,
  );
  assert.deepEqual(query, {
    page: 1,
    limit: 24,
    sort: "newest",
    breedIds: [a],
    regionIds: ["UA35"],
  });
  assert.equal(
    parseFilterUrl({ sort: ["newest", "oldest"], page: ["1", "2"] }).sort,
    "newest",
  );
});
test("empty, whitespace and uppercase UUIDs normalize without changing valid identity", () => {
  const result = parse(
    `q=++++&breedIds=,${a.toUpperCase()},,&priceMin=&sort=&page=0`,
  );
  assert.deepEqual(result, {
    page: 1,
    limit: 24,
    sort: "newest",
    breedIds: [a],
  });
});
test("crossed age/price ranges drop both bounds, exact money avoids floating comparison", () => {
  assert.equal(
    parse("ageMinMonths=12&ageMaxMonths=3&priceMin=100.02&priceMax=100.01")
      .priceMin,
    undefined,
  );
  assert.equal(parse("ageMinMonths=12&ageMaxMonths=3").ageMinMonths, undefined);
  assert.equal(parse("priceMin=100,01&priceMax=100.01").priceMin, "100.01");
});
test("bounded q/CSV arrays prevent unbounded frontend requests", () => {
  const ids = Array.from(
    { length: 60 },
    (_, i) => `${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
  );
  const query = parse(
    new URLSearchParams({
      q: "я".repeat(101),
      breedIds: ids.join(","),
    }).toString(),
  );
  assert.equal(query.q.length, 100);
  assert.equal(query.breedIds.length, 50);
});
test("valid unknown IDs and contradictory unknown species/breed remain without guessed deletion", () => {
  const query = parse(
      `species=cat&breedIds=${a}&locationIds=${b}&regionIds=UA99`,
    ),
    state = urlFilterState(query);
  assert.equal(state.filters.breeds[0].species, undefined);
  assert.equal(
    filterReducer(state, {
      kind: "filter",
      update: { field: "species", value: "dog" },
    }).filters.breeds.length,
    1,
  );
  assert.deepEqual(filtersToQuery(state), query);
});
test("known metadata labels do not change URLs or query keys; known incompatible removal stays explicit", () => {
  const query = parse(`species=cat&breedIds=${a}`),
    labels = {
      breeds: {
        [a]: { id: a, name: "Malinois", nameUk: "Малінуа", species: "dog" },
      },
      regions: {},
      locations: {},
    };
  const state = urlFilterState(query, labels);
  assert.equal(state.filters.breeds[0].nameUk, "Малінуа");
  assert.deepEqual(filtersToQuery(state), query);
  assert.equal(
    filterReducer(state, {
      kind: "filter",
      update: { field: "species", value: "cat" },
    }).filters.breeds.length,
    0,
  );
});
test("custom inclusive age ranges survive UI with selected display option", () => {
  const query = parse("ageMinMonths=3&ageMaxMonths=12"),
    state = urlFilterState(query);
  const html = renderToStaticMarkup(
    React.createElement(AgeFilter, { value: state.filters.age, onChange() {} }),
  );
  assert.ok(html.includes("3–12 місяців"));
  assert.ok(html.includes('data-value="range:3:12"'));
  assert.deepEqual(filtersToQuery(state), query);
});
test("seven active groups derive from URL; q/sort/page do not count and geography counts once", () => {
  const state = urlFilterState(
    parse(
      `q=x&species=dog&breedIds=${a},${b}&regionIds=UA35,UA53&locationIds=${a},${b}&type=SALE&gender=MALE&ageMinMonths=0&ageMaxMonths=3&priceMin=100&priceMax=300&sort=oldest&page=2`,
    ),
  );
  assert.equal(activeFilterCount(state.filters), 7);
  assert.equal(
    activeFilterCount(urlFilterState(parse("q=x&sort=oldest&page=2")).filters),
    0,
  );
});
test("filter/sort transitions reset page and preserve every other query condition", () => {
  const state = urlFilterState(
    parse(`q=x&species=dog&locationIds=${a}&page=2&sort=oldest`),
  );
  const next = filterReducer(state, {
    kind: "filter",
    update: { field: "gender", value: "FEMALE" },
  });
  assert.equal(next.page, 1);
  assert.ok(filterHref(filtersToQuery(next)).includes("locationIds=" + a));
  assert.equal(
    filterReducer(state, { kind: "sort", sort: "price_asc" }).page,
    1,
  );
});
test("pagination href carries all query filters with clean page-one link", () => {
  const query = parse(
    `q=x&species=dog&breedIds=${a}&regionIds=UA35&locationIds=${b}&sort=oldest&page=2`,
  );
  const html = renderToStaticMarkup(
    React.createElement(CatalogPagination, {
      query,
      page: 2,
      pages: 3,
      sort: "oldest",
    }),
  );
  assert.ok(
    html.includes(filterHref({ ...query, page: 3 }).replaceAll("&", "&amp;")),
  );
  assert.ok(
    html.includes(filterHref({ ...query, page: 1 }).replaceAll("&", "&amp;")),
  );
});
test("FREE+price direct URL retains backend contradiction instead of silently changing query semantics", () => {
  const query = parse("type=FREE&priceMin=100");
  assert.deepEqual(filtersToQuery(urlFilterState(query)), query);
});
