import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { ownerPublication, canSubmitPublication, canEditPublication } =
  await load("src/shared/lib/moderation.ts");
for (const status of ["DRAFT", "ACTIVE"]) {
  test(`${status} moderation presentation and action authority`, () => {
    assert.equal(
      ownerPublication({ status, moderationStatus: "PENDING" }).label,
      "На модерації",
    );
    assert.equal(
      ownerPublication({ status, moderationStatus: "PENDING" }).helper,
      "Оголошення перевіряється перед публікацією.",
    );
    assert.equal(
      ownerPublication({ status, moderationStatus: "REJECTED" }).label,
      "Відхилено",
    );
    assert.equal(
      ownerPublication({ status, moderationStatus: "HIDDEN" }).label,
      "Приховано",
    );
    assert.equal(
      canSubmitPublication({ status, moderationStatus: "HIDDEN" }),
      false,
    );
    assert.equal(
      canEditPublication({ status, moderationStatus: "HIDDEN" }),
      false,
    );
    assert.equal(
      canSubmitPublication({ status, moderationStatus: "PENDING" }),
      false,
    );
    assert.equal(
      canEditPublication({ status, moderationStatus: "PENDING" }),
      true,
    );
    assert.equal(
      canSubmitPublication({ status, moderationStatus: "REJECTED" }),
      true,
    );
  });
}
test("business lifecycle and public approval stay distinct", () => {
  assert.equal(
    ownerPublication({ status: "DRAFT", moderationStatus: "NOT_SUBMITTED" })
      .label,
    "Чернетка",
  );
  assert.equal(
    ownerPublication({ status: "ACTIVE", moderationStatus: "APPROVED" }).label,
    "Активне",
  );
  assert.equal(
    ownerPublication({ status: "CLOSED", moderationStatus: "PENDING" }).label,
    "Завершено",
  );
  assert.equal(
    ownerPublication({ status: "ARCHIVED", moderationStatus: "REJECTED" })
      .label,
    "Архів",
  );
});

test("Pet publication cache refresh is scoped to publication families and current user", async () => {
  const { refreshPetPublications } = await load(
    "src/shared/lib/publication-cache.ts",
  );
  const calls = [];
  const client = {
    getQueryData: () => ({ id: "A" }),
    invalidateQueries: async ({ queryKey }) => calls.push(queryKey),
  };
  await refreshPetPublications(client, "B", "pet");
  assert.deepEqual(calls, []);
  await refreshPetPublications(client, "A", "pet");
  for (const key of [
    "listings",
    "seller-listings",
    "favorites",
    "mating-public",
  ])
    assert.ok(calls.some((x) => x[0] === key));
  assert.ok(calls.some((x) => x[0] === "public-pet" && x[1] === "pet"));
  assert.ok(calls.every((x) => x.length > 0));
  assert.ok(!calls.some((x) => x[0] === "reviews" || x[0] === "species"));
});
