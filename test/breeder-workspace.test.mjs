import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { load } from "./helpers/load-frontend.mjs";
const { buildContentInput } = await load(
  "src/features/admin/content/editor-input.ts",
);
const { reorderImages } = await load(
  "src/features/listing/create-listing/model/images.ts",
);
const { isSessionQuery, clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { QueryClient } = await import("@tanstack/react-query");
test("breeder context, animal fields and photo order survive private draft serialization without ownership fabrication", () => {
  const breeder = randomUUID(),
    first = randomUUID(),
    second = randomUUID(),
    session = randomUUID();
  const result = buildContentInput({
    row: null,
    title: "Синтетична тварина",
    description: "Опис тварини",
    price: "100",
    reason: "",
    kind: "SALE",
    requirements: "",
    status: "DRAFT",
    transition: "",
    speciesId: randomUUID(),
    breedId: null,
    locationId: randomUUID(),
    gender: "FEMALE",
    birthDate: "2025-01-01",
    photos: {
      uploadSessionId: session,
      imageIds: [first, second],
      images: [{ uploadId: second }, { uploadId: first }],
    },
    draftDetails: { ownerReference: "", breederDraftId: breeder },
  });
  assert.equal(result.breederDraftId, breeder);
  assert.equal(result.gender, "FEMALE");
  assert.equal(result.birthDate, "2025-01-01");
  assert.deepEqual(result.imageIds, [second, first]);
  assert(!("ownerId" in result));
  assert(!("petId" in result));
  assert.equal(result.status, "DRAFT");
});
test("existing photo reorder supports keyboard/button main-photo selection without losing custody IDs", () => {
  const photos = [
    { id: "a", url: "a" },
    { id: "b", url: "b" },
    { id: "c", url: "c" },
  ];
  assert.deepEqual(
    reorderImages(photos, 2, 0).map((p) => p.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    photos.map((p) => p.id),
    ["a", "b", "c"],
  );
});
test("owner handoff and workspace queries are private and cleared at a session boundary", () => {
  const client = new QueryClient();
  for (const key of [
    ["breeder-handoffs", "owner-a", 1],
    ["admin-management", "admin-a", "workspace-listings", "draft-a"],
    ["breeder", "public-a"],
  ])
    client.setQueryData(key, { synthetic: true });
  assert.equal(
    isSessionQuery({ queryKey: ["breeder-handoffs", "owner-a", 1] }),
    true,
  );
  clearPrivateQueries(client);
  assert.equal(
    client.getQueryData(["breeder-handoffs", "owner-a", 1]),
    undefined,
  );
  assert.equal(
    client.getQueryData([
      "admin-management",
      "admin-a",
      "workspace-listings",
      "draft-a",
    ]),
    undefined,
  );
  assert.deepEqual(client.getQueryData(["breeder", "public-a"]), {
    synthetic: true,
  });
  client.clear();
});
test("prepared preview caches are owner/private and cleared on account switching, while public breeder cache survives", () => {
  const client = new QueryClient();
  const key = ["breeder-handoffs", "owner-a", "prepared", "profile-a", 1];
  client.setQueryData(key, { data: [{ id: "synthetic-prepared" }] });
  client.setQueryData(["breeder", "public-a"], { public: true });
  clearPrivateQueries(client);
  assert.equal(client.getQueryData(key), undefined);
  assert.deepEqual(client.getQueryData(["breeder", "public-a"]), {
    public: true,
  });
});
