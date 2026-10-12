import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { MatingPetSummary } = await load(
  "src/features/mating/pet-selection.tsx",
);
const { FeeChoice } = await load("src/features/mating/fee-choice.tsx");
const { MatingCard, MatingEmpty } = await load(
  "src/features/mating/mating-card.tsx",
);
const pet = {
  id: "11111111-1111-4111-8111-111111111111",
  name: null,
  gender: "MALE",
  birthDate: null,
  species: {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "dog",
    name: "Собака",
  },
  breed: null,
  profileImage: null,
};
const html = (C, props) => renderToStaticMarkup(React.createElement(C, props));
test("unnamed Pet uses breed/species + gender without historical private preview fallback", () => {
  const markup = html(MatingPetSummary, {
    pet: {
      ...pet,
      previewImage: { thumbnailUrl: "https://example.invalid/private.jpg" },
    },
  });
  assert.match(markup, /Самець/);
  assert.doesNotMatch(markup, /Без імені|private.jpg/);
});
test("named Pet keeps optional name as secondary metadata", () =>
  assert.match(
    html(MatingPetSummary, { pet: { ...pet, name: "Рекс" } }),
    /Рекс/,
  ));
for (const mode of ["agreement", "free", "fixed"])
  test("fee choice " + mode + " has labeled native radio semantics", () => {
    const markup = html(FeeChoice, {
      mode,
      value: "10.50",
      onMode: () => {},
      onValue: () => {},
      error: "Перевірте суму.",
    });
    assert.equal((markup.match(/type="radio"/g) || []).length, 3);
    for (const label of ["За домовленістю", "Безкоштовно", "Фіксована оплата"])
      assert.ok(markup.includes(label));
    assert.equal(markup.includes("Сума, грн"), mode === "fixed");
    if (mode === "fixed") assert.match(markup, /aria-invalid="true"/);
  });
test("owner empty state has compact explanation and create CTA", () => {
  const markup = html(MatingEmpty, {});
  assert.match(markup, /У вас ще немає оголошень про в’язку/);
  assert.match(markup, /href="\/mating\/new"/);
});
for (const [status, label] of [
  ["DRAFT", "Чернетка"],
  ["ACTIVE", "Активне"],
  ["CLOSED", "Завершено"],
  ["ARCHIVED", "Архів"],
])
  test(
    "owner card " + status + " uses readable label and owner edit route",
    () => {
      const markup = html(MatingCard, {
        row: {
          id: pet.id,
          pet,
          status,
          fee: null,
          location: { city: "Київ", region: "Київська область" },
          updatedAt: "2026-10-11T10:00:00Z",
        },
      });
      assert.ok(markup.includes(label));
      assert.ok(markup.includes(`/mating/${pet.id}/edit`));
      assert.doesNotMatch(markup, /DRAFT|ACTIVE|CLOSED|ARCHIVED/);
    },
  );
test("Pet profile image takes priority and never uses ordinary preview media", () => {
  const markup = html(MatingPetSummary, {
    pet: {
      ...pet,
      profileImage: {
        url: "https://example.invalid/profile.jpg",
        thumbnailUrl: "https://example.invalid/profile-thumb.jpg",
      },
      previewImage: { thumbnailUrl: "https://example.invalid/private.jpg" },
    },
  });
  assert.match(markup, /src="https:\/\/example.invalid\/profile-thumb.jpg"/);
  assert.doesNotMatch(markup, /private.jpg/);
});
