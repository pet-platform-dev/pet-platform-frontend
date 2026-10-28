import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.ADMIN_CONTENT_UI_URL ?? "http://localhost:3019";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const ids = Array.from(
    { length: 9 },
    (_, i) =>
      `${String(i + 1).repeat(8)}-${String(i + 1).repeat(4)}-4${String(i + 1).repeat(3)}-8${String(i + 1).repeat(3)}-${String(i + 1).repeat(12)}`,
  ),
  at = "2026-01-01T00:00:00.000Z";
const actor = {
  id: ids[0],
  firstName: "Синтетичний",
  lastName: "Адміністратор",
  email: "synthetic-content@example.invalid",
  role: "ADMIN",
  accountType: "SELLER",
  verificationStatus: "VERIFIED",
  avatarUrl: null,
  createdAt: at,
};
const owner = {
  id: ids[1],
  firstName: "Олена",
  lastName: "Тестова",
  accountType: "SELLER",
};
const location = {
  id: ids[4],
  countryCode: "UA",
  city: "Київ",
  region: "Київ",
  district: null,
  community: null,
  settlementType: "CITY",
  katottgCode: null,
};
const species = { id: ids[5], name: "Собака", slug: "dog" },
  breed = {
    id: ids[6],
    name: "Test breed",
    nameUk: "Тестова порода",
    isActive: true,
  };
const pet = {
  id: ids[2],
  name: "Синтетичний пес",
  gender: "MALE",
  birthDate: null,
  visibility: "PRIVATE",
  createdAt: at,
  updatedAt: at,
  species,
  breed,
  owner,
};
const initial = {
  id: ids[3],
  source: "LISTING",
  title: "Тестове оголошення",
  description: "Справжній опис власника",
  type: "SALE",
  status: "ACTIVE",
  moderationStatus: "APPROVED",
  moderationReason: null,
  price: "2500.00",
  currency: "UAH",
  location,
  createdAt: at,
  updatedAt: at,
  images: [],
  owner,
  pet,
  publicPath: `/listings/${ids[3]}`,
  audit: [],
};
async function fixture(width, role = "ADMIN") {
  const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  let active = { ...actor, role },
    listing = { ...initial },
    draft = null,
    mode = "ok",
    writes = [],
    calls = [],
    revision = 0;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydration|did not match/i.test(m.text()))
      errors.push(m.text());
  });
  page.on("dialog", (d) => d.accept());
  await context.route("https://res.cloudinary.com/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKcEAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = req.method();
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Cache-Control": "no-store",
    };
    const reply = (data, status = 200, envelope = false) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(envelope ? data : { data }),
      });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/auth/csrf") return reply({ csrfToken: "synthetic-csrf" });
    if (path === "/auth/refresh")
      return active
        ? reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          })
        : reply(null, 401);
    if (path === "/auth/me") return active ? reply(active) : reply(null, 401);
    if (path === "/auth/logout") {
      active = null;
      return reply(null, 204);
    }
    if (path === "/species")
      return reply([species, { id: ids[8], name: "Кіт", slug: "cat" }]);
    if (path === "/breeds")
      return reply(
        { data: [breed], meta: { page: 1, pages: 1, total: 1, limit: 50 } },
        200,
        true,
      );
    if (path === "/locations")
      return reply(
        { data: [location], meta: { page: 1, pages: 1, total: 1, limit: 50 } },
        200,
        true,
      );
    if (path.startsWith("/uploads/listings")) {
      if (path.endsWith("/session"))
        return reply({
          uploadSessionId: ids[7],
          expiresAt: "2099-01-01T00:00:00.000Z",
        });
      if (method === "POST") return reply({ id: ids[8] });
      return reply(null, 204);
    }
    if (path.startsWith("/admin/")) {
      calls.push({ path, query: url.search, method });
      if (!active) return reply(null, 401);
      if (!["ADMIN", "SUPER_ADMIN"].includes(active.role))
        return reply(null, 403);
      if (mode === "error" && method === "GET") return reply(null, 500);
      if (method === "POST" || method === "PATCH") {
        const body = req.postDataJSON();
        writes.push(body);
        assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
        if (mode === "conflict") return reply(null, 409);
        const updatedAt = new Date(Date.parse(at) + ++revision).toISOString();
        if (path.startsWith("/admin/listing-drafts")) {
          draft = {
            ...body,
            id: ids[7],
            source: "OPERATOR_DRAFT",
            type: body.kind,
            species: body.speciesId ? species : null,
            breed: body.breedId ? breed : null,
            location: body.locationId ? location : null,
            images: body.imageIds.map((id) => ({
              id,
              url: `https://res.cloudinary.com/synthetic/image/upload/v1/${id}.png`,
            })),
            createdAt: at,
            updatedAt,
            createdById: actor.id,
            updatedById: actor.id,
            publicPath: null,
            audit: [],
          };
          return reply(draft, method === "POST" ? 201 : 200);
        }
        listing = {
          ...listing,
          ...body,
          updatedAt,
          moderationStatus: "PENDING",
          publicPath: null,
        };
        return reply(listing);
      }
      if (path === "/admin/pets")
        return reply(
          {
            data: [pet],
            meta: {
              page: Number(url.searchParams.get("page") ?? 1),
              pages: 2,
              total: 2,
              limit: 24,
            },
          },
          200,
          true,
        );
      if (path.startsWith("/admin/pets/"))
        return reply({
          ...pet,
          listings: [listing],
          matingListings: [{ ...listing, id: ids[8] }],
          _count: { listings: 1, matingListings: 1 },
        });
      if (path === "/admin/listings") {
        const source = url.searchParams.get("source"),
          data =
            source === "OPERATOR_DRAFT"
              ? draft
                ? [draft]
                : []
              : source === "MATING"
                ? [
                    {
                      ...listing,
                      id: ids[8],
                      source: "MATING",
                      type: "MATING",
                      requirements: "Умови власника",
                    },
                  ]
                : [listing];
        return reply(
          {
            data,
            meta: {
              page: Number(url.searchParams.get("page") ?? 1),
              pages: 2,
              total: 2,
              limit: Number(url.searchParams.get("limit") ?? 24),
            },
          },
          200,
          true,
        );
      }
      if (path.startsWith("/admin/listings/"))
        return reply(
          url.searchParams.get("source") === "OPERATOR_DRAFT"
            ? draft
            : url.searchParams.get("source") === "MATING"
              ? {
                  ...listing,
                  id: ids[8],
                  source: "MATING",
                  type: "MATING",
                  requirements: "Умови власника",
                }
              : listing,
        );
    }
    if (path.startsWith("/notifications"))
      return reply(
        { data: [], meta: { page: 1, pages: 0, total: 0, limit: 20 } },
        200,
        true,
      );
    return reply({});
  });
  return {
    context,
    page,
    errors,
    writes,
    calls,
    setMode: (v) => {
      mode = v;
    },
    setActor: (v) => {
      active = v;
    },
  };
}

async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function overflow(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
}
await mkdir("test-results/phase18c1/listings", { recursive: true });
const results = [];
try {
  for (const width of [375, 768, 1440]) {
    const f = await fixture(width, width === 768 ? "SUPER_ADMIN" : "ADMIN"),
      { page } = f;
    await page.goto(base + "/admin/listings");
    await page
      .getByRole("heading", { name: "Оголошення", exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: "Тестове оголошення", exact: true })
      .waitFor();
    await overflow(page);
    await choose(page, "Джерело", "Підготовлені чернетки");
    await page
      .getByText("За цими умовами нічого не знайдено.", { exact: true })
      .waitFor();
    f.setMode("error");
    await choose(page, "Джерело", "Оголошення");
    await page
      .getByRole("alert")
      .filter({ hasText: "Не вдалося завантажити дані." })
      .waitFor();
    f.setMode("ok");
    await page
      .getByRole("button", { name: "Спробувати ще раз", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Тестове оголошення", exact: true })
      .waitFor();
    await choose(page, "Джерело", "В’язка");
    await page.waitForURL((url) => url.searchParams.get("source") === "MATING");
    await page
      .locator('a[href*="source=MATING"]')
      .filter({ hasText: "Тестове оголошення" })
      .click();
    await page.getByLabel("Умови партнера", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Умови партнера", { exact: true }).inputValue(),
      "Умови власника",
    );
    await page.goto(base + "/admin/listings");
    await page
      .getByRole("link", { name: "Тестове оголошення", exact: true })
      .waitFor();
    const combo = page.getByRole("combobox", { name: "Джерело", exact: true });
    await combo.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    assert.equal(await combo.getAttribute("aria-expanded"), "false");
    await page.getByLabel("Пошук за заголовком або описом").fill("Тестове");
    await page.getByRole("button", { name: "Шукати", exact: true }).click();
    await page.waitForURL(/q=/);
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "GET" &&
          new URL(r.url()).pathname.endsWith("/api/v1/admin/listings") &&
          new URL(r.url()).searchParams.get("page") === "2",
      ),
      page.getByRole("button", { name: "Наступна", exact: true }).click(),
    ]);
    await page.waitForURL(/page=2/);
    assert(f.calls.some((c) => c.query.includes("page=2")));
    await page
      .getByRole("link", { name: "Тестове оголошення", exact: true })
      .click();
    await page.getByLabel("Заголовок", { exact: true }).waitFor();
    await page
      .getByLabel("Заголовок", { exact: true })
      .fill("Виправлене оголошення");
    await page.getByRole("button", { name: "Зберегти", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "адміністративну причину" })
      .waitFor();
    assert.equal(f.writes.length, 0);
    await page
      .getByLabel("Причина адміністративної зміни")
      .fill("Власник попросив виправити заголовок.");
    await page.getByRole("button", { name: "Зберегти", exact: true }).click();
    await page.getByText("Зміни збережено.", { exact: true }).waitFor();
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].expectedUpdatedAt, at);
    assert(
      !(await page
        .getByRole("link", { name: "Публічне оголошення", exact: true })
        .count()),
    );
    await page.goto(base + "/admin/pets");
    await page
      .getByRole("link", { name: "Синтетичний пес", exact: true })
      .click();
    await page.getByText("Лише перегляд.", { exact: false }).waitFor();
    assert(!(await page.getByLabel("Заголовок", { exact: true }).count()));
    await overflow(page);
    await page.goto(base + "/admin/listings/new");
    await page
      .getByLabel("Заголовок", { exact: true })
      .fill("Підготовлене оголошення");
    await page
      .getByLabel("Опис", { exact: true })
      .fill("Справжній опис для приватної підготовки");
    await page.getByRole("button", { name: "Зберегти", exact: true }).click();
    await page.waitForURL(/source=OPERATOR_DRAFT/);
    await page.getByLabel("Заголовок", { exact: true }).waitFor();
    assert.equal(f.writes.length, 2);
    for (const key of [
      "consentConfirmed",
      "consentAt",
      "consentScope",
      "consentSource",
      "sourceReference",
      "mediaRightsReference",
    ])
      assert(!Object.hasOwn(f.writes[1], key));
    for (const label of [
      "Маю дозвіл власника",
      "Фактична дата й час згоди",
      "Обсяг дозволу на підготовку",
      "Довідка про права на фото",
    ])
      assert.equal(await page.getByLabel(label).count(), 0);
    assert(!Object.hasOwn(f.writes[1], "ownerId"));
    await choose(page, "Стан приватної чернетки", "Готова до перевірки");
    await page.getByRole("button", { name: "Зберегти", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Для перевірки потрібні" })
      .waitFor();
    assert.equal(f.writes.length, 2);
    await choose(page, "Вид тварини", "Собака");
    await page.getByRole("combobox", { name: "Місце", exact: true }).fill("Ки");
    await page.getByRole("option").filter({ hasText: "Київ" }).first().click();
    await page.getByLabel("Ціна, грн").fill("1200");
    await page.getByLabel("Додати фото", { exact: true }).setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKcEAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByText("Завантажено", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Зберегти", exact: true }).click();
    await page.getByText("Зміни збережено.", { exact: true }).waitFor();
    assert.equal(f.writes.length, 3);
    assert.equal(f.writes[2].status, "READY_FOR_REVIEW");
    assert.deepEqual(f.writes[2].imageIds, [ids[8]]);
    await overflow(page);
    await page.screenshot({
      path: `test-results/phase18c1/listings/draft-${width}.png`,
      fullPage: true,
    });
    f.setMode("conflict");
    await page
      .getByLabel("Заголовок", { exact: true })
      .fill("Конкурентна зміна");
    await page.getByRole("button", { name: "Зберегти", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Дані змінилися" })
      .waitFor();
    assert(
      await page
        .getByRole("button", { name: "Зберегти", exact: true })
        .isDisabled(),
    );
    const sessionTab = await f.context.newPage();
    await sessionTab.goto(base + "/login");
    f.setActor({ ...actor, id: owner.id, role: "USER" });
    await sessionTab.evaluate(() => {
      const c = new BroadcastChannel("pet-platform-session");
      c.postMessage({
        kind: "login",
        source: "synthetic-content-account-switch",
      });
      c.close();
    });
    await page
      .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
      .waitFor();
    assert.equal(
      await page.getByLabel("Заголовок", { exact: true }).count(),
      0,
    );
    f.setActor(null);
    await sessionTab.evaluate(() => {
      const c = new BroadcastChannel("pet-platform-session");
      c.postMessage({ kind: "logout", source: "synthetic-content-logout" });
      c.close();
    });
    await page.waitForURL(/\/login\?/);
    assert.equal(
      await page.getByLabel("Заголовок", { exact: true }).count(),
      0,
    );
    assert.deepEqual(f.errors, []);
    await f.context.close();
    const denied = await fixture(width, "MODERATOR");
    await denied.page.goto(base + "/admin/listings");
    await denied.page
      .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
      .waitFor();
    assert.equal(denied.calls.length, 0);
    await denied.context.close();
    results.push({
      width,
      outcome: "passed",
      coverage:
        "ADMIN/SUPER inheritance, MODERATOR zero fetch, list search/page, detail explicit reason/edit, Pet readonly, private draft create/edit, content readiness without consent, real custom references, custody upload, stale conflict, cross-tab account switch/logout, keyboard, overflow, hydration",
    });
    console.log(JSON.stringify(results.at(-1)));
  }
  await writeFile(
    "test-results/phase18c1/listings/results.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
