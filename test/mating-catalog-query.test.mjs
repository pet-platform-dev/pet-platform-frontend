import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { parseMatingUrl, matingHref, serializeMatingQuery, matingQueryKey } =
  await load("src/features/mating/catalog/query.ts");
const id = "11111111-1111-4111-8111-111111111111";
test("public URL defaults and ignores sale-only filters", () =>
  assert.deepEqual(
    parseMatingUrl(
      new URLSearchParams(
        "q=secret&type=SALE&gender=UNKNOWN&sort=oldest&limit=1",
      ),
    ),
    { page: 1, limit: 24, sort: "newest" },
  ));
test("normalizes shared selections and multi gender without repeat keys", () => {
  const query = parseMatingUrl({
    breedIds: [id + ",bad", id],
    regionIds: "UA80,UA32,UA80",
    genders: ["MALE,FEMALE", "UNKNOWN,MALE"],
    ageMinMonths: "0",
    feeMax: "1234,56",
  });
  assert.deepEqual(query, {
    page: 1,
    limit: 24,
    sort: "newest",
    breedIds: [id],
    regionIds: ["UA32", "UA80"],
    genders: ["FEMALE", "MALE"],
    ageMinMonths: 0,
    feeMode: "fixed",
    feeMax: "1234.56",
  });
  assert.equal(
    matingHref(query),
    "/mating?breedIds=" +
      id +
      "&genders=FEMALE%2CMALE&regionIds=UA32%2CUA80&ageMinMonths=0&feeMode=fixed&feeMax=1234.56",
  );
});
test("invalid ranges and repeated scalar values fall back deterministically", () => {
  assert.deepEqual(
    parseMatingUrl({
      page: ["2", "3"],
      species: ["dog", "cat"],
      ageMinMonths: "20",
      ageMaxMonths: "2",
      feeMin: "10",
      feeMax: "1",
    }),
    { page: 1, limit: 24, sort: "newest" },
  );
  assert.deepEqual(parseMatingUrl({ feeMode: "free", feeMin: "2" }), {
    page: 1,
    limit: 24,
    sort: "newest",
    feeMode: "free",
  });
});
test("canonical API includes page limit sort and cache is public namespace", () => {
  const query = {
    page: 2,
    limit: 1,
    sort: "price_desc",
    genders: ["MALE", "MALE"],
    species: "cat",
  };
  assert.equal(
    serializeMatingQuery(query),
    "page=2&limit=1&sort=price_desc&species=cat&genders=MALE",
  );
  assert.deepEqual(matingQueryKey(query), [
    "mating-public",
    {
      page: 2,
      limit: 1,
      sort: "price_desc",
      species: "cat",
      genders: ["MALE"],
    },
  ]);
  assert.equal(matingHref({ page: 1, limit: 24, sort: "newest" }), "/mating");
});
