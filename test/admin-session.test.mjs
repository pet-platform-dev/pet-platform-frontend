import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
import { QueryClient } from "@tanstack/react-query";
const { isSessionQuery, clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { favoriteLoginReturn } = await load(
  "src/features/favorites/login-return.ts",
);
test("admin queue/detail/access state is private and removed at session boundary", () => {
  for (const queryKey of [
    ["admin-moderation", "A", "queue"],
    ["admin-moderation", "A", "detail", "LISTING", "id"],
    ["admin-access", "A"],
  ])
    assert.equal(isSessionQuery({ queryKey }), true);
  const calls = [];
  clearPrivateQueries({
    getMutationCache: () => ({ getAll: () => [] }),
    cancelQueries: ({ predicate }) =>
      calls.push(predicate({ queryKey: ["admin-moderation", "A"] })),
    removeQueries: ({ predicate }) =>
      calls.push(predicate({ queryKey: ["admin-moderation", "A"] })),
  });
  assert.deepEqual(calls, [true, true]);
  assert.equal(isSessionQuery({ queryKey: ["listings"] }), false);
});
test("logout removes completed admin decision data from mutation cache as well as query cache", async () => {
  const client = new QueryClient();
  const mutation = client.getMutationCache().build(client, {
    mutationKey: ["admin-moderation", "A", "LISTING", "id"],
    mutationFn: async () => ({ moderationReason: "Private admin decision" }),
  });
  await mutation.execute();
  assert.equal(client.getMutationCache().getAll().length, 1);
  clearPrivateQueries(client);
  assert.equal(client.getMutationCache().getAll().length, 0);
  client.clear();
});
test("login preserves a safe admin queue/detail context and rejects unsafe admin paths", () => {
  assert.equal(
    favoriteLoginReturn("/admin/moderation?type=LISTING&page=2"),
    "/admin/moderation?type=LISTING&page=2",
  );
  assert.equal(
    favoriteLoginReturn(
      "/admin/moderation/listings/11111111-1111-4111-8111-111111111111",
    ),
    "/admin/moderation/listings/11111111-1111-4111-8111-111111111111",
  );
  for (const path of [
    "https://evil.invalid/admin/moderation",
    "//evil.invalid/admin/moderation",
    "/admin/settings",
    "/admin/moderation/../users",
    "/admin/moderation/listings/bad",
  ])
    assert.equal(favoriteLoginReturn(path), "/account");
});
