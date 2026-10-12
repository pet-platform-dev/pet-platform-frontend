import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const api = await load("src/entities/mating-listing/api.ts");
const client = await load("src/shared/api/client.ts");
const { matingError } = await load("src/features/mating/model.ts");
const id = "11111111-1111-4111-8111-111111111111",
  userId = "22222222-2222-4222-8222-222222222222";
const row = {
  id,
  title: "В’язка",
  description: "Умови",
  fee: null,
  currency: "UAH",
  status: "DRAFT",
  pet: {
    id,
    name: null,
    gender: "MALE",
    birthDate: null,
    species: { id, name: "Собака", slug: "dog" },
    breed: null,
    profileImage: null,
  },
  location: {
    id,
    countryCode: "UA",
    city: "Київ",
    region: "Київська область",
    district: null,
    community: null,
    settlementType: "CITY",
    slug: "kyiv",
  },
  owner: {
    id: userId,
    displayName: "Олександр Єпік",
    href: "/sellers/" + userId,
    breeder: null,
  },
  createdAt: "2026-10-11T10:00:00Z",
  updatedAt: "2026-10-11T10:00:00Z",
  publishedAt: null,
  closedAt: null,
};
const reply = (data, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
async function transport(run, handler) {
  const saved = globalThis.fetch;
  client.clearSession();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/csrf")) return reply({ csrfToken: "fixture-csrf" });
    if (url.endsWith("/refresh"))
      return reply({
        user: { id: userId },
        accessToken: "fixture-token",
        expiresIn: 900,
      });
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = saved;
    client.clearSession();
  }
}
test("create sends only draft inputs and exact decimal string with authenticated CSRF", async () =>
  transport(
    async (calls) => {
      const result = await api.createMating({
        petId: id,
        description: "Умови",
        locationId: id,
        fee: "1234.56",
      });
      assert.equal(result.status, "DRAFT");
      assert.deepEqual(JSON.parse(calls[0].init.body), {
        petId: id,
        description: "Умови",
        locationId: id,
        fee: "1234.56",
      });
      assert.equal(calls[0].init.headers["X-CSRF-Token"], "fixture-csrf");
      assert.equal(calls[0].init.headers.Authorization, "Bearer fixture-token");
      assert.ok(calls[0].url.endsWith("/mating-listings"));
    },
    () => reply(row),
  ));
test("owner detail preserves current data and safely rejects another owner", async () =>
  transport(
    async () => {
      assert.equal(
        (await api.getOwnedMating(id, userId)).location.katottgCode,
        null,
      );
      await assert.rejects(api.getOwnedMating(id, id), (e) => e.status === 404);
    },
    () => reply(row),
  ));
test("invalid route id rejected before transport", async () =>
  transport(
    async (calls) => {
      await assert.rejects(
        api.getOwnedMating("not/id", userId),
        (e) => e.status === 404,
      );
      assert.equal(calls.length, 0);
    },
    () => {
      throw Error("Must not call");
    },
  ));
test("my page preserves owner pagination and translated filter API status", async () =>
  transport(
    async (calls) => {
      await api.getMyMating(2, "CLOSED");
      const url = new URL(calls[0].url);
      assert.equal(url.searchParams.get("page"), "2");
      assert.equal(url.searchParams.get("limit"), "24");
      assert.equal(url.searchParams.get("status"), "CLOSED");
    },
    () =>
      new Response(
        JSON.stringify({
          data: [{ ...row, status: "CLOSED" }],
          meta: { page: 2, limit: 24, total: 25, pages: 2 },
        }),
      ),
  ));
test("eligibility reads all active pages, not only first 100", async () =>
  transport(
    async (calls) => {
      const rows = await api.getActiveMating();
      assert.equal(rows.length, 2);
      assert.equal(calls.length, 2);
      assert.ok(calls[1].url.includes("page=2"));
    },
    (url, init, n) =>
      new Response(
        JSON.stringify({
          data: [{ ...row, status: "ACTIVE" }],
          meta: { page: n, limit: 100, total: 101, pages: 2 },
        }),
      ),
  ));
for (const [action, status] of [
  ["publish", "ACTIVE"],
  ["close", "CLOSED"],
  ["archive", "ARCHIVED"],
])
  test(action + " uses explicit POST lifecycle endpoint", async () =>
    transport(
      async (calls) => {
        assert.equal((await api.actOnMating(id, action)).status, status);
        assert.ok(calls[0].url.endsWith("/" + id + "/" + action));
        assert.equal(calls[0].init.method, "POST");
      },
      () => reply({ ...row, status }),
    ),
  );
test("draft delete accepts empty 204 response", async () =>
  transport(
    async (calls) => {
      assert.equal(await api.actOnMating(id, "delete"), null);
      assert.equal(calls[0].init.method, "DELETE");
    },
    () => reply(null, 204),
  ));
test("edit sends allowed fields without replacing Pet identity", async () =>
  transport(
    async (calls) => {
      await api.updateMating(id, {
        description: "Зміни",
        locationId: id,
        fee: "0",
      });
      assert.deepEqual(JSON.parse(calls[0].init.body), {
        description: "Зміни",
        locationId: id,
        fee: "0",
      });
      assert.equal(calls[0].init.method, "PATCH");
    },
    () => reply({ ...row, description: "Зміни", fee: "0.00" }),
  ));
for (const [message, status, want] of [
  [
    "Тварина вже має активне оголошення про в’язку",
    409,
    "Для цієї тварини вже є активне оголошення про в’язку.",
  ],
  [
    "Спочатку вкажіть стать тварини",
    400,
    "Для створення оголошення вкажіть стать тварини.",
  ],
  [
    "Оберіть доступний населений пункт",
    400,
    "Оберіть коректний населений пункт.",
  ],
  ["Prisma private provider token", 500, "Не вдалося зберегти оголошення."],
])
  test(
    "HTTP errors map safely: " + status + " " + message.slice(0, 20),
    async () =>
      transport(
        async () => {
          try {
            await api.createMating({
              petId: id,
              description: "Умови",
              locationId: id,
              fee: null,
            });
            assert.fail("Expected error");
          } catch (e) {
            assert.equal(matingError(e), want);
          }
        },
        () => new Response(JSON.stringify({ message }), { status }),
      ),
  );
