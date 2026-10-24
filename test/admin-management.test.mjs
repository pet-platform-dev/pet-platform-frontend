import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const nav = await load("src/features/admin/management/navigation.ts");
const model = await load("src/features/admin/management/model.ts");
const { parseManagedFields, consentSchema } = await load(
  "src/features/admin/management/form-validation.ts",
);
const { ManagementListCards } = await load(
  "src/features/admin/management/list-cards.tsx",
);
const { ConsentFields, emptyConsent } = await load(
  "src/features/admin/management/consent-fields.tsx",
);
const { clearAdminQueries, runAdminRequest } = await load(
  "src/features/admin/moderation/cache.ts",
);
const { isSessionQuery } = await load("src/features/auth/session-provider.tsx");
const { managementKey } = await load("src/features/admin/management/api.ts");
const id = "11111111-1111-4111-8111-111111111111";
const user = {
  id,
  firstName: "Тест <script>",
  lastName: "Ім’я",
  email: "synthetic@example.invalid",
  role: "ADMIN",
  accountType: "SELLER",
  verificationStatus: "VERIFIED",
  createdAt: "2026-01-01T00:00:00.000Z",
};
test("management URLs preserve bounded filters, page and sort; reject external or unrelated returns", () => {
  const state = nav.parseListState(
    new URLSearchParams(
      "q=++Олена+++Петренко++&page=2&sort=NAME_ASC&role=ADMIN&accountType=BREEDER&verificationStatus=VERIFIED&unknown=secret",
    ),
    "users",
  );
  assert.equal(state.q, "Олена Петренко");
  const href = nav.listHref("users", state);
  assert.equal(nav.managementReturn(href, "users"), href);
  const detail = new URL(
    nav.managedDetailHref("users", id, state),
    "https://internal.invalid",
  );
  assert.equal(detail.searchParams.get("returnTo"), href);
  assert(
    href.includes("page=2") &&
      href.includes("sort=NAME_ASC") &&
      !href.includes("unknown"),
  );
  for (const bad of [
    "https://evil.invalid/admin/users",
    "//evil.invalid/admin/users",
    "/admin/users/../breeders",
    "/admin/users#fragment",
    "/admin/users\\evil",
    "/listings",
    "/admin/users/%2e%2e",
  ])
    assert.equal(nav.managementReturn(bad, "users"), "/admin/users");
  const invalid = nav.parseListState(
    new URLSearchParams(
      "page=100001&sort=DROP&role=ROOT&accountType=FAKE&verificationStatus=ACTIVE",
    ),
    "users",
  );
  assert.equal(nav.listHref("users", invalid), "/admin/users");
});
test("breeder source and visibility are explicit, independently paginated and retained in detail links", () => {
  const state = nav.parseListState(
    new URLSearchParams(
      "source=OPERATOR_PREPARED&visibility=PRIVATE&page=2&sort=OLDEST",
    ),
    "breeders",
  );
  const url = new URL(
    nav.managedDetailHref("breeders", id, state),
    "https://internal.invalid",
  );
  assert.equal(url.searchParams.get("source"), "OPERATOR_PREPARED");
  assert.equal(
    nav.managementReturn(url.searchParams.get("returnTo"), "breeders"),
    nav.listHref("breeders", state),
  );
});
test("safe user contract strips credentials and cards escape identity while exposing only record detail action", () => {
  const safe = model.userSchema.parse({
    ...user,
    passwordHash: "secret",
    sessions: ["private"],
  });
  assert.deepEqual(safe, user);
  const html = renderToStaticMarkup(
    React.createElement(ManagementListCards, {
      rows: [safe],
      kind: "users",
      state: nav.parseListState(new URLSearchParams(), "users"),
    }),
  );
  assert(html.includes("&lt;script&gt;") && html.includes(user.email));
  assert(!html.includes("<script>") && !html.includes("<button"));
  assert(html.includes(`/admin/users/${id}`));
});
test("incomplete draft is allowed but owner name, validated references and safe text remain required", () => {
  const values = {
    kennelName: "",
    description: "",
    website: "",
    startedYear: "",
  };
  assert.equal(parseManagedFields(values, true, null, [], "").success, true);
  assert.equal(parseManagedFields(values, false, null, [], "").success, false);
  assert.equal(
    parseManagedFields(values, true, "invalid", [], "").success,
    false,
  );
  assert.equal(
    parseManagedFields(values, true, null, ["invalid"], "").success,
    false,
  );
  assert.equal(
    parseManagedFields(values, true, null, [], "<script>alert(1)</script>")
      .success,
    false,
  );
});
test("permission must be explicit, dated and scoped; default consent does not invent permission", () => {
  const permission = {
    consentConfirmed: true,
    consentAt: "2026-01-01T10:00:00.000Z",
    consentScope: "Private preparation only",
    consentSource: "OWNER_MESSAGE",
    sourceReference: "synthetic-permission-18b",
  };
  assert.equal(consentSchema.safeParse(permission).success, true);
  for (const change of [
    { consentConfirmed: false },
    { consentAt: "" },
    { consentAt: "2099-01-01" },
    { consentScope: "yes" },
    { sourceReference: "" },
    { ownerId: id },
    { consentSource: "PUBLIC_WEBSITE" },
  ])
    assert.equal(
      consentSchema.safeParse({ ...permission, ...change }).success,
      false,
    );
  assert.equal(consentSchema.safeParse(emptyConsent).success, false);
  const html = renderToStaticMarkup(
    React.createElement(ConsentFields, {
      value: emptyConsent,
      onChange() {},
      errors: {},
    }),
  );
  assert(!html.includes(" checked"));
  assert(
    html.includes("не є згодою") && html.includes('type="datetime-local"'),
  );
});
test("private admin-management caches clear together and late responses cannot cross identity boundary", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["current-user"], user);
  const key = managementKey(id, "users", { page: 1 });
  assert.equal(isSessionQuery({ queryKey: key }), true);
  client.setQueryData(key, { private: true });
  client.setQueryData(["public"], "retained");
  let release;
  const pending = runAdminRequest(
    client,
    id,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  client.setQueryData(["current-user"], {
    ...user,
    id: "22222222-2222-4222-8222-222222222222",
  });
  release({ private: true });
  await assert.rejects(pending, { name: "AbortError" });
  clearAdminQueries(client);
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(client.getQueryData(["public"]), "retained");
  client.clear();
});
