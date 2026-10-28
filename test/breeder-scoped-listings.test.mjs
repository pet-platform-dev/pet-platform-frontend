import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { ContentEditor } = await load("src/features/admin/content/editor.tsx");
const { buildContentInput } = await load(
  "src/features/admin/content/editor-input.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
const context = {
  id,
  source: "OPERATOR_PREPARED",
  name: "Silver Paw Malinois",
  location: {
    id,
    city: "Київ",
    region: "м. Київ",
    slug: "kyiv",
    countryCode: "UA",
  },
};
function render(props) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(["current-user"], { id, role: "ADMIN" });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ContentEditor, { row: null, onSaved() {}, ...props }),
    ),
  );
}
test("breeder-scoped editor shows actual read-only breeder and prefilled location, without duplicate identity fields", () => {
  const html = render({ breederContext: context });
  assert(!html.includes("Довідка про власника"));
  assert(!html.includes("Пов’язаний власник або розплідник"));
  assert(!html.includes('id="breederDraftId"'));
  assert(html.includes("Розплідник:"));
  assert(html.includes(context.name));
  assert(html.includes("Київ"));
  assert(html.includes("Фотографії"));
  assert(html.includes("Статус оголошення"));
  assert(!html.includes("Стан приватної чернетки"));
});
test("standalone preparation retains its optional reference fields", () => {
  const html = render({});
  assert(html.includes("Довідка про власника"));
  assert(html.includes('id="breederDraftId"'));
});
test("scoped payload omits editable owner/parent fields and mating; generic preparation retains existing fields", () => {
  const fields = {
    row: null,
    title: "Синтетична чернетка",
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
    photos: { images: [] },
    draftDetails: { ownerReference: "Історична довідка", breederDraftId: id },
  };
  const scoped = buildContentInput({ ...fields, breederContext: context });
  for (const key of ["ownerReference", "breederDraftId", "breederProfileId"])
    assert(!(key in scoped));
  assert.equal(scoped.status, "DRAFT");
  assert.equal(scoped.currency, "UAH");
  const generic = buildContentInput(fields);
  assert.equal(generic.ownerReference, "Історична довідка");
  assert.equal(generic.breederDraftId, id);
  assert.throws(() =>
    buildContentInput({ ...fields, kind: "MATING", breederContext: context }),
  );
});
