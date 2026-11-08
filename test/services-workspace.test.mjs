import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { load } from "./helpers/load-frontend.mjs";
const validation = await load("src/entities/service-provider/validation.ts");
const model = await load("src/entities/service-provider/model.ts");
const api = await load("src/entities/service-provider/api.ts");
const client = await load("src/shared/api/client.ts");
const session = await load("src/features/auth/session-provider.tsx");
const workspace = await load("src/features/services/workspace/session.tsx");
const { Status } = await load("src/features/services/workspace/ui.tsx");
const { CategoryFields, categoryFields } = await load(
  "src/features/services/offer-editor/category-fields.tsx",
);
const { favoriteLoginReturn } = await load(
  "src/features/favorites/login-return.ts",
);
const { QueryClient } =
  await import("../node_modules/@tanstack/react-query/build/modern/index.js");
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  revision = "2026-11-06T00:00:00.000Z";
const provider = {
  ...validation.emptyProvider,
  publicName: "Синтетичний спеціаліст",
  description: "Послуги догляду",
  website: "https://example.invalid",
};
const owned = {
  ...provider,
  id,
  status: "DRAFT",
  moderationStatus: "NOT_SUBMITTED",
  moderationReason: null,
  updatedAt: revision,
  createdAt: revision,
  publishedAt: null,
  moderatedAt: null,
  primaryLocation: null,
  contactRevision: 1,
};
const offer = {
  categoryId: id,
  title: "Демонстраційна послуга",
  description: "Догляд",
  mode: "REMOTE",
  price: { mode: "FIXED", amount: "1250.50", unit: "SERVICE" },
  speciesIds: [id],
  providerLocationIds: [],
  detailsVersion: 1,
  details: {},
};
test("S8 PATCH retains saved inactive references without explicitly reselecting them", () => {
  const saved = {
    id: other,
    updatedAt: revision,
    categoryId: id,
    species: [{ id }],
    locations: [],
  };
  const body = api.offerWriteBody({ ...offer, title: "Нова назва" }, saved);
  assert.equal(body.title, "Нова назва");
  assert.equal(body.expectedUpdatedAt, revision);
  for (const key of [
    "categoryId",
    "speciesIds",
    "providerLocationIds",
    "confirmCategoryChange",
  ])
    assert.equal(Object.hasOwn(body, key), false);
  const changed = api.offerWriteBody(
    {
      ...offer,
      mode: "ONSITE",
      categoryId: other,
      speciesIds: [other],
      providerLocationIds: [other],
    },
    saved,
    true,
  );
  assert.equal(changed.categoryId, other);
  assert.deepEqual(changed.speciesIds, [other]);
  assert.deepEqual(changed.providerLocationIds, [other]);
  assert.equal(changed.confirmCategoryChange, true);
  assert.deepEqual(api.offerWriteBody(offer).speciesIds, [id]);
});
test("S8 saved category remains editable when absent from the active catalog", async () => {
  const { offerCategories } = await load(
    "src/features/services/offer-editor/references.ts",
  );
  const saved = {
    categoryId: id,
    category: { id, slug: "grooming", nameUk: "Грумінг", isActive: false },
  };
  const choices = offerCategories([], saved, "INDIVIDUAL");
  assert.equal(choices.length, 1);
  assert.equal(choices[0].slug, "grooming");
  assert.equal(choices[0].nameUk, "Грумінг (неактивна)");
  assert.equal(offerCategories(choices, saved, "INDIVIDUAL").length, 1);
  assert.deepEqual(offerCategories([], undefined, "INDIVIDUAL"), []);
});
test("S8 exact provider contract: both kinds, optional contacts, normalization, no owner/state mass assignment", () => {
  for (const kind of ["INDIVIDUAL", "ORGANIZATION"])
    assert.equal(
      validation.providerInputSchema.parse({ ...provider, kind }).kind,
      kind,
    );
  const p = validation.providerInputSchema.parse({
    ...provider,
    phone: "+380 (50) 123-45-67",
    telegram: "@demo_test",
    whatsapp: "",
  });
  assert.equal(p.phone, "+380501234567");
  assert.equal(p.telegram, "demo_test");
  assert.equal(p.whatsapp, null);
  for (const extra of [
    { ownerId: id },
    { moderationStatus: "APPROVED" },
    { verificationStatus: "VERIFIED" },
    { categoryId: id },
  ])
    assert.equal(
      validation.providerInputSchema.safeParse({ ...provider, ...extra })
        .success,
      false,
    );
  for (const website of [
    "javascript:alert(1)",
    "https://a:b@example.invalid",
    "https://example.invalid/a b",
  ])
    assert.equal(
      validation.providerInputSchema.safeParse({ ...provider, website })
        .success,
      false,
    );
});
test("S8 offer decimal strings, supported species, locations and protected fields", () => {
  assert.equal(
    validation.offerInputSchema.parse(offer).price.amount,
    "1250.50",
  );
  for (const amount of ["0", "-1", "1e3", "1.001", "NaN", "Infinity", 1250.5])
    assert.equal(
      validation.offerInputSchema.safeParse({
        ...offer,
        price: { ...offer.price, amount },
      }).success,
      false,
    );
  assert.equal(
    validation.offerInputSchema.safeParse({
      ...offer,
      price: { mode: "ON_REQUEST", amount: null, unit: null },
    }).success,
    true,
  );
  for (const patch of [
    { price: { mode: "ON_REQUEST", amount: "1", unit: "VISIT" } },
    { providerLocationIds: [id] },
    { speciesIds: [id, id] },
    { ownerId: id },
    { providerId: id },
    { status: "ACTIVE" },
    { detailsVersion: 2 },
  ])
    assert.equal(
      validation.offerInputSchema.safeParse({ ...offer, ...patch }).success,
      false,
    );
});
const examples = {
  "veterinary-care": {
    consultationType: "GENERAL",
    specialties: ["Консультації"],
    emergencyContactAvailable: false,
    experienceYears: 3,
  },
  "pet-transportation": {
    coverage: "INTERNATIONAL",
    transportFormat: "PET_TAXI",
    operatingArea: "Приклад",
    accompanied: true,
    maxWeightKg: 40,
  },
  grooming: {
    petSizes: ["SMALL", "LARGE"],
    techniques: ["Купання"],
    maxWeightKg: 30,
  },
  "dog-training": { sessionFormat: "BOTH", focusAreas: ["Команди"] },
  "pet-boarding": {
    setting: "HOME",
    capacity: 2,
    vaccinationRequired: true,
    conditions: ["Власний корм"],
  },
  "pet-sitting": { careFormat: "HOME_VISITS", conditions: ["Розклад"] },
  "pet-walking": { walkDurationMinutes: 45 },
};
for (const [slug, details] of Object.entries(examples))
  test(`S8 ${slug}: strict version-1 fields and shared UI`, () => {
    assert.deepEqual(
      validation.validateOffer({ ...offer, details }, slug).details,
      details,
    );
    assert.throws(() =>
      validation.validateOffer(
        { ...offer, details: { ...details, unsupported: true } },
        slug,
      ),
    );
    const html = renderToStaticMarkup(
      React.createElement(CategoryFields, {
        slug,
        value: details,
        onChange() {},
      }),
    );
    assert.match(html, /Особливості послуги/);
    assert.ok(
      categoryFields[slug].every((f) =>
        html.includes(f.label.replaceAll("&", "&amp;")),
      ),
    );
  });
test("S8 category validation rejects text overflow, duplicate sizes, invalid bounds and cross-category leftovers", () => {
  for (const [slug, details] of [
    ["pet-walking", { walkDurationMinutes: 9 }],
    ["pet-boarding", { capacity: 101 }],
    ["grooming", { petSizes: ["SMALL", "SMALL"] }],
    ["grooming", { techniques: Array(11).fill("Купання") }],
    ["pet-sitting", { conditions: ["x".repeat(81)] }],
    ["pet-walking", { conditions: ["Стара категорія"] }],
  ])
    assert.throws(() => validation.validateOffer({ ...offer, details }, slug));
});
test("S8 lifecycle and moderation are readable, escaped and do not invent owner approval", () => {
  for (const state of [
    "NOT_SUBMITTED",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "HIDDEN",
  ]) {
    const row = {
      ...owned,
      moderationStatus: state,
      moderationReason: "<script>not markup</script>",
    };
    const html = renderToStaticMarkup(React.createElement(Status, { row }));
    assert.ok(!html.includes("<script>"));
    assert.match(html, /catalog-chip/);
    assert.equal(
      model.canSubmit(row),
      ["NOT_SUBMITTED", "REJECTED"].includes(state),
    );
  }
  assert.equal(model.editable({ ...owned, status: "ARCHIVED" }), false);
  assert.equal(model.editable({ ...owned, moderationStatus: "HIDDEN" }), false);
});
test("S8 safe login return allows only actual internal workspace routes", () => {
  for (const path of [
    "/my-services",
    "/my-services/new",
    `/my-services/${id}`,
    `/my-services/${id}/edit`,
    `/my-services/${id}/offers/new`,
    `/my-services/${id}/offers/${other}/edit`,
  ])
    assert.equal(favoriteLoginReturn(path), path);
  for (const path of [
    "https://evil.invalid/my-services",
    "//evil.invalid/my-services",
    "/my-services-admin",
    `/my-services/${id}/approve`,
    "/my-services/%2e%2e/admin",
  ])
    assert.equal(favoriteLoginReturn(path), "/account");
});
test("S8 private keys include actor + generation; logout removes queries and mutation evidence, preserving public data", async () => {
  const q = new QueryClient();
  q.setQueryData(["current-user"], { id });
  const generation = client.currentSessionGeneration(),
    scope = { userId: id, generation };
  const key = workspace.workspaceKey(id, generation, id, "provider");
  q.setQueryData(key, owned);
  q.setQueryData(["service-offers"], { public: true });
  q.getMutationCache().build(q, {
    mutationKey: ["service-workspace", id, generation],
  });
  assert.ok(workspace.currentWorkspace(q, scope));
  session.clearPrivateQueries(q);
  assert.equal(q.getQueryData(key), undefined);
  assert.equal(q.getMutationCache().getAll().length, 0);
  assert.deepEqual(q.getQueryData(["service-offers"]), { public: true });
  client.clearSession();
  assert.equal(workspace.currentWorkspace(q, scope), false);
  assert.equal(await workspace.invalidateWorkspace(q, scope), false);
  q.clear();
});
test("S8 media client guards 3 MiB/MIME and no empty files", () => {
  api.validateFile({ size: 3 * 1024 * 1024, type: "image/png" });
  for (const file of [
    { size: 3 * 1024 * 1024 + 1, type: "image/png" },
    { size: 0, type: "image/png" },
    { size: 100, type: "image/svg+xml" },
  ])
    assert.throws(() => api.validateFile(file));
});
test("S8 adapters preserve auth, CSRF, revision, exact DTO and multipart routes", async () => {
  const original = globalThis.fetch,
    calls = [];
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000/api/v1";
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    let data = owned;
    if (path === "/api/v1/auth/csrf") data = { csrfToken: "s".repeat(43) };
    else if (path === "/api/v1/auth/login")
      data = {
        user: { id },
        accessToken: "synthetic-test-token",
        expiresIn: 900,
      };
    else if (path.includes("/media"))
      data = { updatedAt: revision, coverMediaId: null, items: [] };
    return Response.json({ data });
  };
  try {
    await client.signIn("login", {});
    await api.createProvider(provider);
    await api.updateProvider(id, provider, revision);
    await api.lifecycleAction(id, "submit", revision);
    await api.lifecycleAction(id, "archive", revision);
    await api.uploadMedia(
      id,
      undefined,
      new File(["synthetic"], "test.png", { type: "image/png" }),
      "LOGO",
      revision,
    );
    await api.reorderMedia(id, undefined, [], revision);
    await api.removeMedia(id, undefined, other, revision);
    const writes = calls.filter((c) => c.path.includes("/service-workspace"));
    for (const c of writes) {
      assert.equal(
        c.options.headers.Authorization,
        "Bearer synthetic-test-token",
      );
      assert.equal(c.options.headers["X-CSRF-Token"], "s".repeat(43));
      assert.equal(c.options.credentials, "include");
    }
    const patch = writes.find((c) => c.options.method === "PATCH");
    const body = JSON.parse(patch.options.body);
    assert.equal(body.expectedUpdatedAt, revision);
    assert.equal(body.kind, undefined);
    assert.equal(body.ownerId, undefined);
    const upload = writes.find((c) => c.options.body instanceof FormData);
    assert.equal(upload.options.body.get("type"), "LOGO");
    assert.equal(upload.options.headers["Content-Type"], undefined);
    assert.equal(
      writes.find((c) => c.path.endsWith("/reorder")).options.method,
      "POST",
    );
  } finally {
    globalThis.fetch = original;
    client.clearSession();
  }
});
test("S8 route inventory and management boundary preserve auth and separate save from submit", async () => {
  for (const file of [
    "page.tsx",
    "new/page.tsx",
    "[providerId]/page.tsx",
    "[providerId]/edit/page.tsx",
    "[providerId]/offers/new/page.tsx",
    "[providerId]/offers/[offerId]/edit/page.tsx",
  ])
    assert.ok(
      (await readFile("src/app/my-services/" + file, "utf8")).includes(
        "export default",
      ),
    );
  const layout = await readFile("src/app/my-services/layout.tsx", "utf8");
  assert.match(layout, /WorkspaceSession/);
  assert.match(layout, /index: false/);
  const editor = await readFile(
    "src/features/services/offer-editor/offer-form.tsx",
    "utf8",
  );
  assert.match(editor, /confirmChange/);
  assert.match(editor, /setDetails\(\{\}\)/);
  assert.ok(!editor.includes("\/approve"));
});
