import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { buildContentInput } = await load(
  "src/features/admin/content/editor-input.ts",
);
const { contentParams, readSource } = await load(
  "src/features/admin/content/navigation.ts",
);
const { contentSchema, petSchema } = await load(
  "src/features/admin/content/model.ts",
);
const { contentKey } = await load("src/features/admin/content/api.ts");
const { runAdminRequest, clearAdminQueries } = await load(
  "src/features/admin/moderation/cache.ts",
);
const { clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  at = "2026-01-01T00:00:00.000Z";
const identity = {
  id,
  firstName: "Олена",
  lastName: "Тестова",
  accountType: "SELLER",
};
const draft = {
  id,
  source: "OPERATOR_DRAFT",
  kind: "SALE",
  type: "SALE",
  title: "Справжня чернетка",
  description: "",
  status: "DRAFT",
  price: null,
  currency: "UAH",
  location: null,
  createdAt: at,
  updatedAt: at,
  images: [],
  publicPath: null,
  speciesId: null,
  breedId: null,
  locationId: null,
  breederDraftId: null,
  species: null,
  breed: null,
  requirements: null,
  ownerReference: null,
  createdById: id,
  updatedById: id,
};
const input = () => ({
  row: null,
  title: "Справжня чернетка",
  description: "",
  price: "",
  reason: "",
  kind: "SALE",
  requirements: "",
  status: "DRAFT",
  transition: "",
  speciesId: "",
  breedId: null,
  locationId: null,
  photos: { images: [], imageIds: [] },
  draftDetails: {
    ownerReference: "",
    breederDraftId: "",
  },
});
test("private preparation serializes no owner, Pet or public publication fields", () => {
  const body = buildContentInput(input());
  assert.equal(body.status, "DRAFT");
  for (const key of [
    "sellerId",
    "ownerId",
    "petId",
    "publishedAt",
    "moderationStatus",
  ])
    assert(!Object.hasOwn(body, key));
  assert.deepEqual(contentSchema.parse(draft), draft);
});
test("readiness requires actual content, while images require no consent paperwork", () => {
  assert.throws(
    () => buildContentInput({ ...input(), status: "READY_FOR_REVIEW" }),
    /потрібні вид/,
  );
  const value = input();
  value.photos.images = [{ uploadId: id }];
  const body = buildContentInput(value);
  assert.deepEqual(body.imageIds, [id]);
  for (const key of [
    "consentConfirmed",
    "consentAt",
    "consentScope",
    "consentSource",
    "sourceReference",
    "mediaRightsReference",
  ])
    assert(!Object.hasOwn(body, key));
});
test("retained and uploaded custody IDs use existing session with exact optimistic revision", () => {
  const v = input();
  v.row = draft;
  v.photos = {
    images: [{ imageId: id }, { uploadId: other }],
    imageIds: [other],
    uploadSessionId: id,
  };
  const body = buildContentInput(v);
  assert.deepEqual(body.imageIds, [id, other]);
  assert.equal(body.expectedUpdatedAt, at);
  assert.equal(body.uploadSessionId, id);
});
test("material editing requires explicit reason, avoids silent no-op and preserves ownership metadata", () => {
  const pet = {
    id,
    name: "Пес",
    gender: "MALE",
    birthDate: null,
    visibility: "PRIVATE",
    createdAt: at,
    updatedAt: at,
    species: { id, name: "Собака" },
    breed: null,
    owner: identity,
  };
  const row = {
    ...draft,
    source: "LISTING",
    owner: identity,
    pet,
    location: {
      id,
      city: "Київ",
      region: "Київ",
      district: null,
      community: null,
      settlementType: "CITY",
    },
    moderationStatus: "APPROVED",
    moderationReason: null,
  };
  const v = { ...input(), row, locationId: id };
  assert.throws(() => buildContentInput(v), /причину/);
  v.reason = "Owner asked to correct title";
  assert.throws(() => buildContentInput(v), /хоча б одне/);
  v.title = "Змінений заголовок";
  const body = buildContentInput(v);
  assert.equal(body.expectedUpdatedAt, at);
  assert.equal(body.title, v.title);
  assert(!Object.hasOwn(body, "petId"));
  assert(!Object.hasOwn(body, "ownerId"));
  assert(
    !Object.hasOwn(
      petSchema.parse({ ...pet, healthNotes: "private", messages: [] }),
      "healthNotes",
    ),
  );
});
test("bounded URL modules retain supported filters and reject external/unknown source", () => {
  const p = contentParams(
    new URLSearchParams(
      "source=MATING&q=Олена&page=2&limit=48&sort=OLDEST&type=MATING&role=ADMIN",
    ),
    false,
  );
  assert.equal(p.get("page"), "2");
  assert.equal(p.get("source"), "MATING");
  assert(!p.has("role"));
  assert.equal(readSource("https://evil.invalid"), "LISTING");
  assert(!contentParams(p, true).has("source"));
  assert.equal(
    contentParams(new URLSearchParams("page=-1&limit=999"), false).get("limit"),
    "24",
  );
});
test("admin content response rejects foreign public redirect and untrusted image URL", () => {
  assert(
    !contentSchema.safeParse({ ...draft, publicPath: "https://evil.invalid" })
      .success,
  );
  assert(
    !contentSchema.safeParse({
      ...draft,
      images: [{ id, url: "javascript:alert(1)" }],
    }).success,
  );
});
test("logout/admin access loss removes actor-private content queries", () => {
  for (const clear of [clearAdminQueries, clearPrivateQueries]) {
    const client = new QueryClient();
    client.setQueryData(contentKey(id, "detail", id, "OPERATOR_DRAFT"), draft);
    clear(client);
    assert.equal(
      client.getQueryData(contentKey(id, "detail", id, "OPERATOR_DRAFT")),
      undefined,
    );
    client.clear();
  }
});
test("delayed content response cannot repopulate another actor or demoted session", async () => {
  for (const next of [
    { id: other, role: "ADMIN" },
    { id, role: "USER" },
  ]) {
    const client = new QueryClient();
    client.setQueryData(["current-user"], { id, role: "ADMIN" });
    let done;
    const work = runAdminRequest(
      client,
      id,
      () =>
        new Promise((r) => {
          done = r;
        }),
    );
    client.setQueryData(["current-user"], next);
    done(draft);
    await assert.rejects(work, { name: "AbortError" });
    assert.equal(client.getQueryData(contentKey(id, "detail", id)), undefined);
    client.clear();
  }
});
