import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { MatingForm } = await load("src/features/mating/mating-form.tsx");
const { MatingActions } = await load("src/features/mating/mating-actions.tsx");
const { MatingPetSelection } = await load(
  "src/features/mating/pet-selection.tsx",
);
const { ListingManagementSkeleton } = await load(
  "src/features/listing/manage-listing/listing-management-skeleton.tsx",
);
const id = "11111111-1111-4111-8111-111111111111";
const pet = {
  id,
  name: null,
  gender: "MALE",
  birthDate: null,
  profileImage: null,
  species: { id, name: "Собака", slug: "dog" },
  breed: null,
};
const row = {
  id,
  pet,
  status: "DRAFT",
  moderationStatus: "NOT_SUBMITTED",
  publishedAt: null,
  description: "Збережений опис",
  fee: "123.45",
  location: {
    id,
    city: "Київ",
    region: "Київська область",
    district: null,
    community: null,
    settlementType: "CITY",
    katottgCode: null,
    countryCode: "UA",
  },
};
function html(C, props) {
  const c = new QueryClient();
  try {
    return renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: c },
        React.createElement(C, props),
      ),
    );
  } finally {
    c.clear();
  }
}
test("create owned Pet choices do not include foreign data and blank name stays omitted", () => {
  const m = html(MatingPetSelection, {
    pets: [pet],
    petId: id,
    active: [],
    onSelect() {},
  });
  assert.match(m, /Тварина/);
  assert.match(m, /Самець/);
  assert.doesNotMatch(m, /Без імені/);
});
test("unknown gender exposes edit Pet CTA and prevents save/publish", () => {
  const m = html(MatingForm, {
    listing: { ...row, pet: { ...pet, gender: "UNKNOWN" } },
    active: [],
    onSubmit: async () => {},
  });
  assert.match(m, /href="\/pets\/11111111-1111-4111-8111-111111111111\/edit"/);
  assert.match(m, /<button[^>]*disabled=""[^>]*>Зберегти зміни/);
  assert.match(m, /<button[^>]*disabled=""[^>]*>Надіслати на модерацію/);
});
test("edit hydrates current description/location/exact fee and Pet is read-only", () => {
  const m = html(MatingForm, {
    listing: row,
    active: [],
    onSubmit: async () => {},
  });
  assert.match(m, /Збережений опис/);
  assert.match(m, /value="123.45"/);
  assert.match(m, /Київська область/);
  assert.match(m, /Тварину в цьому оголошенні змінити не можна/);
  assert.doesNotMatch(m, /aria-label="Тварина"/);
});
test("active competitor blocks publish but keeps saving draft and edit CTA", () => {
  const m = html(MatingForm, {
    listing: row,
    active: [
      { ...row, id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE" },
    ],
    onSubmit: async () => {},
  });
  assert.match(m, /Для цієї тварини вже є активне/);
  assert.match(m, /<button[^>]*disabled=""[^>]*>Надіслати на модерацію/);
  assert.doesNotMatch(m, /<button[^>]*disabled=""[^>]*>Зберегти зміни/);
});
for (const status of ["ACTIVE", "CLOSED", "ARCHIVED"])
  test(status + " never exposes draft deletion", () => {
    const m = html(MatingActions, { row: { ...row, status }, userId: id });
    assert.doesNotMatch(m, />Видалити чернетку<\/button>/);
  });
test("draft lifecycle dialog provides labeled confirmation and safe cancel autofocus", () => {
  const m = html(MatingActions, { row, userId: id });
  assert.match(m, />Видалити чернетку<\/button>/);
  assert.match(m, /<dialog[^>]*aria-labelledby="mating-confirm-title"/);
  assert.match(m, /<button[^>]*autofocus=""[^>]*>Скасувати/);
});
test("loading reuses accessible owner skeleton", () =>
  assert.match(
    html(ListingManagementSkeleton, { editor: true }),
    /role="status" aria-label="Завантажуємо оголошення"/,
  ));
test("uncertain eligibility disables publishing without discarding editable draft", () => {
  const m = html(MatingForm, {
    listing: row,
    active: [],
    publishBlocked: true,
    onSubmit: async () => {},
  });
  assert.match(m, /<button[^>]*disabled=""[^>]*>Надіслати на модерацію/);
  assert.doesNotMatch(m, /<button[^>]*disabled=""[^>]*>Зберегти зміни/);
  assert.match(m, /value="123.45"/);
});
