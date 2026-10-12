import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { MatingForm } = await load("src/features/mating/mating-form.tsx");
const id = "11111111-1111-4111-8111-111111111111";
const pet = {
  id,
  name: "Локі",
  gender: "MALE",
  birthDate: null,
  profileImage: null,
  species: { id, name: "Dog", slug: "dog" },
  breed: null,
};
function html(overrides = {}) {
  const c = new QueryClient();
  try {
    return renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: c },
        React.createElement(MatingForm, {
          pets: [pet],
          active: [],
          initialPetId: id,
          onSubmit: async () => {},
          ...overrides,
        }),
      ),
    );
  } finally {
    c.clear();
  }
}
test("owned initial Pet is selected without forcing a second selection", () =>
  assert.match(html(), new RegExp('data-value="' + id + '"')));
test("preselected UNKNOWN retains eligibility block", () =>
  assert.match(
    html({ pets: [{ ...pet, gender: "UNKNOWN" }] }),
    /Щоб створити оголошення про в’язку, вкажіть стать тварини/,
  ));
test("preselected ACTIVE conflict uses existing notice", () =>
  assert.match(
    html({ active: [{ id: "other", pet }] }),
    /Для цієї тварини вже є активне оголошення про в’язку/,
  ));
