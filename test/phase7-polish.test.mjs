import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { petEditorReturn, breederPetEditorHref, breederAnimalsPath } =
  await load("src/features/pet/navigation/editor-return.ts");
const { updateContactCache } = await load("src/features/profile/cache.ts");

test("Pet editor preserves a known breeder return path across URL serialization", () => {
  const url = new URL(breederPetEditorHref("pet-id"), "https://local.invalid");
  assert.equal(url.pathname, "/pets/pet-id/edit");
  assert.equal(
    petEditorReturn(url.searchParams.get("returnTo")),
    breederAnimalsPath,
  );
  assert.equal(new URL(breederPetEditorHref(), url).pathname, "/pets/new");
});
test("Pet editor rejects external, ambiguous and unknown return targets", () => {
  for (const input of [
    undefined,
    null,
    "https://evil.invalid",
    "//evil.invalid",
    "/profile/breeder/animals/../admin",
    "/profile/breeder/animals?redirect=evil",
    [breederAnimalsPath],
    "/listings",
    "/pets/evil",
  ])
    assert.equal(petEditorReturn(input), "/pets");
});
test("contact updates refresh only the owner's public identity surfaces", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: "owner" });
  c.setQueryData(["seller", "other"], { id: "other" });
  c.setQueryData(["breeder", "owner"], {
    contactPerson: { id: "owner", phone: "old" },
  });
  c.setQueryData(["listing", "mine"], { seller: { id: "owner" } });
  c.setQueryData(["listing", "other"], { seller: { id: "other" } });
  const seller = { id: "owner", phone: "new" };
  assert.equal(await updateContactCache(c, seller), true);
  assert.equal(c.getQueryData(["profile", "owner"]), seller);
  assert.equal(c.getQueryData(["seller", "owner"]), seller);
  assert.equal(c.getQueryState(["breeder", "owner"]).isInvalidated, true);
  assert.equal(c.getQueryState(["listing", "mine"]).isInvalidated, true);
  assert.equal(c.getQueryState(["listing", "other"]).isInvalidated, false);
  assert.equal(c.getQueryState(["seller", "other"]).isInvalidated, false);
  c.clear();
});
test("late contact response cannot restore a logged-out owner's cache", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: "other" });
  assert.equal(await updateContactCache(c, { id: "owner" }), false);
  assert.equal(c.getQueryData(["profile", "owner"]), undefined);
  c.setQueryData(["current-user"], { id: "owner" });
  c.cancelQueries = async () => {
    c.setQueryData(["current-user"], null);
  };
  assert.equal(await updateContactCache(c, { id: "owner" }), false);
  assert.equal(c.getQueryData(["seller", "owner"]), undefined);
  c.clear();
});
