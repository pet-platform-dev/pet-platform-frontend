import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { matingValues, valuesQuery, updateValues, matingFilterCount } =
  await load("src/features/mating/catalog/filter-state.ts");
const initial = {
  page: 3,
  limit: 24,
  sort: "price_desc",
  species: "dog",
  genders: ["FEMALE"],
  ageMinMonths: 12,
  ageMaxMonths: 24,
  feeMode: "fixed",
  feeMin: "12.34",
  feeMax: "99.99",
};
test("URL values round trip fee and calendar age without precision loss", () => {
  const values = matingValues(initial);
  assert.equal(values.age, "12-24");
  assert.equal(values.priceMin, "12.34");
  assert.equal(matingFilterCount(values), 4);
  assert.deepEqual(valuesQuery(values, initial), { ...initial, page: 1 });
});
test("species clears incompatible known breed choices while preserving unknown shared labels", () => {
  const v = matingValues(initial);
  v.breeds = [
    { id: "dog", name: "Dog", nameUk: null, species: "dog" },
    { id: "cat", name: "Cat", nameUk: null, species: "cat" },
  ];
  assert.deepEqual(
    updateValues(v, { field: "species", value: "cat" }).breeds.map((b) => b.id),
    ["cat"],
  );
});
test("fee mode clears hidden ranges, fixed range remains exact and clear resets filter groups", () => {
  const v = updateValues(matingValues(initial), {
    field: "feeMode",
    value: "agreement",
  });
  assert.equal(v.priceMin, "");
  assert.equal(v.priceMax, "");
  assert.equal(valuesQuery(v, initial).feeMode, "agreement");
  assert.equal(valuesQuery(v, initial).feeMin, undefined);
  assert.equal(
    matingFilterCount(matingValues({ page: 1, limit: 24, sort: "newest" })),
    0,
  );
});
test("gender OR selections remain a single count and navigation values reset page", () => {
  const v = updateValues(matingValues(initial), {
    field: "genders",
    value: ["MALE", "FEMALE"],
  });
  assert.deepEqual(valuesQuery(v, initial).genders, ["MALE", "FEMALE"]);
  assert.equal(valuesQuery(v, initial).page, 1);
});
