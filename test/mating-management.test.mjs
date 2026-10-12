import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/features/mating/model.ts");
const entity = await load("src/entities/mating-listing/model.ts");
const { ApiError } = await load("src/shared/api/client.ts");
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  petId: id,
  locationId: id,
  description: "  Спокійний характер.  ",
  feeMode: "agreement",
  feeText: "",
};
test("creation fields trim description and agreement maps to null without Pet reassignment in PATCH", () => {
  assert.deepEqual(model.matingFields(input), {
    description: "Спокійний характер.",
    locationId: id,
    fee: null,
  });
});
for (const [mode, text, fee] of [
  ["agreement", "bad", null],
  ["free", "bad", "0"],
  ["fixed", " 1234,50 ", "1234.50"],
  ["fixed", "0", "0"],
  ["fixed", "9999999999.99", "9999999999.99"],
])
  test(`fee mode ${mode} serializes ${text} safely`, () =>
    assert.equal(
      model.matingFields({ ...input, feeMode: mode, feeText: text }).fee,
      fee,
    ));
for (const feeText of [
  "",
  "-1",
  "1e3",
  "1.001",
  "01",
  "10000000000",
  "1,2,3",
  "NaN",
])
  test(`fixed fee rejects ${feeText}`, () =>
    assert.equal(
      model.matingFormSchema.safeParse({ ...input, feeMode: "fixed", feeText })
        .success,
      false,
    ));
for (const description of [
  "",
  "  ",
  "<script>x</script>",
  "x\u0000y",
  "x".repeat(5001),
])
  test("description follows plain trimmed backend limit", () =>
    assert.equal(
      model.matingFormSchema.safeParse({ ...input, description }).success,
      false,
    ));
test("exact fee formatting and mode hydration distinguish agreement, zero and fixed", () => {
  assert.equal(entity.feeLabel(null), "За домовленістю");
  assert.equal(entity.feeLabel("0.00"), "Безкоштовно");
  assert.match(entity.feeLabel("9999999999.99"), /99.*₴/);
  assert.equal(model.feeMode(null), "agreement");
  assert.equal(model.feeMode("0.00"), "free");
  assert.equal(model.feeMode("10.50"), "fixed");
});
for (const [status, label, actions] of [
  ["DRAFT", "Чернетка", ["publish", "archive", "delete"]],
  ["ACTIVE", "Активне", ["close", "archive"]],
  ["CLOSED", "Завершено", ["archive"]],
  ["ARCHIVED", "Архів", []],
])
  test(`${status} has Ukrainian label and explicit lifecycle actions`, () => {
    assert.equal(entity.statusLabels[status], label);
    assert.deepEqual(
      entity.matingActions({
        status,
        moderationStatus: status === "ACTIVE" ? "APPROVED" : "NOT_SUBMITTED",
        publishedAt: null,
      }),
      actions,
    );
    assert.equal(entity.canEdit(status), ["DRAFT", "ACTIVE"].includes(status));
  });
test("historically published DRAFT cannot expose delete", () =>
  assert.ok(
    !entity
      .matingActions({ status: "DRAFT", publishedAt: "2026-01-01" })
      .includes("delete"),
  ));
test("eligibility requires known Pet sex, with no veterinary age restriction", () => {
  assert.equal(model.petEligible({ gender: "UNKNOWN" }), false);
  assert.equal(model.petEligible({ gender: "MALE", birthDate: null }), true);
  assert.equal(
    model.petEligible({ gender: "FEMALE", birthDate: "2026-10-10" }),
    true,
  );
});
test("API errors are mapped without leaking backend internals", () => {
  assert.equal(
    model.matingError(new ApiError(404, "Prisma")),
    "Оголошення недоступне.",
  );
  assert.match(
    model.matingError(
      new ApiError(409, "Тварина вже має активне оголошення про в’язку"),
    ),
    /Для цієї тварини вже є активне/,
  );
  assert.match(
    model.matingError(new ApiError(400, "Спочатку вкажіть стать тварини")),
    /стать тварини/,
  );
  assert.match(
    model.matingError(new ApiError(400, "Оберіть доступний населений пункт")),
    /населений пункт/,
  );
  assert.equal(
    model.matingError(new ApiError(500, "Prisma")),
    "Не вдалося зберегти оголошення.",
  );
});
