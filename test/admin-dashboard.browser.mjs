import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.ADMIN_DASHBOARD_UI_URL ?? "http://localhost:3017";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const results = [];
const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "synthetic-admin@example.invalid",
  firstName: "Тест",
  lastName: "Адміністратора",
  role: "ADMIN",
  accountType: "SELLER",
  verificationStatus: "VERIFIED",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
};
const metrics = {
  users: 12345,
  breederProfiles: 7,
  pets: 25,
  listings: 19,
  activeListings: 8,
  matingListings: 5,
  openReports: 3,
  newUsers7Days: 2,
};
async function fixture(width, actor, held = false) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  let active = actor,
    mode = "ok",
    calls = 0,
    release,
    releaseDashboard,
    started;
  const restore = new Promise((resolve) => {
    release = resolve;
  });
  const dashboardGate = new Promise((resolve) => {
    releaseDashboard = resolve;
  });
  const dashboardStarted = new Promise((resolve) => {
    started = resolve;
  });
  if (!held) {
    release();
    releaseDashboard();
  }
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Cache-Control": "no-store",
    };
    const reply = (data, status = 200, envelope = false) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(envelope ? data : { data }),
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
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
    if (path === "/admin/dashboard") {
      calls++;
      started();
      await dashboardGate;
      assert.equal(req.headers().authorization, "Bearer synthetic-access");
      if (mode === "denied") return reply(null, 403);
      if (mode === "revoked") {
        active = null;
        return reply(null, 401);
      }
      if (mode === "failed") return reply(null, 503);
      return reply({
        asOf: "2026-10-24T10:00:00.000Z",
        metrics:
          mode === "zero"
            ? Object.fromEntries(Object.keys(metrics).map((key) => [key, 0]))
            : metrics,
      });
    }
    if (path === "/admin/moderation/queue")
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
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/hydration failed|hydrated but/i.test(m.text())) errors.push(m.text());
  });
  return {
    page,
    context,
    errors,
    release,
    releaseDashboard,
    dashboardStarted,
    calls: () => calls,
    mode: (value) => {
      mode = value;
    },
    actor: (value) => {
      active = value;
    },
  };
}
async function layout(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
async function cards(page) {
  await page.locator(".admin-metric").first().waitFor();
  assert.equal(await page.locator(".admin-metric").count(), 8);
}
try {
  await mkdir("test-results/phase18a", { recursive: true });
  for (const width of [375, 768, 1440]) {
    for (const role of [null, "USER", "BREEDER"]) {
      const f = await fixture(width, role ? { ...admin, role } : null);
      try {
        await f.page.goto(`${base}/admin`);
        if (!role) {
          await f.page.waitForURL(/\/login/);
          assert.equal(
            new URL(f.page.url()).searchParams.get("returnTo"),
            "/admin",
          );
        } else
          await f.page
            .getByRole("heading", {
              name: "Доступ до адміністрування недоступний",
            })
            .waitFor();
        assert.equal(f.calls(), 0);
        assert.equal(await f.page.locator(".admin-metric").count(), 0);
        await layout(f.page);
        assert.deepEqual(f.errors, []);
      } finally {
        await f.context.close();
      }
    }
    const f = await fixture(width, admin, true),
      { page } = f;
    try {
      const response = await page.goto(`${base}/admin`);
      assert.match(response.headers()["cache-control"], /no-store|private/);
      assert.equal(f.calls(), 0);
      assert.equal(await page.locator(".admin-metric").count(), 0);
      f.release();
      await f.dashboardStarted;
      await page
        .getByRole("status", { name: "Завантажуємо показники" })
        .waitFor();
      assert.equal(await page.locator(".admin-metric").count(), 0);
      f.releaseDashboard();
      await cards(page);
      assert(
        (await page.locator(".admin-metric").first().innerText()).includes(
          new Intl.NumberFormat("uk-UA").format(metrics.users),
        ),
      );
      const nav = page.getByRole("navigation", {
        name: "Адміністрування",
        exact: true,
      });
      assert.equal(await nav.getByRole("link").count(), 3);
      const overview = nav.getByRole("link", { name: "Огляд", exact: true });
      await page.keyboard.press("Tab");
      await overview.focus();
      assert(
        await overview.evaluate(
          (n) =>
            n === document.activeElement &&
            getComputedStyle(n).outlineStyle !== "none",
        ),
      );
      await layout(page);
      await page.screenshot({
        path: `test-results/phase18a/dashboard-${width}.png`,
        fullPage: true,
      });
      await nav.getByRole("link", { name: "Модерація", exact: true }).click();
      await page
        .getByRole("heading", { name: "Модерація", exact: true })
        .waitFor();
      await overview.click();
      await cards(page);
      f.mode("zero");
      await page.reload();
      await cards(page);
      assert.equal(
        await page
          .locator(".admin-metric > dd:not(.admin-metric-description)")
          .filter({ hasText: /^0$/ })
          .count(),
        8,
      );
      f.mode("failed");
      await page.reload();
      await page
        .getByRole("alert")
        .filter({ hasText: "Не вдалося завантажити показники" })
        .waitFor();
      assert.equal(await page.locator(".admin-metric").count(), 0);
      f.mode("ok");
      await page
        .getByRole("button", { name: "Спробувати ще раз", exact: true })
        .click();
      await cards(page);
      f.mode("denied");
      await page.reload();
      await page
        .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
        .waitFor();
      assert.equal(await page.locator(".admin-metric").count(), 0);
      f.mode("ok");
      await page
        .getByRole("button", { name: "Перевірити доступ", exact: true })
        .click();
      await cards(page);
      // A real second tab receives a credential-free account-switch event.
      const otherTab = await f.context.newPage();
      await otherTab.goto(`${base}/account`);
      await otherTab.locator(".verification-email").waitFor();
      f.actor({
        ...admin,
        id: "22222222-2222-4222-8222-222222222222",
        role: "USER",
      });
      await otherTab.evaluate(() => {
        const c = new BroadcastChannel("pet-platform-session");
        c.postMessage({ kind: "login", source: "synthetic-switch" });
        c.close();
      });
      await page
        .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
        .waitFor();
      assert.equal(await page.locator(".admin-metric").count(), 0);
      await otherTab.close();
      f.actor(admin);
      await page
        .getByRole("button", { name: "Перевірити доступ", exact: true })
        .click();
      await cards(page);
      f.mode("revoked");
      await page.reload();
      await page.waitForURL(/\/login/);
      assert.equal(await page.locator(".admin-metric").count(), 0);
      f.actor(admin);
      f.mode("ok");
      await page.goto(`${base}/admin`);
      await cards(page);
      await page
        .getByRole("link", { name: "До оголошень", exact: true })
        .click();
      await page.waitForURL(/\/listings/);
      await page.goto(`${base}/account`);
      await page.locator(".verification-email").waitFor();
      const tab = await f.context.newPage();
      await tab.goto(`${base}/admin`);
      await cards(tab);
      await page
        .getByRole("button", { name: "Вийти з акаунта", exact: true })
        .click();
      await tab.waitForURL(/\/login/);
      assert.equal(await tab.locator(".admin-metric").count(), 0);
      await tab.close();
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        passed: true,
        coverage:
          "guest/nonadmin/auth restoration/loading/metrics/zero/error retry/403/demotion switch/revocation/moderation/public/logout/focus/overflow",
      });
    } finally {
      f.release();
      f.releaseDashboard();
      await f.context.close();
    }
  }
  await writeFile(
    "test-results/phase18a/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
