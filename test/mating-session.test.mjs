import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { favoriteLoginReturn } = await load(
  "src/features/favorites/login-return.ts",
);
const { clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { refreshMating } = await load("src/features/mating/cache.ts");
test("lifecycle refresh invalidates related Pet/profile summaries without unrelated marketplace", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: "A" });
  const keys = [];
  c.invalidateQueries = async ({ queryKey }) => {
    keys.push(queryKey);
  };
  await refreshMating(c, "A", "listing", { id: "listing", pet: { id: "pet" } });
  assert.ok(
    keys.some(
      (k) => JSON.stringify(k) === JSON.stringify(["public-pet", "pet"]),
    ),
  );
  assert.ok(
    keys.some((k) => JSON.stringify(k) === JSON.stringify(["my-pets", "A"])),
  );
  assert.ok(
    keys.some(
      (k) => JSON.stringify(k) === JSON.stringify(["breeder-animals", "A"]),
    ),
  );
  assert.ok(
    keys.every(
      (k) =>
        !["catalog", "seller-listings", "seller", "reviews"].includes(k[0]),
    ),
  );
  c.clear();
});
for (const target of [
  "/mating/new",
  "/mating/my",
  "/mating/11111111-1111-4111-8111-111111111111/edit",
])
  test("auth restores protected target " + target, () =>
    assert.equal(favoriteLoginReturn(target), target),
  );
for (const target of [
  "https://evil.test/mating/new",
  "//evil.test/mating/my",
  "/mating/../account",
  "/mating/%2e%2e/account",
  "/mating/not-an-id/edit",
  "/mating/new/extra",
])
  test("auth rejects unsafe/unsupported target " + target, () =>
    assert.equal(favoriteLoginReturn(target), "/account"),
  );
test("logout removes mating private state but preserves public catalog", () => {
  const c = new QueryClient();
  for (const prefix of ["mating-mine", "mating-active", "mating-owned"])
    c.setQueryData([prefix, "A"], ["private"]);
  c.setQueryData(["catalog"], ["public"]);
  clearPrivateQueries(c);
  for (const prefix of ["mating-mine", "mating-active", "mating-owned"])
    assert.equal(c.getQueryData([prefix, "A"]), undefined);
  assert.deepEqual(c.getQueryData(["catalog"]), ["public"]);
  c.clear();
});
test("late mutation from A cannot repopulate private cache after switch to B", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: "B" });
  await refreshMating(c, "A", "listing", { id: "listing" });
  assert.equal(c.getQueryData(["mating-owned", "A", "listing"]), undefined);
  c.clear();
});
test("mutation updates only current mating namespace", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: "A" });
  c.setQueryData(["catalog"], ["public"]);
  await refreshMating(c, "A", "listing", { id: "listing" });
  assert.deepEqual(c.getQueryData(["mating-owned", "A", "listing"]), {
    id: "listing",
  });
  assert.equal(c.getQueryState(["catalog"]).isInvalidated, false);
  c.clear();
});

test("owner mutation expires all public mating filters while preserving marketplace cache", async () => {
  const c = new QueryClient({
    defaultOptions: { queries: { staleTime: 30000 } },
  });
  c.setQueryData(["current-user"], { id: "A" });
  const keys = [
    ["mating-public", { page: 1, sort: "newest" }],
    ["mating-public", { page: 2, feeMode: "free" }],
  ];
  for (const key of keys) c.setQueryData(key, { data: ["previous-active"] });
  c.setQueryData(["listings"], { data: ["marketplace"] });
  await refreshMating(c, "A");
  for (const key of keys)
    assert.equal(c.getQueryState(key).isInvalidated, true);
  assert.equal(c.getQueryState(["listings"]).isInvalidated, false);
  c.clear();
});
