import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { safeCatalogReturn, listingDetailHref } = await load(
  "src/features/listing/navigation/catalog-return.ts",
);
const { parseFilterUrl } = await load(
  "src/features/listing/filters/filter-url-parser.ts",
);
const { filterHref } = await load(
  "src/features/listing/filters/filter-url-serializer.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
const query = parseFilterUrl(
  new URLSearchParams({
    q: "малінуа & +",
    species: "dog",
    breedIds: id,
    regionIds: "UA35,UA53",
    locationIds: id,
    type: "SALE",
    gender: "MALE",
    ageMinMonths: "3",
    ageMaxMonths: "12",
    priceMin: "100.01",
    priceMax: "1000",
    sort: "price_asc",
    page: "2",
  }),
);
test("catalog detail URL carries every canonical condition with safe nested encoding", () => {
  const target = filterHref(query),
    detail = new URL(listingDetailHref(id, query), "https://local.example");
  assert.equal(detail.pathname, "/listings/" + id);
  assert.equal(detail.searchParams.get("returnTo"), target);
  assert.equal(safeCatalogReturn(detail.searchParams.get("returnTo")), target);
  const params = new URLSearchParams(safeCatalogReturn(target).split("?")[1]);
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("sort"), "price_asc");
  assert.equal(params.get("q"), "малінуа & +");
  assert.deepEqual(parseFilterUrl(params), query);
});
test("detail refresh can reconstruct return solely from its URL without session state", () => {
  const href = listingDetailHref(id, query),
    restored = new URL(href, "https://local.example").searchParams.get(
      "returnTo",
    );
  assert.equal(safeCatalogReturn(restored), filterHref(query));
});
for (const value of [
  undefined,
  "",
  [],
  ["/listings?species=dog", "/listings?species=cat"],
  "https://evil.example/listings",
  "//evil.example/listings",
  "javascript:alert(1)",
  "/account",
  "/listings/123",
  "/listings-evil?q=dog",
  "/listings/../account",
  "/listings%3Fq=dog",
  "/listings\\evil",
  "/listings?x=\\evil",
  " /listings",
  "/listings?x=1#evil",
  "/listings?x=\n",
  "/listings?" + "a".repeat(8192),
]) {
  test(
    "unsafe/missing/ambiguous return target falls back: " +
      JSON.stringify(value)?.slice(0, 80),
    () => assert.equal(safeCatalogReturn(value), "/listings"),
  );
}
test("catalog-only return query reuses Phase 6D normalization and drops nested redirect keys", () => {
  assert.equal(
    safeCatalogReturn(
      "/listings?page=1&sort=newest&species=dog&returnTo=https%3A%2F%2Fevil.example",
    ),
    "/listings?species=dog",
  );
  assert.equal(
    safeCatalogReturn("/listings?sort=bad&page=-2&q=%D0%BA%D1%96%D1%82"),
    "/listings?q=%D0%BA%D1%96%D1%82",
  );
  assert.equal(safeCatalogReturn("/listings"), "/listings");
});
