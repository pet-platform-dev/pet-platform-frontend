import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { speciesLabel } = await load("src/entities/species/model.ts");
const { getBreeds } = await load("src/features/pet/api.ts");
const { BreederBreedSelector } = await load(
  "src/features/breeder/editor/breeder-breed-selector.tsx",
);

test("breeder species groups use Ukrainian plural labels without changing singular animal labels", () => {
  assert.equal(speciesLabel("dog", true), "Собаки");
  assert.equal(speciesLabel("cat", true), "Коти");
  assert.equal(speciesLabel("dog"), "Собака");
  assert.equal(speciesLabel("cat"), "Кіт");
  assert.equal(speciesLabel("unknown", true), "Невідомий вид");
});

test("breeder autocomplete forwards slug filters, isolates caches and resets only search identity on switching", async () => {
  const previous = globalThis.fetch,
    queries = [];
  globalThis.fetch = async (url) => {
    queries.push(new URL(String(url)).searchParams);
    return Response.json({
      data: [],
      meta: { page: 2, limit: 50, total: 0, pages: 0 },
    });
  };
  const selected = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Synthetic",
      nameUk: null,
    },
  ];
  try {
    for (const species of ["dog", "cat"]) {
      const element = BreederBreedSelector({
        species,
        selected,
        onChange() {},
      });
      assert.equal(element.key, species);
      assert.deepEqual(element.props.queryKey, ["breeds", species]);
      assert.equal(
        element.props.selected,
        selected,
        "mixed breeder associations belong to parent state",
      );
      await element.props.fetchPage("", 2);
      const q = queries.at(-1);
      assert.equal(q.get("species"), species);
      assert.equal(q.get("search"), "");
      assert.equal(q.get("page"), "2");
      assert.equal(q.get("limit"), "50");
      assert.equal(q.get("sort"), "name_asc");
    }
    await getBreeds(undefined, "українська назва", 1);
    assert(!queries.at(-1).has("species"));
    assert.equal(queries.at(-1).get("search"), "українська назва");
  } finally {
    globalThis.fetch = previous;
  }
});
