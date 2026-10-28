import { finishSkippedBreederWizard } from "./helpers/breeder-wizard.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.ADMIN_MANAGEMENT_UI_URL ?? "http://localhost:3017";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const id = "11111111-1111-4111-8111-111111111111",
  profileId = "22222222-2222-4222-8222-222222222222",
  draftId = "33333333-3333-4333-8333-333333333333";
const date = "2026-01-01T00:00:00.000Z";
const admin = {
  id,
  email: "synthetic-admin@example.invalid",
  firstName: "Олена",
  lastName: "Тестова",
  role: "ADMIN",
  accountType: "SELLER",
  verificationStatus: "VERIFIED",
  avatarUrl: null,
  createdAt: date,
};
const owner = {
  id: profileId,
  kennelName: "Синтетичний розплідник",
  source: "OWNER_MANAGED",
  visibility: "PUBLIC",
  userId: id,
  user: { id, firstName: "Олена", lastName: "Тестова", accountType: "BREEDER" },
  createdAt: date,
  updatedAt: date,
  description: null,
  website: null,
  startedYear: null,
  locationId: null,
  location: null,
  breeds: [],
  publicPath: `/sellers/${id}`,
  audit: [],
};
async function fixture(width, actor = admin, held = false) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  let active = actor,
    mode = "ok",
    draft,
    calls = [],
    writes = [],
    release;
  const restore = new Promise((resolve) => {
    release = resolve;
  });
  if (!held) release();
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = request.method();
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
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
    if (path === "/auth/refresh") {
      await restore;
      return active
        ? reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          })
        : reply(null, 401);
    }
    if (path === "/auth/me") return active ? reply(active) : reply(null, 401);
    if (path === "/auth/logout") {
      active = null;
      return reply(null, 204);
    }
    if (path.startsWith("/admin/")) {
      calls.push(url);
      assert.equal(request.headers().authorization, "Bearer synthetic-access");
      if (mode === "denied") return reply(null, 403);
      if (mode === "failed") return reply(null, 503);
      if (path === "/admin/users") {
        const page = Number(url.searchParams.get("page") ?? 1),
          empty = url.searchParams.get("q") === "empty";
        return reply(
          {
            data: empty ? [] : [admin],
            meta: {
              page,
              limit: 24,
              total: empty ? 0 : 25,
              pages: empty ? 0 : 2,
            },
          },
          200,
          true,
        );
      }
      if (path === `/admin/users/${id}`)
        return reply({
          ...admin,
          counts: { pets: 2, listings: 3, matingListings: 0 },
          breederProfile: null,
          sellerPath: `/sellers/${id}`,
          accountType: "BREEDER",
          breederPath: `/sellers/${id}`,
        });
      if (path === "/admin/breeders" && method === "GET") {
        const rows =
          url.searchParams.get("source") === "OPERATOR_PREPARED"
            ? draft
              ? [draft]
              : []
            : [owner];
        return reply(
          {
            data: rows.map((row) => ({ ...row, userId: row.userId ?? null })),
            meta: {
              page: 1,
              limit: 24,
              total: rows.length,
              pages: rows.length ? 1 : 0,
            },
          },
          200,
          true,
        );
      }
      if (path === "/admin/breeders" && method === "POST") {
        const input = request.postDataJSON();
        assert.equal(request.headers()["x-csrf-token"], "synthetic-csrf");
        for (const key of [
          "consentConfirmed",
          "consentAt",
          "consentScope",
          "consentSource",
          "sourceReference",
          "mediaRightsReference",
        ])
          assert(!(key in input));
        assert(
          !("userId" in input) && !("status" in input) && !("media" in input),
        );
        writes.push(input);
        draft = {
          ...owner,
          ...input,
          id: draftId,
          userId: undefined,
          source: "OPERATOR_PREPARED",
          visibility: "PRIVATE",
          publicPath: null,
          preparedById: id,
          audit: [
            {
              id: profileId,
              actorId: id,
              action: "CREATE_DRAFT",
              changedFields: ["kennelName"],
              createdAt: date,
              revision: date,
            },
          ],
        };
        return reply(draft);
      }
      if (path === `/admin/breeders/${draftId}` && method === "PATCH") {
        const input = request.postDataJSON();
        writes.push(input);
        if (mode === "conflict") return reply(null, 409);
        assert.equal(input.expectedUpdatedAt, draft.updatedAt);
        assert(!("consentAt" in input));
        draft = { ...draft, ...input, updatedAt: "2026-01-02T00:00:00.000Z" };
        return reply(draft);
      }
      if (path === `/admin/breeders/${profileId}`)
        return reply(
          mode === "private-owner"
            ? {
                ...owner,
                visibility: "PRIVATE",
                publicPath: null,
                user: { ...owner.user, accountType: "SELLER" },
              }
            : owner,
        );
      if (path === `/admin/breeders/${draftId}` && draft) return reply(draft);
      return reply(null, 404);
    }
    if (path === "/locations" || path === "/breeds")
      return reply(
        { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
        200,
        true,
      );
    if (path.endsWith("unread") || path.endsWith("unread-count"))
      return reply({ count: 0 });
    return reply([]);
  });
  await context.route("**/socket.io/**", (route) =>
    route.fulfill({
      status: 200,
      body: '0{"sid":"fixture","upgrades":[],"pingInterval":25000,"pingTimeout":20000}',
    }),
  );
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      /hydration failed|hydrated but|same key|two children/i.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
  return {
    context,
    page,
    errors,
    release,
    calls,
    writes,
    mode(value) {
      mode = value;
    },
    actor(value) {
      active = value;
    },
  };
}
async function layout(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Horizontal page overflow",
  );
}
async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const results = [];
try {
  await mkdir("test-results/phase18c1/breeders", { recursive: true });
  for (const width of [375, 768, 1440]) {
    for (const role of process.env.ADMIN_OWNER_BOUNDARY_ONLY === "1"
      ? []
      : [null, "USER", "BREEDER", "MODERATOR"]) {
      const f = await fixture(width, role ? { ...admin, role } : null);
      try {
        await f.page.goto(`${base}/admin/users`);
        if (!role) await f.page.waitForURL(/\/login/);
        else
          await f.page
            .getByRole("heading", {
              name: "Доступ до адміністрування недоступний",
            })
            .waitFor();
        assert.equal(f.calls.length, 0);
        await layout(f.page);
        assert.deepEqual(f.errors, []);
      } finally {
        await f.context.close();
      }
    }
    const f = await fixture(width, admin, true),
      { page } = f;
    try {
      if (process.env.ADMIN_OWNER_BOUNDARY_ONLY === "1") {
        f.release();
        await page.goto(`${base}/admin/breeders/${profileId}`);
        await page
          .getByRole("button", { name: "Зберегти зміни", exact: true })
          .waitFor();
        await layout(page);
        f.mode("private-owner");
        await page.reload();
        await page
          .getByText(
            "Акаунт власника зараз не є акаунтом заводчика. Інформація доступна лише для перегляду.",
            { exact: true },
          )
          .waitFor();
        assert.equal(await page.locator(".admin-management-form").count(), 0);
        await layout(page);
        assert.deepEqual(f.errors, []);
        results.push({
          width,
          passed: true,
          coverage:
            "owner BREEDER editable; retained SELLER profile readonly without forbidden mutation or public link",
        });
        continue;
      }
      await page.goto(`${base}/admin/users`);
      assert.equal(f.calls.length, 0);
      f.release();
      await page.locator(".admin-management-grid article").waitFor();
      await layout(page);
      const input = page.getByLabel("Пошук за ім’ям або поштою");
      const before = f.calls.length;
      await input.fill("Олена");
      assert.equal(f.calls.length, before, "Search must debounce");
      await page.waitForURL((url) => url.searchParams.get("q") === "Олена");
      await choose(page, "Технічна роль", "Адміністратор");
      await page.waitForURL((url) => url.searchParams.get("role") === "ADMIN");
      await choose(page, "Сортування", "За назвою: А–Я");
      await page.waitForURL(
        (url) => url.searchParams.get("sort") === "NAME_ASC",
      );
      await page.getByRole("link", { name: "Сторінка 2", exact: true }).click();
      await page.waitForURL((url) => url.searchParams.get("page") === "2");
      const listUrl = page.url();
      await page.locator(".admin-management-grid a").click();
      await page.getByText(admin.email, { exact: true }).waitFor();
      assert.equal(await page.locator(".admin-management form").count(), 0);
      assert.equal(
        await page
          .getByRole("link", { name: "Профіль розплідника", exact: true })
          .getAttribute("href"),
        `/sellers/${id}`,
      );
      await layout(page);
      await page
        .getByRole("link", { name: "До користувачів", exact: true })
        .click();
      await page.waitForURL(listUrl);
      assert.equal(page.url(), listUrl);
      await page.getByLabel("Пошук за ім’ям або поштою").fill("empty");
      await page
        .getByText("За цими умовами записів немає.", { exact: true })
        .waitFor();
      f.mode("failed");
      await page.reload();
      await page
        .getByRole("alert")
        .filter({ hasText: "Не вдалося завантажити записи" })
        .waitFor();
      f.mode("ok");
      await page
        .getByRole("button", { name: "Спробувати ще раз", exact: true })
        .click();
      await page
        .getByText("За цими умовами записів немає.", { exact: true })
        .waitFor();
      await page.goto(`${base}/admin/breeders`);
      await page.locator(".admin-management-grid a").click();
      await page
        .getByRole("link", { name: "Переглянути акаунт власника" })
        .waitFor();
      assert.equal(
        await page
          .getByLabel("Маю дозвіл власника на підготовку цієї чернетки")
          .count(),
        0,
      );
      await layout(page);
      await page
        .getByRole("link", { name: "До розплідників", exact: true })
        .click();
      await choose(page, "Джерело профілю", "Операторські чернетки");
      await page
        .getByText("За цими умовами записів немає.", { exact: true })
        .waitFor();
      await page
        .getByRole("link", { name: "Створити приватну чернетку", exact: true })
        .click();
      const create = page.getByRole("button", {
        name: "Далі",
        exact: true,
      });
      assert.equal(f.writes.length, 0);
      await page.locator("#breeder-kennelName").fill("Синтетична чернетка");
      assert.equal(
        await page.locator('input[type="datetime-local"]').count(),
        0,
      );
      await page.locator("#breeder-kennelName").focus();
      await page.keyboard.press("Tab");
      await layout(page);
      await create.click();
      await finishSkippedBreederWizard(page);
      await page.locator("#operatorNotes").waitFor();
      assert.equal(f.writes.length, 1);
      assert(
        await page
          .getByRole("button", { name: "Публікація недоступна" })
          .isDisabled(),
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Переглянути публічний профіль" })
          .count(),
        0,
      );
      await page.locator("#operatorNotes").fill("Оновлена внутрішня примітка");
      await page
        .getByRole("button", { name: "Зберегти зміни", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector("#operatorNotes")?.value ===
            "Оновлена внутрішня примітка" &&
          !document.querySelector('button[type="submit"]')?.disabled,
      );
      assert.equal(f.writes.length, 2);
      f.mode("conflict");
      await page.locator("#operatorNotes").fill("Конкурентна зміна");
      await page
        .getByRole("button", { name: "Зберегти зміни", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Оновити дані", exact: true })
        .waitFor();
      assert(
        await page
          .getByRole("button", { name: "Зберегти зміни", exact: true })
          .isDisabled(),
      );
      f.mode("ok");
      await page
        .getByRole("button", { name: "Оновити дані", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector("#operatorNotes")?.value ===
          "Оновлена внутрішня примітка",
      );
      await layout(page);
      await page.screenshot({
        path: `test-results/phase18c1/breeders/draft-${width}.png`,
        fullPage: true,
      });
      f.mode("denied");
      await page.reload();
      await page
        .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
        .waitFor();
      assert.equal(await page.locator(".admin-management-form").count(), 0);
      f.mode("ok");
      await page
        .getByRole("button", { name: "Перевірити доступ", exact: true })
        .click();
      await page.locator("#operatorNotes").waitFor();
      const other = await f.context.newPage();
      await other.goto(`${base}/account`);
      await other.locator(".verification-email").waitFor();
      f.actor({ ...admin, id: draftId, role: "USER" });
      await other.evaluate(() => {
        const c = new BroadcastChannel("pet-platform-session");
        c.postMessage({ kind: "login", source: "synthetic-switch-18b" });
        c.close();
      });
      await page
        .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
        .waitFor();
      assert.equal(await page.locator(".admin-management-form").count(), 0);
      await other.close();
      f.actor(admin);
      await page
        .getByRole("button", { name: "Перевірити доступ", exact: true })
        .click();
      await page.locator("#operatorNotes").waitFor();
      const tab = await f.context.newPage();
      await tab.goto(`${base}/account`);
      await tab.locator(".verification-email").waitFor();
      await tab
        .getByRole("button", { name: "Вийти з акаунта", exact: true })
        .click();
      await page.waitForURL(/\/login/);
      assert.equal(await page.locator(".admin-management-form").count(), 0);
      await tab.close();
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        passed: true,
        coverage:
          "guest/USER/BREEDER/MODERATOR, delayed restore, debounce/search/filter/sort/page/back, readonly user, empty/error/retry, owner/draft, no-consent/create/edit/conflict refresh, disabled publication, CSRF, 403, cross-tab account switch/logout, keyboard focus, no overflow/hydration errors",
      });
    } finally {
      f.release();
      await f.context.close();
    }
  }
  await writeFile(
    `test-results/phase18c1/breeders/${process.env.ADMIN_OWNER_BOUNDARY_ONLY === "1" ? "owner-boundary-results" : "results"}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
