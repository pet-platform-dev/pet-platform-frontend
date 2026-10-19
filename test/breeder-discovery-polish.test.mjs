import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { useDirectoryFilters } = await load(
  "src/features/breeders/use-directory-filters.ts",
);
const { PublicMatingCard } = await load(
  "src/features/mating/catalog/public-card.tsx",
);
const breedId = "11111111-1111-4111-8111-111111111111";
const locationId = "22222222-2222-4222-8222-222222222222";
const species = [
  { id: "dog-id", slug: "dog" },
  { id: "cat-id", slug: "cat" },
];
const breed = {
  id: breedId,
  speciesId: "dog-id",
  name: "Malinois",
  nameUk: "Малінуа",
};
function state(query, references, failed = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, gcTime: 0 },
    },
  });
  client.setQueryData(["species"], species);
  const key = [
    "breeder-filter-references",
    query.breedId ?? "",
    query.locationId ?? "",
  ];
  if (references) client.setQueryData(key, references);
  if (failed)
    client
      .getQueryCache()
      .build(client, { queryKey: key })
      .setState({ status: "error", error: new Error("offline") });
  let result;
  function Probe() {
    result = useDirectoryFilters(query);
    return null;
  }
  renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Probe),
    ),
  );
  const output = { query: result.query, ready: result.ready };
  client.clear();
  return output;
}
test("direct incompatible species/breed URL is normalized after public references resolve", () => {
  assert.deepEqual(
    state(
      { q: "Лапи", species: "cat", breedId, locationId, page: 2 },
      { breed, location: { id: locationId } },
    ).query,
    { q: "Лапи", species: "cat", breedId: undefined, locationId, page: 1 },
  );
});
test("unknown public reference IDs are removed and reset pagination; compatible IDs stay", () => {
  assert.deepEqual(
    state({ breedId, locationId, page: 2 }, { breed: null, location: null })
      .query,
    { breedId: undefined, locationId: undefined, page: 1 },
  );
  const query = { species: "dog", breedId, locationId, page: 2 };
  assert.deepEqual(
    state(query, { breed, location: { id: locationId } }).query,
    query,
  );
});
test("pending references gate results; lookup errors preserve filters for retry", () => {
  const query = { breedId, locationId, page: 2 };
  assert.equal(state(query).ready, false);
  const failed = state(query, undefined, true);
  assert.equal(failed.ready, true);
  assert.deepEqual(failed.query, query);
  assert.equal(state({ page: 1 }).ready, true);
});
test("mating cards support h3 inside public profile sections while catalog keeps h2", () => {
  const row = {
    id: breedId,
    owner: { id: locationId, displayName: "Розплідник" },
    pet: {
      species: { slug: "dog" },
      breed: null,
      gender: "MALE",
      birthDate: null,
      profileImage: null,
    },
    location: { city: "Київ", region: "Київ" },
    fee: null,
  };
  const render = (headingLevel) =>
    renderToStaticMarkup(
      React.createElement(PublicMatingCard, { row, headingLevel }),
    );
  assert.ok(render(3).includes("<h3"));
  assert.ok(!render(3).includes("<h2"));
  assert.ok(render().includes("<h2"));
});
