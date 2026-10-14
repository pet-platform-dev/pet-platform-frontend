import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const m = await load("src/features/pet-care/model.ts"),
  api = await load("src/features/pet-care/api.ts"),
  auth = await load("src/shared/api/client.ts");
const session = await load("src/features/auth/session-provider.tsx");
const { PetCareDashboard, PetCareLoading } = await load(
  "src/features/pet-care/pet-care-page.tsx",
);
const { PetCareHeader } = await load(
  "src/features/pet-care/pet-care-header.tsx",
);
const { PetCareOverview } = await load(
  "src/features/pet-care/pet-care-overview.tsx",
);
const { formatPetAge } = await load("src/shared/lib/format-pet-age.ts");
const uid = "76277b42-4a76-5c79-ab69-31acb61de011",
  id = "86277b42-4a76-5c79-ab69-31acb61de011";
const pet = {
  id,
  name: "Локі",
  gender: "MALE",
  birthDate: "2020-02-29",
  species: { id: uid, name: "Dog", slug: "dog" },
  breed: { id: uid, name: "Malinois", nameUk: "Бельгійська вівчарка малінуа" },
  profileImage: null,
};
function render(c, Component, props) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Component, props),
    ),
  );
}
function client() {
  const c = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  });
  c.setQueryData(session.sessionKey, { id: uid, role: "USER" });
  return c;
}
test("care header uses optional name/breed/species naturally, missing photo/date and safe text", () => {
  const named = renderToStaticMarkup(
    React.createElement(PetCareHeader, { pet }),
  );
  assert.match(named, /Локі/);
  assert.match(named, /Бельгійська/);
  assert.match(named, /Фото тварини відсутнє/);
  assert.match(named, /Редагувати профіль/);
  const unnamed = renderToStaticMarkup(
    React.createElement(PetCareHeader, {
      pet: {
        ...pet,
        name: null,
        birthDate: null,
        breed: null,
        gender: "UNKNOWN",
      },
    }),
  );
  assert.match(unnamed, /Кіт|Собака/);
  assert.match(unnamed, /Не вказано/);
  assert.doesNotMatch(unnamed, /Без імені|undefined|>null</);
  const hostile = renderToStaticMarkup(
    React.createElement(PetCareHeader, {
      pet: { ...pet, name: "<script>private</script>" },
    }),
  );
  assert.match(hostile, /&lt;script&gt;/);
  assert.doesNotMatch(hostile, /<script>/);
});
test("detailed age reuses calendar rules with Ukrainian years/months and unchanged compact default", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const age = (b) => formatPetAge(b, now, { detailed: true });
  assert.equal(age("2026-06-14"), "4 місяці");
  assert.equal(age("2025-07-14"), "1 рік 3 місяці");
  assert.equal(age("2020-10-14"), "6 років");
  assert.equal(age("2026-09-14"), "1 місяць");
  assert.equal(age("2026-05-14"), "5 місяців");
  assert.equal(age(null), null);
  assert.equal(age("2027-01-01"), null);
  assert.equal(age("2026-02-30"), null);
  assert.equal(age("2026-10-01"), "Менше місяця");
  assert.equal(formatPetAge("2025-07-14", now), "1 рік");
  assert.equal(
    formatPetAge("2024-02-29", new Date("2025-02-28T12:00:00Z"), {
      detailed: true,
    }),
    "11 місяців",
  );
});
test("overview exposes only honest empty sections, no fake care records or broken actions", () => {
  const html = renderToStaticMarkup(React.createElement(PetCareOverview));
  for (const text of [
    "Найближчі події",
    "Нагадування",
    "Історія догляду",
    "Вакцинації",
    "Ліки",
    "Нагадувань ще немає",
    "Історія догляду порожня",
    "Записів про вакцинацію ще немає",
    "Записів про ліки ще немає",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<button|<a |<select|доза|діагноз/);
});
test("loading skeleton and dashboard use private owner key; no care content rendered before load", () => {
  const c = client();
  const html = render(c, PetCareDashboard, { id });
  assert.match(html, /Завантажуємо догляд/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /Локі|Нагадувань ще немає/);
  assert.match(
    renderToStaticMarkup(React.createElement(PetCareLoading)),
    /role="status"/,
  );
  c.setQueryData(m.petCareKeys.dashboard(uid, id), pet);
  const loaded = render(c, PetCareDashboard, { id });
  assert.match(loaded, /Догляд за твариною/);
  assert.match(loaded, /До моїх тварин/);
  assert.match(loaded, /<svg/);
  assert.match(loaded, /Нагадувань ще немає/);
  assert.doesNotMatch(loaded, /<select/);
  c.clear();
});
test("404/generic failure hides cached data with neutral Ukrainian errors and scoped retry", async () => {
  for (const status of [404, 500]) {
    const c = client();
    const key = m.petCareKeys.dashboard(uid, id);
    c.setQueryData(key, pet);
    await assert.rejects(
      c.fetchQuery({
        queryKey: key,
        queryFn: () =>
          Promise.reject(new auth.ApiError(status, "PRIVATE RAW DB ERROR")),
        retry: false,
      }),
    );
    const html = render(c, PetCareDashboard, { id });
    assert.doesNotMatch(html, /Локі|PRIVATE RAW|Нагадувань/);
    assert.match(
      html,
      status === 404
        ? /Тварину не знайдено або у вас немає доступу/
        : /Не вдалося завантажити дані тварини/,
    );
    assert.equal(html.includes("Спробувати ще раз"), status !== 404);
    c.clear();
  }
});
test("owner Pet list has care action; public Pet card has none", async () => {
  const { PetList } = await load("src/features/pet/pet-list.tsx");
  const c = client();
  c.setQueryData(["my-pets", uid, { page: 1 }], {
    data: [pet],
    meta: { page: 1, pages: 1, total: 1, limit: 24 },
  });
  assert.match(render(c, PetList, {}), new RegExp("/pets/" + id + "/care"));
  const { PublicPetContent } = await load(
    "src/features/pet/public/public-pet-content.tsx",
  );
  const publicPet = {
    ...pet,
    description: null,
    specialTraits: null,
    images: [],
    videos: [],
    breeder: { userId: uid, kennelName: "Розплідник" },
    gender: "MALE",
    activeMatingListing: null,
  };
  const { PublicAnimalCard } = await load(
    "src/features/breeder/animals/public-breeder-animals.tsx",
  );
  const publicCard = render(c, PublicAnimalCard, {
    animal: { ...publicPet, previewImage: null, currentListing: null },
  });
  assert.doesNotMatch(publicCard, /\/care|Догляд/);
  assert.equal(typeof PublicPetContent, "function");
  c.clear();
});
test("care projection rejects unsafe image and strips private extras; safe login return is narrowly internal", async () => {
  const data = m.petCareSchema.parse({
    ...pet,
    healthNotes: "PRIVATE",
    ownerId: uid,
    profileImage: {
      url: "javascript:alert(1)",
      thumbnailUrl: "javascript:alert(1)",
    },
  });
  assert.equal(data.healthNotes, undefined);
  assert.equal(data.ownerId, undefined);
  assert.equal(data.profileImage, null);
  const { favoriteLoginReturn } = await load(
    "src/features/favorites/login-return.ts",
  );
  const path = m.petCareHref(id);
  assert.equal(favoriteLoginReturn(path), path);
  for (const value of [
    "https://evil.invalid" + path,
    "//evil.invalid" + path,
    "/pets/" + id + "/../care",
    "/pets/" + id + "/care/evil",
  ])
    assert.equal(favoriteLoginReturn(value), "/account");
});
test("logout removes care data and cancellation prevents late old-user response repopulation", async () => {
  const c = client(),
    key = m.petCareKeys.dashboard(uid, id);
  let resolveWork;
  const pending = c
    .fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise((resolve) => {
          resolveWork = resolve;
        }),
    })
    .catch(() => {});
  session.clearPrivateQueries(c);
  c.setQueryData(session.sessionKey, { id: "new-user", role: "USER" });
  resolveWork(pet);
  await pending;
  assert.equal(c.getQueryData(key), undefined);
  assert.equal(
    c.getQueryData(m.petCareKeys.dashboard("new-user", id)),
    undefined,
  );
  c.clear();
});
test("care API requests one owner projection, validates identity, and rejects late session generation", async () => {
  const saved = globalThis.fetch;
  let complete,
    requested = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf"))
      return new Response(JSON.stringify({ data: { csrfToken: "csrf" } }));
    if (url.endsWith("/refresh"))
      return new Response(
        JSON.stringify({
          data: { user: { id: uid }, accessToken: "fixture", expiresIn: 900 },
        }),
      );
    requested++;
    return new Promise((resolve) => {
      complete = (value = pet) =>
        resolve(new Response(JSON.stringify({ data: value })));
    });
  };
  try {
    auth.clearSession();
    const pending = api.getPetCare(id);
    while (!complete) await new Promise((resolve) => setTimeout(resolve, 1));
    auth.clearSession();
    complete();
    await assert.rejects(pending, /Session changed/);
    assert.equal(requested, 1);
    complete = undefined;
    const wrong = api.getPetCare(id);
    while (!complete) await new Promise((resolve) => setTimeout(resolve, 1));
    complete({ ...pet, id: uid });
    await assert.rejects(wrong, /Invalid Pet Care identity/);
    complete = undefined;
    const valid = api.getPetCare(id);
    while (!complete) await new Promise((resolve) => setTimeout(resolve, 1));
    complete();
    assert.equal((await valid).id, id);
    assert.equal(requested, 3);
  } finally {
    globalThis.fetch = saved;
    auth.clearSession();
  }
});
