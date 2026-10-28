import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { breederInputSchema, parseBreederValues, emptyValues } = await load(
  "src/features/breeder/editor/validation.ts",
);
const {
  ownBreederKey,
  ownBreederSchema,
  getOwnBreeder,
  saveBreeder,
  deleteBreeder,
} = await load("src/entities/breeder/owner-api.ts");
const { updateBreederCache } = await load(
  "src/features/breeder/editor/cache.ts",
);
const { isSessionQuery, clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { AccountBreederLink } = await load(
  "src/features/breeder/editor/account-breeder-link.tsx",
);
const { BreederForm } = await load(
  "src/features/breeder/editor/breeder-form.tsx",
);
const { BreederEditor } = await load(
  "src/features/breeder/editor/breeder-editor.tsx",
);
const { getBreeds } = await load("src/features/pet/api.ts");
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const person = {
  id,
  displayName: "Олександр Єпік",
  location: null,
  phone: "+380501234567",
  telegram: null,
  viber: null,
  whatsapp: null,
  memberSince: "2026-10-10T00:00:00Z",
};
const profile = {
  id,
  userId: id,
  kennelName: "Royal Malinois",
  description: "Про розплідник",
  location: null,
  locationId: null,
  startedYear: 2018,
  website: "https://example.com/",
  breeds: [],
  breedIds: [],
  createdAt: "2026-10-10T00:00:00Z",
  updatedAt: "2026-10-10T00:00:00Z",
  contactPerson: person,
};
function client() {
  const c = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  });
  c.setQueryData(["current-user"], { id, accountType: "BREEDER" });
  return c;
}
function render(component, props, c = client()) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(component, props),
    ),
  );
}
const input = (changes = {}) => ({
  kennelName: "  Розплідник 🐾  ",
  description: "",
  locationId: null,
  startedYear: null,
  website: "",
  breedIds: [],
  ...changes,
});
test("required trimmed Unicode name with 160 limit", () => {
  assert.equal(breederInputSchema.parse(input()).kennelName, "Розплідник 🐾");
  for (const name of ["", "   ", "Д".repeat(161)])
    assert.equal(
      breederInputSchema.safeParse(input({ kennelName: name })).success,
      false,
    );
});
test("description nullable plain text max5000", () => {
  assert.equal(breederInputSchema.parse(input()).description, null);
  for (const description of [
    "<b>text</b>",
    "<!-- comment -->",
    "<!DOCTYPE html>",
    "a".repeat(5001),
  ])
    assert.equal(
      breederInputSchema.safeParse(input({ description })).success,
      false,
    );
  assert.equal(
    breederInputSchema.safeParse(input({ description: "Любимо <3 тварин" }))
      .success,
    true,
  );
});
test("optional integer year respects current Kyiv year", () => {
  const year = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
    }).format(new Date()),
  );
  for (const startedYear of [1899, 1900.5, year + 1])
    assert.equal(
      breederInputSchema.safeParse(input({ startedYear })).success,
      false,
    );
  assert.equal(
    breederInputSchema.safeParse(input({ startedYear: year })).success,
    true,
  );
});
for (const website of [
  "javascript:alert(1)",
  "ftp://example.com",
  "https://user:pass@example.com",
  "https://example.com/a b",
  "https://example.com" + String.fromCharCode(92) + "bad",
  "https://example.com/" + "a".repeat(2048),
])
  test("rejects unsafe website " + website.slice(0, 35), () =>
    assert.equal(
      breederInputSchema.safeParse(input({ website })).success,
      false,
    ),
  );
test("website trimmed and normalized http/https", () =>
  assert.equal(
    breederInputSchema.parse(input({ website: " HTTPS://EXAMPLE.COM " }))
      .website,
    "https://example.com/",
  ));
test("normalized URL length checked after percent encoding", () =>
  assert.equal(
    breederInputSchema.safeParse(
      input({ website: "https://example.com/" + "ї".repeat(400) }),
    ).success,
    false,
  ));
test("exact location and duplicate breeds normalization", () => {
  const parsed = breederInputSchema.parse(
    input({ locationId: other, breedIds: [other, id.toUpperCase(), id] }),
  );
  assert.equal(parsed.locationId, other);
  assert.deepEqual(parsed.breedIds, [id, other]);
});
test("maximum50 and UUID validation", () => {
  assert.equal(
    breederInputSchema.safeParse(input({ breedIds: Array(51).fill(id) }))
      .success,
    false,
  );
  assert.equal(
    breederInputSchema.safeParse(input({ locationId: "invalid" })).success,
    false,
  );
});
test("strict six-field request rejects duplicate contacts/security", () => {
  for (const key of ["phone", "email", "userId", "accountType"])
    assert.equal(
      breederInputSchema.safeParse({ ...input(), [key]: "secret" }).success,
      false,
    );
});
test("blank form year clears; bad numeric text gets field error", () => {
  assert.equal(
    parseBreederValues({ ...emptyValues, kennelName: "Назва" }, null, []).data
      .startedYear,
    null,
  );
  assert.equal(
    parseBreederValues(
      { ...emptyValues, kennelName: "Назва", startedYear: "abc" },
      null,
      [],
    ).success,
    false,
  );
});
test("BREEDER without profile setup CTA", () => {
  const c = client();
  c.setQueryData(ownBreederKey(id), null);
  const html = render(AccountBreederLink, { userId: id }, c);
  assert.match(html, /Налаштувати профіль розплідника/);
  assert.doesNotMatch(html, /Переглянути публічний профіль/);
});
test("BREEDER existing edit and animal management CTA", () => {
  const c = client();
  c.setQueryData(ownBreederKey(id), profile);
  const html = render(AccountBreederLink, { userId: id }, c);
  assert.match(html, /Редагувати профіль розплідника/);
  assert.ok(html.includes("/profile/breeder/animals"));
});
test("SELLER direct editor denied without form", () => {
  const c = client();
  c.setQueryData(["current-user"], { id, accountType: "SELLER" });
  const html = render(BreederEditor, {}, c);
  assert.match(html, /Редактор доступний для акаунта заводчика/);
  assert.doesNotMatch(html, /<form/);
});
test("loading never flashes empty form", () => {
  const html = render(BreederEditor, {});
  assert.match(html, /Завантажуємо профіль розплідника/);
  assert.doesNotMatch(html, /<form/);
});
test("existing form prefilled, no contact inputs", () => {
  const html = render(BreederForm, { userId: id, profile });
  assert.match(html, /value="Royal Malinois"/);
  assert.ok(html.includes("Про розплідник</textarea>"));
  assert.match(html, /value="2018"/);
  assert.ok(html.includes('href="/profile"'));
  for (const field of ["phone", "telegram", "viber", "whatsapp"])
    assert.ok(!html.includes('name="' + field + '"'));
});
test("explicit deletion dialog states preservation and buttons", () => {
  const html = render(BreederForm, { userId: id, profile });
  assert.ok(html.includes("Видалити профіль розплідника?"));
  assert.match(html, /Ваш акаунт, тварини, оголошення та контакти залишаться/);
  assert.match(html, /Скасувати/);
  assert.match(html, /aria-labelledby="breeder-delete-title"/);
});
test("private keys account-scoped and cleared, public retained", () => {
  const c = client();
  c.setQueryData(ownBreederKey(id), profile);
  c.setQueryData(["breeder-notice", id], "Success");
  c.setQueryData(["breeder", id], profile);
  clearPrivateQueries(c);
  assert.equal(c.getQueryData(ownBreederKey(id)), undefined);
  assert.equal(c.getQueryData(["breeder-notice", id]), undefined);
  assert.equal(c.getQueryData(["breeder", id]), profile);
  assert.equal(isSessionQuery({ queryKey: ownBreederKey(other) }), true);
});
test("create/edit cache refresh only current seller listing projections", async () => {
  const c = client();
  c.setQueryData(["listing", "mine"], { seller: person });
  c.setQueryData(["listing", "other"], { seller: { id: other } });
  c.setQueryData(["listings"], { unchanged: true });
  await updateBreederCache(c, id, profile);
  assert.equal(
    c.getQueryData(["seller", id]).breeder.kennelName,
    profile.kennelName,
  );
  assert.equal(c.getQueryState(["listing", "mine"]).isInvalidated, true);
  assert.equal(c.getQueryState(["listing", "other"]).isInvalidated, false);
  assert.equal(c.getQueryState(["listings"]).isInvalidated, true);
  assert.equal(c.getQueryData(["breeder", id]).id, undefined);
});
test("delete clears kennel identity but preserves personal/contact session", async () => {
  const c = client();
  await updateBreederCache(c, id, profile);
  await updateBreederCache(c, id, null);
  assert.equal(c.getQueryData(ownBreederKey(id)), null);
  assert.equal(c.getQueryData(["breeder", id]), null);
  assert.equal(c.getQueryData(["seller", id]).breeder, null);
  assert.equal(c.getQueryData(["seller", id]).phone, person.phone);
  assert.equal(c.getQueryData(["current-user"]).accountType, "BREEDER");
});

test("claimed private profile updates only owner cache until explicit publication", async () => {
  const c = client();
  await updateBreederCache(c, id, { ...profile, publicationHeld: true });
  assert.equal(c.getQueryData(ownBreederKey(id)).publicationHeld, true);
  assert.equal(c.getQueryData(["breeder", id]), null);
  assert.equal(c.getQueryData(["seller", id]).breeder, null);
  await updateBreederCache(c, id, { ...profile, publicationHeld: false });
  assert.equal(c.getQueryData(ownBreederKey(id)).publicationHeld, false);
  assert.equal(c.getQueryData(["breeder", id]).kennelName, profile.kennelName);
});
test("late mutation cannot restore previous account data", async () => {
  const c = client();
  c.setQueryData(["current-user"], { id: other });
  assert.equal(await updateBreederCache(c, id, profile), false);
  assert.equal(c.getQueryData(ownBreederKey(id)), undefined);
});
test("GET404 create mode, POST/PATCH/DELETE use existing API", async () => {
  const previous = globalThis.fetch,
    calls = [];
  let missing = true;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), ...options });
    if (String(url).endsWith("/auth/csrf"))
      return Response.json({ data: { csrfToken: "fixture" } });
    if (String(url).endsWith("/auth/refresh"))
      return Response.json({
        data: { accessToken: "fixture", expiresIn: 900, user: { id } },
      });
    if (options.method === "DELETE") return new Response(null, { status: 204 });
    if (missing && (!options.method || options.method === "GET"))
      return Response.json({ message: "Not found" }, { status: 404 });
    return Response.json({ data: profile });
  };
  try {
    assert.equal(await getOwnBreeder(), null);
    missing = false;
    assert.equal((await getOwnBreeder()).kennelName, profile.kennelName);
    const payload = breederInputSchema.parse(input());
    await saveBreeder(payload, false);
    await saveBreeder(payload, true);
    await deleteBreeder();
    const mutations = calls.filter(
      (c) =>
        ["POST", "PATCH", "DELETE"].includes(c.method) &&
        c.url.endsWith("/breeders/me"),
    );
    assert.deepEqual(
      mutations.map((c) => c.method),
      ["POST", "PATCH", "DELETE"],
    );
    assert.deepEqual(JSON.parse(mutations[0].body), payload);
    assert.equal(
      ownBreederSchema.parse({ ...profile, email: "secret" }).email,
      undefined,
    );
  } finally {
    globalThis.fetch = previous;
  }
});
test("mixed breed search omits species filter and retains shared paging", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const params = new URL(String(url)).searchParams;
    assert.equal(params.has("species"), false);
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("search"), "аб");
    return Response.json({
      data: [],
      meta: { page: 2, limit: 50, total: 0, totalPages: 0 },
    });
  };
  try {
    await getBreeds(undefined, "аб", 2);
  } finally {
    globalThis.fetch = previous;
  }
});
