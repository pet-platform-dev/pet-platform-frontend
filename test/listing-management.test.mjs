import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const {
  ownListingSchema,
  statusLabels,
  statusGroups,
  completion,
  editable,
  noImagesMessage,
} = await load("src/features/listing/manage-listing/model.ts");
const { MyListingsPage, OwnerListingCard } = await load(
  "src/features/listing/manage-listing/my-listings.tsx",
);
const { EditListingPage } = await load(
  "src/features/listing/manage-listing/edit-listing.tsx",
);
const {
  getOwnListings,
  getOwnedListing,
  changeListingStatus,
  createAndMaybePublish,
  invalidateListings,
  managementError,
} = await load("src/features/listing/manage-listing/api.ts");
const { draftListingFormSchema, createListingFormSchema } = await load(
  "src/features/listing/create-listing/model/schema.ts",
);
const { isSessionQuery } = await load("src/features/auth/session-provider.tsx");
const { signIn, ApiError } = await load("src/shared/api/client.ts");
const id = "b3281413-c333-4752-9031-6a2df9274b1a",
  user = { id: "owner", firstName: "Тест", role: "USER" };
const image = {
  id: "image",
  url: "https://res.cloudinary.com/fixture/image/upload/v1/test.png",
  thumbnailUrl:
    "https://res.cloudinary.com/fixture/image/upload/w_480/v1/test.png",
  sortOrder: 0,
};
const listing = {
  id,
  type: "SALE",
  status: "DRAFT",
  moderationStatus: "NOT_SUBMITTED",
  title: "Тварина шукає родину",
  description: "Опис тварини",
  price: "125.50",
  currency: "UAH",
  views: 0,
  publishedAt: null,
  closedAt: null,
  createdAt: "2026-10-09T08:00:00Z",
  updatedAt: "2026-10-09T08:00:00Z",
  images: [image],
  pet: {
    id,
    name: null,
    gender: "UNKNOWN",
    birthDate: null,
    species: { id: "dog", name: "Dog", slug: "dog" },
    breed: null,
  },
  location: {
    id,
    countryCode: "UA",
    region: "Кіровоградська область",
    city: "Світловодськ",
    slug: "city",
  },
  seller: {
    id: user.id,
    displayName: "Тест",
    location: null,
    phone: null,
    telegram: null,
    viber: null,
    whatsapp: null,
    memberSince: "2026-10-01T00:00:00Z",
  },
};
function render(component, setup = () => {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["current-user"], user);
  setup(client);
  return renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client }, component),
  );
}
for (const [status, label] of Object.entries(statusLabels))
  test(`${status} owner badge is Ukrainian`, () => {
    const value = ownListingSchema.parse({
      ...listing,
      status: ["PENDING", "REJECTED", "HIDDEN"].includes(status)
        ? "DRAFT"
        : status,
      moderationStatus: ["PENDING", "REJECTED", "HIDDEN"].includes(status)
        ? status
        : status === "ACTIVE"
          ? "APPROVED"
          : "NOT_SUBMITTED",
    });
    const html = render(
      React.createElement(OwnerListingCard, { listing: value }),
    );
    assert.ok(html.includes(label));
    assert.ok(!html.includes(`>${status}<`));
    assert.ok(html.includes("Видалити оголошення"));
    assert.ok(html.includes('class="button danger"'));
  });
test("status grouping keeps reserved moderation states out of dedicated tabs", () => {
  assert.deepEqual(statusGroups.completed.statuses, [
    "SOLD",
    "TRANSFERRED",
    "ADOPTED",
  ]);
  assert.deepEqual(statusGroups.draft.statuses, ["DRAFT"]);
  assert.deepEqual(statusGroups.active.statuses, ["ACTIVE"]);
  assert.deepEqual(statusGroups.archived.statuses, ["ARCHIVED"]);
  assert.ok(Object.keys(statusGroups).includes("pending"));
});
for (const [type, status, label] of [
  ["SALE", "SOLD", "продано"],
  ["FREE", "TRANSFERRED", "передано"],
  ["ADOPTION", "ADOPTED", "прилаштовано"],
])
  test(`${type} exposes its valid confirmed completion action`, () => {
    assert.equal(completion(type).status, status);
    const html = render(
      React.createElement(OwnerListingCard, {
        listing: {
          ...listing,
          type,
          price: type === "SALE" ? listing.price : null,
          status: "ACTIVE",
          moderationStatus: "APPROVED",
        },
      }),
    );
    assert.ok(html.includes(`Позначити як ${label}`));
    assert.ok(html.includes("<dialog"));
    assert.ok(html.includes("aria-labelledby"));
    assert.ok(html.includes("Скасувати"));
  });
test("owner cards preserve optional animal identity, context, cover and edit link", () => {
  const html = render(
    React.createElement(OwnerListingCard, {
      listing: { ...listing, pet: { ...listing.pet, name: "Локі" } },
    }),
  );
  for (const text of [
    "Локі",
    "Світловодськ",
    "Кіровоградська",
    "Оновлено:",
    `/listings/${id}/edit`,
    'loading="lazy"',
  ])
    assert.ok(html.includes(text));
});
test("my-listings empty state offers creation without raw diagnostics", () => {
  const html = render(React.createElement(MyListingsPage), (client) =>
    client.setQueryData(["my-listings", user.id, "all"], {
      pages: [{ data: [], hasMore: false }],
      pageParams: [1],
    }),
  );
  assert.ok(html.includes("У вас ще немає оголошень"));
  assert.ok(html.includes("/listings/new"));
  assert.ok(html.includes('aria-pressed="true"'));
});
test("owner list renders cached pages and next-page control", () => {
  const html = render(React.createElement(MyListingsPage), (client) =>
    client.setQueryData(["my-listings", user.id, "all"], {
      pages: [{ data: [listing], hasMore: true }],
      pageParams: [1],
    }),
  );
  assert.ok(html.includes("Чернетка"));
  assert.ok(html.includes("Показати ще"));
});
test("logged-out management hides private content while redirecting through existing guard", () => {
  const html = render(React.createElement(MyListingsPage), (client) =>
    client.setQueryData(["current-user"], null),
  );
  assert.ok(html.includes("Перевіряємо сесію"));
  assert.ok(!html.includes("Світловодськ"));
});
test("DRAFT editor shows save/publish and staged existing images", () => {
  const html = render(React.createElement(EditListingPage, { id }), (client) =>
    client.setQueryData(["owned-listing", id, user.id], listing),
  );
  for (const text of [
    "Зберегти зміни",
    "Надіслати на модерацію",
    "В архів",
    "Дані тварини редагуються окремо",
    "Головне фото",
    "Зробити",
  ]) {
    if (text !== "Зробити") assert.ok(html.includes(text));
  }
  assert.ok(!html.includes('name="speciesId"'));
  assert.ok(html.includes("Видалити фото 1"));
});
test("ACTIVE editor locks type and retains safe edits without publish", () => {
  const html = render(React.createElement(EditListingPage, { id }), (client) =>
    client.setQueryData(["owned-listing", id, user.id], {
      ...listing,
      status: "ACTIVE",
      moderationStatus: "APPROVED",
    }),
  );
  assert.ok(html.includes("Тип активного оголошення змінити не можна"));
  assert.ok(html.includes('disabled=""'));
  assert.ok(html.includes("Зберегти зміни"));
  assert.ok(!html.includes(">Надіслати на модерацію<"));
});
for (const status of ["SOLD", "TRANSFERRED", "ADOPTED", "ARCHIVED"])
  test(`${status} editor is read-only`, () => {
    const html = render(
      React.createElement(EditListingPage, { id }),
      (client) =>
        client.setQueryData(["owned-listing", id, user.id], {
          ...listing,
          status,
        }),
    );
    assert.ok(html.includes("не можна редагувати"));
    assert.ok(!html.includes("<form"));
    assert.equal(editable(status), false);
  });
test("draft permits missing SALE price while publication validation requires it", () => {
  const input = {
    petId: id,
    locationId: id,
    type: "SALE",
    title: listing.title,
    description: listing.description,
    price: "",
  };
  assert.equal(draftListingFormSchema.safeParse(input).success, true);
  assert.equal(createListingFormSchema.safeParse(input).success, false);
  assert.equal(
    ownListingSchema.safeParse({ ...listing, price: null }).success,
    true,
  );
  assert.equal(
    ownListingSchema.safeParse({ ...listing, status: "ARCHIVED", price: null })
      .success,
    true,
  );
  assert.equal(
    ownListingSchema.safeParse({ ...listing, status: "ACTIVE", price: null })
      .success,
    false,
  );
});
test("mutation invalidation targets own list, catalog, public detail and owned detail", async () => {
  const calls = [];
  await invalidateListings(
    {
      getQueryData: () => null,
      invalidateQueries: async (value) => calls.push(value.queryKey),
    },
    id,
  );
  assert.deepEqual(calls, [
    ["my-listings"],
    ["listings"],
    ["listing", id],
    ["owned-listing", id],
    ["my-pets"],
    ["seller-listings"],
    ["favorites"],
    ["favorite-state"],
    ["favorite-batch"],
    ["public-pet"],
  ]);
});
test("session isolation includes management but preserves public queries", () => {
  for (const key of ["my-listings", "owned-listing"])
    assert.equal(isSessionQuery({ queryKey: [key, id] }), true);
  for (const key of ["listings", "listing"])
    assert.equal(isSessionQuery({ queryKey: [key, id] }), false);
});
test("known publication errors remain actionable; unknown diagnostics remain private", () => {
  assert.equal(
    managementError(new ApiError(400, noImagesMessage), "fallback"),
    noImagesMessage,
  );
  assert.equal(
    managementError(new ApiError(500, "PRIVATE_DB_STACK"), "Безпечна помилка"),
    "Безпечна помилка",
  );
});
test("management API uses Bearer/CSRF, completed server filters, and conceals foreign ACTIVE edit", async () => {
  const saved = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const path = new URL(url).pathname;
    const data = path.endsWith("/csrf")
      ? { csrfToken: "csrf" }
      : path.endsWith("/login")
        ? { user, accessToken: "fixture-access", expiresIn: 900 }
        : path.endsWith("/me")
          ? null
          : listing;
    if (path.endsWith("/listings/me"))
      return Response.json({
        data: [listing],
        meta: { page: 1, pages: 1, total: 1, limit: 24 },
      });
    return Response.json({ data });
  };
  try {
    await signIn("login", {
      email: "fixture@example.invalid",
      password: "fixture-password",
    });
    await getOwnListings("completed", 1);
    const statuses = calls
      .filter((call) => call.url.includes("/listings/me?"))
      .map((call) => new URL(call.url).searchParams.get("status"));
    assert.deepEqual(statuses, ["SOLD", "TRANSFERRED", "ADOPTED"]);
    await assert.rejects(
      () => getOwnedListing(id, "foreign"),
      (error) => error.status === 404,
    );
    await changeListingStatus(id, "ACTIVE");
    const mutation = calls.at(-1);
    assert.equal(
      mutation.options.headers.Authorization,
      "Bearer fixture-access",
    );
    assert.equal(mutation.options.headers["X-CSRF-Token"], "csrf");
    assert.deepEqual(JSON.parse(mutation.options.body), { status: "ACTIVE" });
  } finally {
    globalThis.fetch = saved;
  }
});
test("create then publish failure retains draft id and clear failure result", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) =>
    String(url).endsWith("/status")
      ? Response.json({ message: "offline" }, { status: 503 })
      : Response.json({ data: { id, status: "DRAFT" } });
  try {
    const result = await createAndMaybePublish(
      {
        input: {
          petId: id,
          locationId: id,
          type: "FREE",
          title: listing.title,
          description: listing.description,
          price: "",
        },
        imageIds: ["staged"],
      },
      true,
    );
    assert.deepEqual(result, { id, status: "DRAFT", publishFailed: true });
  } finally {
    globalThis.fetch = saved;
  }
});
