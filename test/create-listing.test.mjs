import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
} from "../node_modules/@tanstack/react-query/build/modern/index.js";
import { load } from "./helpers/load-frontend.mjs";
const { createListingFormSchema, createListingPayload } = await load(
  "src/features/listing/create-listing/model/schema.ts",
);
const { petOptionLabel, createListingError } = await load(
  "src/features/listing/create-listing/model/presentation.ts",
);
const { CreateListingPage } = await load(
  "src/features/listing/create-listing/ui/create-listing-page.tsx",
);
const { CreateListingForm } = await load(
  "src/features/listing/create-listing/ui/create-listing-form.tsx",
);
const { RequireSession } = await load("src/features/auth/require-session.tsx");
const { ApiError, signIn } = await load("src/shared/api/client.ts");
const { createListing } = await load(
  "src/features/listing/create-listing/api/create-listing.ts",
);
const { getLocations } = await load("src/entities/location/api.ts");
const { getOwnPetChoices } = await load(
  "src/entities/pet/api/get-own-pet-choices.ts",
);
const petId = "b3281413-c333-4752-9031-6a2df9274b1a",
  locationId = "3bc6447a-98b0-4654-bf6b-a9162400fbbb";
const pet = {
  id: petId,
  name: null,
  gender: "MALE",
  birthDate: "2024-01-01",
  species: { id: "dog", name: "Dog", slug: "dog" },
  breed: {
    id: "breed",
    name: "Malinois",
    nameUk: " Малінуа ",
    slug: "malinois",
    isActive: true,
  },
};
const location = {
  id: locationId,
  city: "Світловодськ",
  region: "Кіровоградська область",
  countryCode: "UA",
  district: null,
  community: null,
  settlementType: "CITY",
  katottgCode: null,
};
const input = {
  petId,
  locationId,
  type: "SALE",
  title: "  Цуценя малінуа  ",
  description: "  Спокійна тварина.  ",
  price: "25000.50",
};
const client = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, staleTime: 30000 },
    },
  });
const render = (element, queryClient = client()) =>
  renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client: queryClient }, element),
  );
function page(pets = [pet]) {
  const q = client();
  q.setQueryData(["my-pets", "listing-create"], pets);
  return render(React.createElement(CreateListingPage), q);
}
test("required fields and trim/length validation are Ukrainian and match backend bounds", () => {
  for (const [field, value] of [
    ["petId", ""],
    ["locationId", ""],
    ["type", "BAD"],
    ["title", "    "],
    ["description", "   "],
    ["title", "x".repeat(161)],
    ["description", "x".repeat(5001)],
  ]) {
    const result = createListingFormSchema.safeParse({
      ...input,
      [field]: value,
    });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some(
        (issue) =>
          issue.path[0] === field && /[А-Яа-яІіЇїЄєҐґ]/.test(issue.message),
      ),
    );
  }
  assert.equal(createListingPayload(input).title, "Цуценя малінуа");
  assert.equal(createListingPayload(input).description, "Спокійна тварина.");
});
test("SALE money stays exact string and accepts whole/decimal positive values including maximum", () => {
  for (const price of ["25000", "25000.00", "0.01", "9999999999.99"])
    assert.equal(createListingPayload({ ...input, price }).price, price);
});
test("SALE rejects missing/zero/negative/floating exponent/precision/oversized/comma values", () => {
  for (const price of [
    "",
    "0",
    "0.00",
    "-1",
    "1e3",
    "1.999",
    "10000000000",
    "1,50",
    "NaN",
    "01",
  ])
    assert.equal(
      createListingFormSchema.safeParse({ ...input, price }).success,
      false,
    );
});
for (const type of ["FREE", "ADOPTION"])
  test(`${type} omits stale hidden price from payload`, () => {
    assert.equal(
      createListingFormSchema.safeParse({ ...input, type, price: "" }).success,
      true,
    );
    assert.ok(
      !("price" in createListingPayload({ ...input, type, price: "999.99" })),
    );
  });
test("payload contains only six allowed SALE keys and strips seller/status/owner/timestamp injection", () => {
  const payload = createListingPayload({
    ...input,
    sellerId: "injected",
    ownerId: "injected",
    status: "ACTIVE",
    moderationStatus: "APPROVED",
    views: 9,
    publishedAt: "now",
    createdAt: "now",
    currency: "USD",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "description",
    "locationId",
    "petId",
    "price",
    "title",
    "type",
  ]);
});
test("unnamed Pet option uses curated breed/age/gender without fake name or raw UUID", () => {
  const label = petOptionLabel(pet);
  assert.ok(label.startsWith("Малінуа ·"));
  assert.ok(label.includes("Хлопчик"));
  assert.ok(!/Без імені|null|undefined/.test(label));
  assert.ok(!label.includes(petId));
});
test("named option keeps name secondary; blank breed translation and missing breed fall back", () => {
  assert.ok(
    petOptionLabel({
      ...pet,
      name: " Локі ",
      breed: { ...pet.breed, nameUk: " " },
    }).startsWith("Malinois · Локі"),
  );
  assert.ok(
    petOptionLabel({
      ...pet,
      breed: null,
      birthDate: null,
      gender: "UNKNOWN",
    }).startsWith("Собака · Породу не вказано"),
  );
});
test("authenticated form defaults to new animal and keeps accessible listing fields", () => {
  const html = page();
  for (const label of [
    "Вид тварини",
    "Тип оголошення",
    "Місце",
    "Заголовок",
    "Опис",
    "Ціна, ₴",
    "Продаж",
    "Безкоштовно",
    "Прилаштування",
  ])
    assert.ok(html.includes(label));
  assert.ok(html.includes("<legend>Тип оголошення</legend>"));
  assert.ok(html.includes('name="animalMode" checked=""'));
  assert.ok(html.includes("Нова тварина"));
  assert.ok(html.includes("Вибрати з моїх тварин"));
  assert.ok(
    html.includes(
      "Збережіть чернетку або надішліть на модерацію оголошення, додавши щонайменше одну фотографію.",
    ),
  );
  assert.ok(html.includes("Зберегти чернетку"));
  assert.ok(!html.includes('name="sellerId"'));
});
test("no existing Pets still allows unified animal/listing creation", () => {
  const html = page([]);
  assert.ok(html.includes("Нова тварина"));
  assert.ok(!html.includes("Спочатку додайте профіль"));
  assert.ok(html.includes("<form"));
});
test("location reference is searched within the form without eagerly loading every settlement", () => {
  const html = page();
  assert.ok(html.includes('role="combobox"'));
  assert.ok(html.includes("щонайменше 2 символи"));
  assert.ok(html.includes("<form"));
});
test("loading and failed form reference requests have status/retry without raw diagnostics", () => {
  assert.ok(
    render(React.createElement(CreateListingPage)).includes(
      "Завантажуємо види",
    ),
  );
  const q = client();
  q.getQueryCache()
    .build(q, { queryKey: ["my-pets", "listing-create"] })
    .setState({
      status: "error",
      error: new Error("PRIVATE_DIAGNOSTIC"),
      fetchStatus: "idle",
    });
  const html = render(React.createElement(CreateListingPage), q);
  assert.ok(html.includes("Зберегти чернетку"));
  assert.ok(!html.includes("PRIVATE_DIAGNOSTIC"));
});
test("session guard hides form during anonymous restoration and for logged-out user", () => {
  const child = React.createElement("div", null, "PRIVATE_FORM");
  assert.ok(
    !render(React.createElement(RequireSession, null, child)).includes(
      "PRIVATE_FORM",
    ),
  );
  const q = client();
  q.setQueryData(["current-user"], null);
  assert.ok(
    !render(React.createElement(RequireSession, null, child), q).includes(
      "PRIVATE_FORM",
    ),
  );
});
test("session guard permits authenticated form without adding a second auth flow", () => {
  const q = client();
  q.setQueryData(["current-user"], { id: "owner" });
  assert.ok(
    render(
      React.createElement(
        RequireSession,
        null,
        React.createElement(CreateListingForm, {
          pets: [pet],
        }),
      ),
      q,
    ).includes("Зберегти чернетку"),
  );
});
test("conflict/foreign pet/invalid location/unknown errors use safe feature-specific messages", () => {
  assert.equal(
    createListingError(new ApiError(409, "email conflict")),
    "Для цієї тварини вже існує незавершене оголошення.",
  );
  assert.equal(
    createListingError(new ApiError(404, "private")),
    "Не вдалося використати цю тварину.",
  );
  assert.equal(
    createListingError(
      new ApiError(400, "Оберіть доступне місце розташування"),
    ),
    "Обране місце недоступне.",
  );
  assert.ok(
    !createListingError(new Error("STACK_TRACE")).includes("STACK_TRACE"),
  );
});
test("creation reuses authenticated Bearer/CSRF client and verifies DRAFT response; public locations omit auth", async () => {
  const saved = globalThis.fetch,
    requests = [];
  const json = (data, status = 200) =>
    new Response(JSON.stringify({ data }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/auth/csrf")) return json({ csrfToken: "test-csrf" });
    if (url.endsWith("/auth/login"))
      return json({
        user: { id: "owner" },
        accessToken: "test-access",
        expiresIn: 900,
      });
    if (url.includes("/locations?"))
      return new Response(
        JSON.stringify({
          data: [location],
          meta: { page: 1, limit: 50, total: 1, pages: 1 },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    return json({ id: petId, status: "DRAFT", sellerId: "ignored" });
  };
  try {
    await signIn("login", {
      email: "test@example.test",
      password: "test-only",
    });
    assert.deepEqual(await createListing(input), {
      id: petId,
      status: "DRAFT",
    });
    const post = requests.find((r) => r.url.endsWith("/listings"));
    assert.equal(post.options.method, "POST");
    assert.equal(post.options.headers.Authorization, "Bearer test-access");
    assert.equal(post.options.headers["X-CSRF-Token"], "test-csrf");
    assert.deepEqual(
      JSON.parse(post.options.body),
      createListingPayload(input),
    );
    assert.deepEqual((await getLocations("сві")).data, [location]);
    const get = requests.at(-1);
    assert.ok(
      !get.options.headers.Authorization &&
        !get.options.headers["X-CSRF-Token"],
    );
  } finally {
    globalThis.fetch = saved;
  }
});
test("own Pet choices consume every API page, never catalog Pets or manually supplied IDs", async () => {
  const saved = globalThis.fetch,
    urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    const page = Number(new URL(url).searchParams.get("page"));
    return new Response(
      JSON.stringify({
        data: [{ ...pet, id: page === 1 ? petId : locationId }],
        meta: { page, limit: 100, total: 101, pages: 2 },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const pets = await getOwnPetChoices();
    assert.equal(pets.length, 2);
    assert.equal(urls.length, 2);
    assert.ok(
      urls.every(
        (url) => url.includes("/pets/me?") && url.includes("limit=100"),
      ),
    );
  } finally {
    globalThis.fetch = saved;
  }
});
test("safe listing field validation survives central error filtering; unknown diagnostics are excluded", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        message: "PRIVATE_STACK",
        details: [
          {
            field: "title",
            message: "Заголовок має містити щонайменше 5 символів",
          },
          { field: "description", message: "PRIVATE_STACK" },
        ],
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  try {
    await assert.rejects(
      createListing(input),
      (error) =>
        error instanceof ApiError &&
        error.details.length === 1 &&
        error.details[0].field === "title" &&
        !error.message.includes("PRIVATE_STACK"),
    );
  } finally {
    globalThis.fetch = saved;
  }
});
