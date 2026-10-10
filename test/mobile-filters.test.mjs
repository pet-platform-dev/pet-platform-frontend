import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { emptyFilters, filterReducer, filtersToQuery, agePresets } = await load(
  "src/features/listing/filters/model.ts",
);
const { copyFilters, changeDraft, clearDraft } = await load(
  "src/features/listing/filters/filter-state.ts",
);
const { activeFilterCount } = await load(
  "src/features/listing/filters/active-filter-count.ts",
);
const { draftPreviewQuery, draftPreviewKey, applyResultLabel } = await load(
  "src/features/listing/filters/draft-preview.ts",
);
const { listingsQueryKey } = await load(
  "src/entities/listing/model/catalog-query.ts",
);
const { priceErrors } = await load(
  "src/features/listing/filters/price-validation.ts",
);
const { MobileFiltersTrigger } = await load(
  "src/features/listing/filters/mobile-filters-trigger.tsx",
);
const { MobileFiltersFooter } = await load(
  "src/features/listing/filters/mobile-filters-footer.tsx",
);
const dog = {
    id: "dog-breed",
    name: "Malinois",
    nameUk: "Малінуа",
    species: "dog",
  },
  cat = { ...dog, id: "cat-breed", species: "cat" };
const applied = () => ({
  ...emptyFilters(),
  q: "цуценя",
  species: "dog",
  breeds: [dog],
  regions: [{ id: "UA35", name: "Кіровоградська область" }],
  locations: [{ id: "city", city: "Світловодськ" }],
});
test("opening draft copies applied values and independent arrays", () => {
  const source = applied(),
    draft = copyFilters(source);
  assert.deepEqual(draft, source);
  assert.notEqual(draft, source);
  for (const key of ["breeds", "regions", "locations"])
    assert.notEqual(draft[key], source[key]);
});
test("editing/removing draft cannot mutate applied state or its catalog key", () => {
  const source = applied(),
    before = structuredClone(source),
    key = listingsQueryKey(
      filtersToQuery({ filters: source, page: 4, sort: "oldest" }),
    );
  let draft = changeDraft(copyFilters(source), {
    field: "gender",
    value: "FEMALE",
  });
  draft = changeDraft(draft, { field: "breeds", value: [] });
  assert.deepEqual(source, before);
  assert.notEqual(draft.gender, source.gender);
  assert.deepEqual(
    listingsQueryKey(
      filtersToQuery({ filters: source, page: 4, sort: "oldest" }),
    ),
    key,
  );
});
test("cancel discards draft; reopening starts from applied choices", () => {
  const source = applied();
  const changed = changeDraft(copyFilters(source), {
    field: "type",
    value: "FREE",
  });
  assert.equal(changed.type, "FREE");
  assert.equal(copyFilters(source).type, undefined);
});
test("apply commits draft once, resets page one and preserves sort until explicitly cleared", () => {
  const filters = changeDraft(applied(), { field: "gender", value: "FEMALE" });
  const next = filterReducer(
    { filters: applied(), page: 3, sort: "price_asc" },
    {
      kind: "apply",
      filters: { ...filters, q: "draft search" },
    },
  );
  assert.equal(next.page, 1);
  assert.equal(next.sort, "price_asc");
  assert.equal(next.filters.q, "draft search");
  assert.equal(next.filters.gender, "FEMALE");
});
test("drawer clear empties draft search and filters while keeping applied state", () => {
  const source = applied(),
    draft = clearDraft();
  assert.deepEqual(draft, emptyFilters());
  assert.equal(source.breeds.length, 1);
  assert.equal(activeFilterCount(draft), 0);
  const next = filterReducer(
    { filters: source, page: 3, sort: "oldest" },
    { kind: "apply", filters: draft },
  );
  assert.equal(next.page, 1);
  assert.equal(next.sort, "oldest");
  assert.deepEqual(next.filters, draft);
});
for (const [key, value] of Object.entries({
  species: "dog",
  breeds: [dog, dog, dog],
  regions: [{ id: "UA35" }, { id: "UA53" }],
  locations: [{ id: "a" }, { id: "b" }],
  type: "SALE",
  gender: "FEMALE",
  age: "3-6",
  priceMin: "1",
}))
  test(key + " is one active group", () =>
    assert.equal(activeFilterCount({ ...emptyFilters(), [key]: value }), 1),
  );
test("geography one group and price min/max one group; q and sort excluded", () => {
  assert.equal(
    activeFilterCount({ ...applied(), priceMin: "1", priceMax: "2" }),
    4,
  );
  assert.equal(
    activeFilterCount({
      ...emptyFilters(),
      q: "anything",
      priceMin: " ",
      priceMax: " ",
    }),
    0,
  );
  assert.equal(
    activeFilterCount({
      ...emptyFilters(),
      species: "dog",
      breeds: [dog],
      regions: [{}],
      locations: [{}],
      type: "SALE",
      gender: "MALE",
      age: "60+",
      priceMax: "2",
    }),
    7,
  );
});
test("same reducer handles mobile compatible breeds and non-sale price behavior", () => {
  let draft = {
    ...emptyFilters(),
    breeds: [dog, cat],
    priceMin: "12",
    priceMax: "25",
  };
  draft = changeDraft(draft, { field: "species", value: "dog" });
  assert.deepEqual(draft.breeds, [dog]);
  assert.deepEqual(
    changeDraft(draft, { field: "species", value: undefined }).breeds,
    [dog],
  );
  draft = changeDraft(draft, { field: "type", value: "ADOPTION" });
  assert.equal(draft.priceMin, "");
  assert.equal(draft.priceMax, "");
});
test("mobile preview uses same geography/age/decimal mapping with one-row limit and separate key", () => {
  for (const age of agePresets) {
    const draft = {
      ...applied(),
      age: age.value,
      priceMin: "100,01",
      priceMax: "9999999999.99",
    };
    const catalog = filtersToQuery({ filters: draft, page: 1, sort: "newest" }),
      preview = draftPreviewQuery(draft);
    assert.deepEqual(preview, { ...catalog, limit: 1 });
    assert.notDeepEqual(draftPreviewKey(preview), listingsQueryKey(catalog));
    assert.deepEqual(preview.regionIds, ["UA35"]);
    assert.deepEqual(preview.locationIds, ["city"]);
    assert.equal(preview.priceMin, "100.01");
  }
  assert.ok(priceErrors("-1", "").min);
  assert.ok(priceErrors("20", "10").max);
});
test("equivalent selection order shares canonical preview key", () => {
  const a = { ...emptyFilters(), regions: [{ id: "UA35" }, { id: "UA53" }] },
    b = { ...a, regions: [...a.regions].reverse() };
  assert.deepEqual(
    draftPreviewKey(draftPreviewQuery(a)),
    draftPreviewKey(draftPreviewQuery(b)),
  );
});
for (const [total, label] of [
  [0, "Показати 0 оголошень"],
  [1, "Показати 1 оголошення"],
  [2, "Показати 2 оголошення"],
  [24, "Показати 24 оголошення"],
  [37, "Показати 37 оголошень"],
])
  test("Apply Ukrainian plural " + total, () =>
    assert.equal(applyResultLabel(total), label),
  );
test("trigger shows groups rather than chips, with dialog semantics", () => {
  const render = (filters) =>
    renderToStaticMarkup(
      React.createElement(MobileFiltersTrigger, { filters, onOpen() {} }),
    );
  assert.ok(render(emptyFilters()).includes(">Фільтри</button>"));
  assert.ok(render(applied()).includes("Фільтри (3)"));
  assert.ok(render(emptyFilters()).includes('aria-haspopup="dialog"'));
});
test("footer keeps clear/apply actions, disables invalid price and has preview fallback", () => {
  const render = (extra) =>
    renderToStaticMarkup(
      React.createElement(MobileFiltersFooter, {
        pending: false,
        error: false,
        invalid: false,
        onClear() {},
        onApply() {},
        ...extra,
      }),
    );
  assert.ok(render({ total: 0 }).includes("Показати 0 оголошень"));
  assert.ok(render({ pending: true }).includes("Рахуємо пропозиції"));
  assert.ok(render({ error: true }).includes("Застосувати фільтри"));
  assert.ok(render({ invalid: true }).includes('disabled=""'));
  assert.ok(render({}).includes("Очистити"));
});
