import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { getPublicMating } = await load(
  "src/entities/mating-listing/public-api.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  id,
  status: "ACTIVE",
  moderationStatus: "APPROVED",
  fee: "25.50",
  currency: "UAH",
  createdAt: "2026-10-12T00:00:00Z",
  pet: {
    id,
    name: null,
    gender: "FEMALE",
    birthDate: null,
    species: { id, name: "Cat", slug: "cat" },
    breed: null,
    profileImage: null,
  },
  owner: { id, displayName: "Власник" },
  location: {
    id,
    countryCode: "UA",
    city: "Київ",
    region: "Київська область",
    district: null,
    community: null,
    settlementType: "CITY",
    katottgCode: null,
  },
};
test("public catalog sends canonical query and abort signal without auth calls or headers", async () => {
  const saved = globalThis.fetch,
    calls = [],
    controller = new AbortController();
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        data: [row],
        meta: { page: 2, limit: 24, total: 25, pages: 2 },
      }),
    );
  };
  try {
    const result = await getPublicMating(
      {
        page: 2,
        limit: 24,
        sort: "price_asc",
        genders: ["FEMALE"],
        feeMin: "25.50",
      },
      controller.signal,
    );
    assert.equal(result.data[0].pet.gender, "FEMALE");
    assert.equal(result.meta.pages, 2);
    assert.equal(calls.length, 1);
    assert.match(
      calls[0].url,
      /\/mating-listings\?page=2&limit=24&sort=price_asc&genders=FEMALE&feeMode=fixed&feeMin=25.50$/,
    );
    assert.equal(calls[0].init.headers.Authorization, undefined);
    assert.equal(calls[0].init.headers["X-CSRF-Token"], undefined);
    controller.abort();
    assert.equal(calls[0].init.signal.aborted, true);
  } finally {
    globalThis.fetch = saved;
  }
});
test("public transport rejects nonactive rows and inconsistent pagination", async () => {
  const saved = globalThis.fetch;
  try {
    for (const payload of [
      {
        data: [{ ...row, status: "CLOSED" }],
        meta: { page: 1, limit: 24, total: 1, pages: 1 },
      },
      { data: [row], meta: { page: 1, limit: 24, total: 25, pages: 1 } },
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify(payload));
      await assert.rejects(
        getPublicMating({ page: 1, limit: 24, sort: "newest" }),
      );
    }
  } finally {
    globalThis.fetch = saved;
  }
});
