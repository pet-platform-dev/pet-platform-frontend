import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const api = await load("src/entities/mating-listing/public-api.ts");
test("profile collection uses one public owner-scoped bounded endpoint", async () => {
  const old = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, options) => {
    seen = { url, options };
    return new Response(
      JSON.stringify({
        data: [],
        meta: { page: 2, limit: 24, total: 0, pages: 0 },
      }),
    );
  };
  try {
    await api.getSellerMating("11111111-1111-4111-8111-111111111111", 2);
    assert.match(
      seen.url,
      /sellers\/11111111.*\/mating-listings\?page=2&limit=24/,
    );
    assert.equal(seen.options.headers.Authorization, undefined);
  } finally {
    globalThis.fetch = old;
  }
});
