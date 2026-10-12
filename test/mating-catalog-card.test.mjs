import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { PublicMatingCard } = await load(
  "src/features/mating/catalog/public-card.tsx",
);
const { publicMatingSchema } = await load(
  "src/entities/mating-listing/public-api.ts",
);
const { formatPetAge } = await load("src/shared/lib/format-pet-age.ts");
const id = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
export const row = {
  id,
  status: "ACTIVE",
  fee: null,
  currency: "UAH",
  createdAt: "2026-10-01T00:00:00Z",
  pet: {
    id,
    name: null,
    gender: "MALE",
    birthDate: "2020-01-02",
    species: { id, name: "Dog", slug: "dog" },
    breed: {
      id,
      name: "German shepherd",
      nameUk: "Німецька вівчарка",
      slug: "shepherd",
    },
    profileImage: null,
  },
  location: {
    id,
    countryCode: "UA",
    city: "Київ",
    region: "Київська область",
    district: null,
    community: null,
    settlementType: "CITY",
    katottgCode: null,
  },
  owner: { id: ownerId, displayName: "Розплідник Весна" },
};
const html = (value) =>
  renderToStaticMarkup(React.createElement(PublicMatingCard, { row: value }));
test("public card prioritizes breed then gender and age, location and fee with explicit profile action", () => {
  const markup = html(row);
  for (const text of [
    "Німецька вівчарка",
    "Самець",
    formatPetAge(row.pet.birthDate),
    "Київ, Київська область",
    "За домовленістю",
    "Розплідник Весна",
    "Переглянути профіль",
  ])
    assert.ok(markup.includes(text));
  assert.ok(markup.indexOf("Німецька вівчарка") < markup.indexOf("Самець"));
  assert.match(markup, new RegExp('href="/sellers/' + ownerId + '"'));
  assert.doesNotMatch(markup, /\/mating\/|Без імені|German shepherd/);
});
test("optional pet name and female free or fixed fee render without owner identity duplication", () => {
  for (const [fee, label] of [
    ["0.00", "Безкоштовно"],
    ["1234.50", "1 234,5 ₴"],
  ]) {
    const markup = html({
      ...row,
      fee,
      owner: {
        ...row.owner,
        href: "https://evil.invalid",
        breeder: { kennelName: "Private duplicate" },
        email: "private@invalid",
      },
      pet: { ...row.pet, name: " Мурка ", gender: "FEMALE" },
    });
    assert.ok(markup.includes(label));
    assert.match(markup, /Самка|Мурка/);
    assert.equal(markup.split("Розплідник Весна").length, 2);
    assert.doesNotMatch(
      markup,
      /evil.invalid|private@invalid|Private duplicate/,
    );
  }
});
test("public card only uses profile media and species fallback with no historical private preview", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/profile.jpg";
  const markup = html({
    ...row,
    pet: {
      ...row.pet,
      breed: null,
      profileImage: { url, thumbnailUrl: url },
      previewImage: { thumbnailUrl: "https://private.invalid/history.jpg" },
    },
  });
  assert.match(markup, /Собака · Породу не вказано/);
  assert.ok(markup.includes('src="' + url + '"'));
  assert.doesNotMatch(markup, /private.invalid/);
});
test("public schema rejects hidden status and untrusted media and strips private fields", () => {
  assert.equal(
    publicMatingSchema.safeParse({ ...row, status: "DRAFT" }).success,
    false,
  );
  for (const url of [
    "javascript:alert(1)",
    "https://evil.invalid/a.jpg",
    "https://res.cloudinary.com.evil.invalid/demo/image/upload/a.jpg",
    "https://res.cloudinary.com/demo/video/upload/a.mp4",
  ])
    assert.equal(
      publicMatingSchema.safeParse({
        ...row,
        pet: { ...row.pet, profileImage: { url, thumbnailUrl: url } },
      }).success,
      false,
    );
  const parsed = publicMatingSchema.parse({
    ...row,
    closedAt: "private",
    owner: { ...row.owner, email: "private", href: "https://evil.invalid" },
    pet: { ...row.pet, previewImage: { thumbnailUrl: "private" } },
  });
  assert.deepEqual(parsed.owner, {
    id: ownerId,
    displayName: "Розплідник Весна",
  });
  assert.equal(parsed.closedAt, undefined);
  assert.equal(parsed.pet.previewImage, undefined);
});
