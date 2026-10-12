import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { PetMatingActions } = await load(
  "src/features/mating/pet-mating-actions.tsx",
);
const id = "11111111-1111-4111-8111-111111111111";
const html = (activeMatingListing) =>
  renderToStaticMarkup(
    React.createElement(PetMatingActions, {
      petId: id,
      petLabel: "Локі",
      activeMatingListing,
      returnTo: "/pets",
    }),
  );
test("no active summary shows find pair and encoded owned context", () => {
  const s = html(null);
  assert.match(s, /Знайти пару/);
  assert.match(s, /petId=11111111/);
  assert.match(s, /returnTo=%2Fpets/);
});
test("ACTIVE replaces creation with clearly named detail/edit links", () => {
  const s = html({ id, status: "ACTIVE" });
  assert.match(s, /Активне оголошення про в’язку/);
  assert.doesNotMatch(s, /Знайти пару/);
  assert.match(s, /Переглянути оголошення про в’язку: Локі/);
  assert.match(s, /Редагувати оголошення про в’язку: Локі/);
});
