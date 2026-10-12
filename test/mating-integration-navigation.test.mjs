import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const nav = await load("src/features/mating/detail/navigation.ts");
const { resolveOwnedMatingPetId } = await load(
  "src/features/mating/preselection.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
test("direct owner URLs retain legacy auth/save paths, contextual URLs preserve safe handoff", () => {
  assert.equal(nav.matingCreateHref(undefined, undefined), "/mating/new");
  assert.equal(nav.matingEditHref(id, undefined), "/mating/" + id + "/edit");
  assert.equal(nav.matingCreateHref(undefined, "//evil.test"), "/mating/new");
  const create = new URL(
    nav.matingCreateHref(id, "/pets"),
    "https://internal.invalid",
  );
  assert.equal(create.searchParams.get("petId"), id);
  assert.equal(create.searchParams.get("returnTo"), "/pets");
  assert.equal(
    new URL(
      nav.matingEditHref(id, "/pets"),
      "https://internal.invalid",
    ).searchParams.get("returnTo"),
    "/pets",
  );
});
test("preselection validates owned UUID only, ignoring foreign/repeated inputs", () => {
  assert.equal(resolveOwnedMatingPetId(id, [{ id }]), id);
  for (const input of [
    "bad",
    undefined,
    [id, id],
    "22222222-2222-4222-8222-222222222222",
  ])
    assert.equal(resolveOwnedMatingPetId(input, [{ id }]), undefined);
});
test("public Pet and seller context survives serialization with appropriate labels", () => {
  assert.deepEqual(nav.parsePublicMatingReturn("/pets/" + id), {
    href: "/pets/" + id,
    label: "До профілю тварини",
  });
  assert.deepEqual(
    nav.parsePublicMatingReturn("/sellers/" + id + "?matingPage=2&ignored=1"),
    { href: "/sellers/" + id + "?matingPage=2", label: "До профілю власника" },
  );
  assert.equal(
    nav.parsePublicMatingReturn("/mating?sort=price_asc&page=2").href,
    "/mating?sort=price_asc&page=2",
  );
});
test("allowlists reject hostile context and nested/repeated navigation", () => {
  for (const input of [
    "https://evil.test",
    "//evil.test",
    "/pets/" + id + "/edit",
    "/pets/%2e%2e/account",
    "/sellers/" + id + "#x",
    "/sellers/" + id + "?matingPage=2&matingPage=3",
    "/pets/" + id + "?returnTo=/account",
    ["/pets/" + id],
  ])
    assert.equal(
      nav.parsePublicMatingReturn(input).href,
      "/mating",
      String(input),
    );
  for (const input of [
    "/pets",
    "/profile/breeder/animals",
    "/pets/" + id + "/edit",
  ])
    assert.equal(nav.safeOwnerMatingReturn(input), input);
  for (const input of [
    "/account",
    "/sellers/" + id,
    "//evil.test",
    "/pets/" + id + "/edit?returnTo=//evil.test",
  ])
    assert.equal(nav.safeOwnerMatingReturn(input), "/mating/my");
});
