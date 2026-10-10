import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const {
  breederAnimalSchema,
  ownBreederAnimalSchema,
  ownAnimalsKey,
  publicAnimalsKey,
} = await load("src/entities/breeder/animals.ts");
const { PublicAnimalCard, PublicBreederAnimals } = await load(
  "src/features/breeder/animals/public-breeder-animals.tsx",
);
const { AnimalManagementCard } = await load(
  "src/features/breeder/animals/animal-management-card.tsx",
);
const { BreederAnimalsManagement } = await load(
  "src/features/breeder/animals/breeder-animals-management.tsx",
);
const { CreateListingForm } = await load(
  "src/features/listing/create-listing/ui/create-listing-form.tsx",
);
const { listingPetPreselection } = await load(
  "src/features/listing/create-listing/model/pet-preselection.ts",
);
const { invalidateBreederAnimals } = await load(
  "src/features/breeder/animals/cache.ts",
);
const { isSessionQuery } = await load("src/features/auth/session-provider.tsx");
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const animal = {
  id,
  name: null,
  gender: "MALE",
  birthDate: "2020-01-01",
  species: { id, name: "Dog", slug: "dog" },
  breed: { id, name: "Malinois", nameUk: "Малінуа", slug: "malinois" },
  previewImage: null,
  activeListing: null,
};
const offer = {
  id: other,
  type: "FREE",
  price: null,
  currency: "UAH",
  cover: null,
  href: "https://evil.invalid",
};
const user = { id, accountType: "BREEDER" };
function render(Component, props = {}, seed = () => {}) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  c.setQueryData(["current-user"], user);
  seed(c);
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Component, props),
    ),
  );
  c.clear();
  return html;
}
test("explicit public runtime projection strips private fields and constructs safe listing target", () => {
  const parsed = breederAnimalSchema.parse({
    ...animal,
    ownerId: other,
    chipNumber: "private",
    activeListing: { ...offer, status: "DRAFT", sellerEmail: "private" },
  });
  assert.equal(parsed.ownerId, undefined);
  assert.equal(parsed.activeListing.href, "/listings/" + other);
  assert.equal(parsed.activeListing.sellerEmail, undefined);
});
test("public image parsing rejects javascript and credentials", () => {
  for (const thumbnailUrl of [
    "javascript:alert(1)",
    "https://u:p@example.invalid/a.png",
  ])
    assert.equal(
      breederAnimalSchema.safeParse({
        ...animal,
        previewImage: { thumbnailUrl },
      }).success,
      false,
    );
});
test("owner contract needs explicit boolean and excludes terminal listing details", () => {
  const own = { ...animal, showOnBreederProfile: false, currentListing: null };
  assert.ok(ownBreederAnimalSchema.safeParse(own).success);
  assert.equal(
    ownBreederAnimalSchema.safeParse({
      ...own,
      currentListing: { ...offer, status: "SOLD" },
    }).success,
    false,
  );
});
test("public animal breed primary, optional name omitted without invented identity", () => {
  const html = render(PublicAnimalCard, { animal });
  assert.ok(html.includes("<h3>Малінуа</h3>"));
  assert.ok(html.includes("Хлопчик"));
  assert.ok(!html.includes("Без імені"));
  assert.ok(!html.includes("Переглянути оголошення"));
});
test("optional registered pet name is secondary and safe ACTIVE link/price appears", () => {
  const html = render(PublicAnimalCard, {
    animal: {
      ...animal,
      name: "Rex",
      activeListing: { ...offer, href: "/listings/" + other },
    },
  });
  assert.ok(html.indexOf("Малінуа") < html.indexOf("Rex"));
  assert.ok(html.includes('href="/listings/' + other + '"'));
});
test("owner per-pet visibility checkbox and existing Pet/create links", () => {
  const html = render(AnimalManagementCard, {
    animal: { ...animal, showOnBreederProfile: false, currentListing: null },
    userId: id,
  });
  assert.ok(html.includes('type="checkbox"'));
  assert.ok(html.includes("Показувати у профілі розплідника"));
  assert.ok(html.includes('href="/pets/' + id + '/edit"'));
  assert.ok(html.includes('href="/listings/new?petId=' + id + '"'));
});
test("ACTIVE/current listings offer view/edit rather than duplicate creation", () => {
  for (const status of ["ACTIVE", "DRAFT"]) {
    const html = render(AnimalManagementCard, {
      animal: {
        ...animal,
        showOnBreederProfile: true,
        currentListing: { ...offer, href: "/listings/" + other, status },
      },
      userId: id,
    });
    assert.ok(html.includes('href="/listings/' + other + '/edit"'));
    assert.ok(!html.includes("Створити оголошення"));
    assert.equal(html.includes("Переглянути оголошення"), status === "ACTIVE");
  }
});
test("public animal section renders only received visible cards and hides zero", () => {
  const meta = { page: 1, limit: 24, total: 1, pages: 1 };
  const html = render(PublicBreederAnimals, { userId: id }, (c) =>
    c.setQueryData([...publicAnimalsKey(id), { page: 1 }], {
      data: [animal],
      meta,
    }),
  );
  assert.ok(html.includes("Наші тварини"));
  assert.ok(html.includes("Малінуа"));
  assert.equal(
    render(PublicBreederAnimals, { userId: id }, (c) =>
      c.setQueryData([...publicAnimalsKey(id), { page: 1 }], {
        data: [],
        meta: { ...meta, total: 0, pages: 0 },
      }),
    ),
    "",
  );
});
test("SELLER management denies access and no visibility control", () => {
  const html = render(BreederAnimalsManagement, {}, (c) =>
    c.setQueryData(["current-user"], { ...user, accountType: "SELLER" }),
  );
  assert.ok(html.includes("доступний для акаунта заводчика"));
  assert.ok(!html.includes('type="checkbox"'));
});
test("URL preselection accepts a single UUID, ignores malformed/external/array", () => {
  assert.equal(listingPetPreselection(id), id);
  for (const raw of [other + "/edit", "https://evil.invalid", [id], null, ""])
    assert.equal(listingPetPreselection(raw), undefined);
});
test("own Pet preselection uses existing listing mode/select and no auto publish", () => {
  const pet = {
    ...animal,
    createdAt: "",
    updatedAt: "",
    color: null,
    description: null,
    chipNumber: null,
    hasPassport: false,
    hasPedigree: false,
    vaccinated: false,
  };
  const html = render(CreateListingForm, { pets: [pet], preselectedPetId: id });
  assert.match(html, /name="animalMode" checked=""/);
  assert.ok(html.includes('id="petId"'));
  assert.ok(html.includes('role="combobox"'));
  assert.ok(html.includes("Малінуа"));
  assert.ok(!html.includes("<select"));
  assert.ok(html.includes("Зберегти чернетку"));
});
test("visibility cache is owner scoped, catalog/other breeder unaffected and late account ignored", async () => {
  const c = new QueryClient();
  c.setQueryData(["current-user"], user);
  for (const key of [
    ownAnimalsKey(id),
    publicAnimalsKey(id),
    publicAnimalsKey(other),
    ["listings"],
    ["my-pets"],
  ])
    c.setQueryData(key, {});
  assert.equal(await invalidateBreederAnimals(c, id), true);
  assert.equal(c.getQueryState(publicAnimalsKey(id)).isInvalidated, true);
  assert.equal(c.getQueryState(publicAnimalsKey(other)).isInvalidated, false);
  assert.equal(c.getQueryState(["listings"]).isInvalidated, false);
  c.setQueryData(["current-user"], { id: other });
  assert.equal(await invalidateBreederAnimals(c, id), false);
  c.clear();
});
test("owner animal cache cleared with session; public animals remain public", () => {
  assert.equal(isSessionQuery({ queryKey: ownAnimalsKey(id) }), true);
  assert.equal(isSessionQuery({ queryKey: publicAnimalsKey(id) }), false);
});
