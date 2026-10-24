import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.ADMIN_ROLES_UI_URL ?? "http://localhost:3017";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const superId = "11111111-1111-4111-8111-111111111111",
  targetId = "22222222-2222-4222-8222-222222222222",
  otherId = "33333333-3333-4333-8333-333333333333",
  timestamp = "2026-01-01T00:00:00.000Z",
  password = "Synthetic-role-password-18b1";
const superAdmin = {
  id: superId,
  firstName: "Синтетичний",
  lastName: "Адміністратор",
  email: "synthetic-super@example.invalid",
  role: "SUPER_ADMIN",
  accountType: "SELLER",
  verificationStatus: "VERIFIED",
  avatarUrl: null,
  createdAt: timestamp,
};
async function fixture(width, actor = superAdmin, held = false) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  let active = actor,
    mode = "ok",
    target = {
      ...superAdmin,
      id: targetId,
      email: "synthetic-user@example.invalid",
      role: "USER",
    },
    revision = timestamp,
    entries = [],
    calls = [],
    historyCalls = 0,
    writes = [],
    releaseRestore,
    releaseWrite,
    started;
  const restore = new Promise((resolve) => {
    releaseRestore = resolve;
  });
  if (!held) releaseRestore();
  let writeGate = Promise.resolve(),
    writeStarted = Promise.resolve();
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = request.method();
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,PATCH,POST,OPTIONS",
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
      calls.push(path);
      if (mode === "revoked") {
        active = null;
        return reply(null, 401);
      }
      if (!active) return reply(null, 401);
      if (!["ADMIN", "SUPER_ADMIN"].includes(active.role))
        return reply(null, 403);
      if (path.endsWith("/role") || path.endsWith("/role-history")) {
        if (active.role !== "SUPER_ADMIN" || mode === "denied")
          return reply(null, 403);
        const id = path.split("/")[3];
        if (path.endsWith("/role-history")) {
          historyCalls++;
          return reply({
            currentRole: id === targetId ? target.role : "SUPER_ADMIN",
            updatedAt: revision,
            entries: id === targetId ? entries : [],
          });
        }
        const input = request.postDataJSON();
        writes.push(input);
        assert.equal(request.headers()["x-csrf-token"], "synthetic-csrf");
        assert(!["SUPER_ADMIN", "BREEDER"].includes(input.role));
        const authorizedActor = active;
        started?.();
        await writeGate;
        if (input.currentPassword !== password) return reply(null, 400);
        if (mode === "conflict") return reply(null, 409);
        if (mode === "limited") return reply(null, 429);
        if (mode === "failed") return reply(null, 503);
        assert.equal(input.expectedUpdatedAt, revision);
        assert.equal(input.expectedRole, target.role);
        const changed = input.role !== target.role;
        if (changed) {
          entries.unshift({
            operationId: input.operationId,
            actorId: authorizedActor.id,
            targetUserId: targetId,
            previousRole: target.role,
            newRole: input.role,
            origin: "AUTHENTICATED_ADMIN",
            createdAt: timestamp,
          });
          target = { ...target, role: input.role };
          revision = new Date(Date.parse(revision) + 1).toISOString();
        }
        return reply({
          changed,
          role: target.role,
          updatedAt: revision,
          operationId: input.operationId,
        });
      }
      if (path === "/admin/dashboard")
        return reply({
          asOf: timestamp,
          metrics: {
            users: 25,
            breederProfiles: 3,
            pets: 8,
            listings: 5,
            activeListings: 2,
            matingListings: 1,
            openReports: 0,
            newUsers7Days: 2,
          },
        });
      if (path === "/admin/users")
        return reply(
          { data: [target], meta: { page: 1, limit: 24, total: 1, pages: 1 } },
          200,
          true,
        );
      if (path.startsWith("/admin/users/")) {
        const row = path.endsWith(targetId)
          ? target
          : { ...superAdmin, id: path.split("/").at(-1) };
        return reply({
          ...row,
          counts: { pets: 0, listings: 0, matingListings: 0 },
          breederProfile: null,
          sellerPath: `/sellers/${row.id}`,
          breederPath: null,
        });
      }
      return reply(
        { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
        200,
        true,
      );
    }
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
    if (/hydration failed|hydrated but/i.test(message.text()))
      errors.push(message.text());
  });
  return {
    page,
    context,
    errors,
    calls,
    writes,
    history: () => historyCalls,
    releaseRestore,
    mode(value) {
      mode = value;
    },
    actor(value) {
      active = value;
    },
    hold() {
      writeGate = new Promise((resolve) => {
        releaseWrite = resolve;
      });
      writeStarted = new Promise((resolve) => {
        started = resolve;
      });
    },
    started: () => writeStarted,
    release() {
      releaseWrite?.();
      writeGate = Promise.resolve();
      started = undefined;
    },
  };
}
const editor = (page) =>
  page.getByRole("button", { name: "Змінити роль", exact: true });
const confirm = (page) =>
  page.getByRole("button", { name: "Підтвердити зміну ролі", exact: true });
async function layout(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
async function choose(page, label) {
  await page
    .getByRole("combobox", { name: "Нова технічна роль", exact: true })
    .click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
async function open(page) {
  await editor(page).click();
  await page.getByRole("dialog").waitFor();
  assert(
    await page
      .getByLabel("Ваш поточний пароль")
      .evaluate((el) => document.activeElement === el),
  );
}
async function submit(page, value = password) {
  await page.getByLabel("Ваш поточний пароль").fill(value);
  await confirm(page).click();
}
const results = [];
try {
  await mkdir("test-results/phase18b1", { recursive: true });
  for (const width of [375, 768, 1440]) {
    if (process.env.ADMIN_ROLE_LIFECYCLE_ONLY === "1") {
      const f = await fixture(width),
        { page } = f;
      page.setDefaultTimeout(30000);
      try {
        await page.goto(`${base}/admin/users/${targetId}`);
        await editor(page).waitFor();
        await page.evaluate(() => {
          globalThis.__roleCloseEvents = [];
          document.addEventListener(
            "close",
            (event) => {
              if (event.target instanceof HTMLDialogElement)
                globalThis.__roleCloseEvents.push({
                  event: "DIALOG_CLOSE",
                  open: event.target.open,
                  at: Math.round(performance.now()),
                });
            },
            true,
          );
        });
        await choose(page, "Модератор");
        await open(page);
        await confirm(page).click();
        await page
          .getByRole("alert")
          .filter({ hasText: "Введіть поточний пароль від 8 до 128 символів." })
          .waitFor();
        assert.equal(f.writes.length, 0);
        await page.getByLabel("Ваш поточний пароль").fill("short");
        await page.keyboard.press("Enter");
        assert.equal(f.writes.length, 0);
        await page.getByLabel("Ваш поточний пароль").fill(password);
        const focusTab = await f.context.newPage();
        await focusTab.goto("about:blank");
        await focusTab.bringToFront();
        await page.bringToFront();
        await page.waitForLoadState("networkidle");
        await focusTab.close();
        assert(await page.getByRole("dialog").isVisible());
        assert.equal(
          await page.getByLabel("Ваш поточний пароль").inputValue(),
          password,
        );
        await confirm(page).click();
        await page
          .getByText("Роль змінено. Попередні сесії користувача завершено.", {
            exact: true,
          })
          .waitFor();
        assert.equal(f.writes.length, 1);
        assert.equal(f.writes[0].role, "MODERATOR");
        assert.equal(f.writes[0].expectedUpdatedAt, timestamp);
        assert.equal(f.writes[0].expectedRole, "USER");
        assert.deepEqual(Object.keys(f.writes[0]).sort(), [
          "currentPassword",
          "expectedRole",
          "expectedUpdatedAt",
          "operationId",
          "role",
        ]);
        assert.match(f.writes[0].operationId, /^[0-9a-f-]{36}$/i);
        await page
          .getByText("Поточна роль: Модератор", { exact: true })
          .waitFor();
        assert(f.history() >= 2);
        await page
          .getByRole("listitem")
          .filter({ hasText: /Користувач.*Модератор/ })
          .waitFor();
        await open(page);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        assert(
          await editor(page).evaluate(
            (node) => document.activeElement === node,
          ),
        );
        await open(page);
        await page.getByLabel("Ваш поточний пароль").fill(password);
        await page.keyboard.press("Enter");
        await page
          .getByText("Роль уже має це значення. Сесії не змінено.", {
            exact: true,
          })
          .waitFor();
        assert.equal(f.writes.length, 2);
        for (const [label, value, previousRole] of [
          ["Адміністратор", "ADMIN", "MODERATOR"],
          ["Користувач", "USER", "ADMIN"],
        ]) {
          const before = f.writes.length;
          await choose(page, label);
          await open(page);
          await page.getByLabel("Ваш поточний пароль").fill(password);
          await page.keyboard.press("Enter");
          await page
            .getByText("Поточна роль: " + label, { exact: true })
            .waitFor();
          assert.equal(f.writes.length, before + 1);
          assert.equal(f.writes.at(-1).role, value);
          assert.equal(f.writes.at(-1).expectedRole, previousRole);
        }
        await layout(page);
        assert.deepEqual(f.errors, []);
        results.push({
          width,
          passed: true,
          coverage:
            "actual Next development Strict Mode modal mount/replay, explicit validation/click, exact server revision/DTO, USER/MODERATOR/ADMIN, one PATCH per confirmation, close/reopen, Enter/tab focus, success/history and no-op",
        });
      } catch (error) {
        const evidence = await page.evaluate(() => ({
          closeEvents: globalThis.__roleCloseEvents,
          dialogPresent: Boolean(document.querySelector("dialog")),
          dialogOpen: document.querySelector("dialog")?.open,
        }));
        console.log(
          JSON.stringify({
            lifecycleRegression: "failed",
            width,
            patches: f.writes.length,
            ...evidence,
          }),
        );
        throw error;
      } finally {
        await f.context.close();
      }
      continue;
    }
    for (const role of [null, "USER", "BREEDER", "MODERATOR"]) {
      const f = await fixture(width, role ? { ...superAdmin, role } : null);
      try {
        await f.page.goto(`${base}/admin/users/${targetId}`);
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
    const ordinary = await fixture(width, { ...superAdmin, role: "ADMIN" });
    try {
      await ordinary.page.goto(`${base}/admin/users/${targetId}`);
      await ordinary.page
        .getByText("synthetic-user@example.invalid", { exact: true })
        .waitFor();
      assert.equal(await editor(ordinary.page).count(), 0);
      assert.equal(ordinary.history(), 0);
      const status = await ordinary.page.evaluate(
        async ({ base, targetId }) =>
          (
            await fetch(
              `${base.replace(":3017", ":4000")}/api/v1/admin/users/${targetId}/role`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "ADMIN" }),
              },
            )
          ).status,
        { base, targetId },
      );
      assert.equal(status, 403);
      await layout(ordinary.page);
      assert.deepEqual(ordinary.errors, []);
    } finally {
      await ordinary.context.close();
    }
    const f = await fixture(width, superAdmin, true),
      { page } = f;
    try {
      await page.goto(`${base}/admin/users/${targetId}`);
      assert.equal(f.calls.length, 0);
      f.releaseRestore();
      await editor(page).waitFor();
      const combo = page.getByRole("combobox", {
        name: "Нова технічна роль",
        exact: true,
      });
      await combo.focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.getByRole("option").count(), 3);
      assert.equal(
        await page
          .getByRole("option", { name: "Суперадміністратор", exact: true })
          .count(),
        0,
      );
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await open(page);
      // Native close events are queued. Reopening before dispatch models the
      // Strict Mode effect cleanup/setup ordering even in a production build.
      await page.evaluate(async () => {
        const dialog = document.querySelector("dialog.admin-reason-dialog");
        dialog.close();
        dialog.showModal();
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      assert(await page.getByRole("dialog").isVisible());
      await layout(page);
      assert.equal(f.writes.length, 0);
      await submit(page, "wrong-password");
      await page
        .getByRole("alert")
        .filter({ hasText: "Перевірте поточний пароль" })
        .waitFor();
      assert.equal(
        await page.getByLabel("Ваш поточний пароль").inputValue(),
        "",
      );
      f.hold();
      await submit(page);
      await f.started();
      await page.keyboard.press("Enter");
      assert.equal(f.writes.length, 2);
      assert(
        await page
          .getByRole("button", { name: "Змінюємо…", exact: true })
          .isDisabled(),
      );
      f.release();
      await page
        .getByText("Роль змінено. Попередні сесії користувача завершено.", {
          exact: true,
        })
        .waitFor();
      await page
        .getByText("Поточна роль: Модератор", { exact: true })
        .waitFor();
      assert.equal(f.writes[1].expectedRole, "USER");
      assert.equal(f.writes[1].expectedUpdatedAt, timestamp);
      await open(page);
      await submit(page);
      await page
        .getByText("Роль уже має це значення. Сесії не змінено.", {
          exact: true,
        })
        .waitFor();
      await choose(page, "Адміністратор");
      f.mode("conflict");
      await open(page);
      await submit(page);
      await page
        .getByText(
          "Акаунт або роль змінилися. Оновіть дані та перевірте рішення.",
          { exact: true },
        )
        .waitFor();
      assert(await editor(page).isDisabled());
      f.mode("ok");
      await page
        .getByRole("button", { name: "Оновити роль перед новим рішенням" })
        .click();
      await editor(page).waitFor();
      f.mode("limited");
      await open(page);
      await submit(page);
      await page
        .getByRole("alert")
        .filter({ hasText: "Забагато підтверджень" })
        .waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert(
        await editor(page).evaluate((el) => document.activeElement === el),
      );
      f.mode("failed");
      await open(page);
      await submit(page);
      await page
        .getByRole("alert")
        .filter({ hasText: "Не вдалося змінити роль" })
        .waitFor();
      await page
        .getByRole("button", { name: "Скасувати", exact: true })
        .click();
      f.mode("ok");
      await layout(page);
      await page.screenshot({
        path: `test-results/phase18b1/editor-${width}.png`,
        fullPage: true,
      });
      await page.goto(`${base}/admin/users/${superId}`);
      await page
        .getByText(
          "Зміна власної ролі та повноважень суперадміністратора через цей редактор недоступна.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await editor(page).count(), 0);
      await page.goto(`${base}/admin/users/${otherId}`);
      await page
        .getByText(
          "Зміна власної ролі та повноважень суперадміністратора через цей редактор недоступна.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await editor(page).count(), 0);
      await page.goto(`${base}/admin`);
      await page.locator(".admin-metric").first().waitFor();
      assert.equal(await page.locator(".admin-metric").count(), 8);
      await page.goto(`${base}/admin/breeders`);
      await page
        .getByText("За цими умовами записів немає.", { exact: true })
        .waitFor();
      await page.goto(`${base}/admin/moderation`);
      await page
        .getByRole("heading", { name: /Модерація/ })
        .first()
        .waitFor();
      await page.goto(`${base}/admin/users/${targetId}`);
      await editor(page).waitFor();
      f.mode("denied");
      await page.reload();
      await page
        .getByRole("heading", { name: "Доступ до адміністрування недоступний" })
        .waitFor();
      assert.equal(await editor(page).count(), 0);
      f.mode("ok");
      await page
        .getByRole("button", { name: "Перевірити доступ", exact: true })
        .click();
      await editor(page).waitFor();
      f.mode("revoked");
      await page.reload();
      await page.waitForURL(/\/login/);
      assert.equal(await editor(page).count(), 0);
      f.actor(superAdmin);
      f.mode("ok");
      await page.goto(`${base}/admin/users/${targetId}`);
      await editor(page).waitFor();
      await open(page);
      f.hold();
      await submit(page);
      await f.started();
      const tab = await f.context.newPage();
      await tab.goto(`${base}/account`);
      await tab.locator(".verification-email").waitFor();
      f.actor({ ...superAdmin, role: "ADMIN" });
      await tab.evaluate(() => {
        const c = new BroadcastChannel("pet-platform-session");
        c.postMessage({ kind: "login", source: "synthetic-role-downgrade" });
        c.close();
      });
      await page
        .getByText("synthetic-user@example.invalid", { exact: true })
        .waitFor();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(await editor(page).count(), 0);
      f.release();
      await page
        .getByRole("heading", { name: "Обліковий запис", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Технічний доступ", exact: true })
          .count(),
        0,
      );
      await tab.reload();
      await tab.locator(".verification-email").waitFor();
      await tab
        .getByRole("button", { name: "Вийти з акаунта", exact: true })
        .click();
      await page.waitForURL(/\/login/);
      await tab.close();
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        passed: true,
        coverage:
          "SUPER_ADMIN inheritance; ADMIN readonly/no privileged fetch/direct mocked denial; explicit password dialog; wrong password; pending duplicate fence; success/no-op/409/429/error; protected self/holder; 403/revocation; late response during same-account demotion; cross-tab logout; keyboard/focus/Escape; overflow/hydration",
      });
    } finally {
      f.release();
      f.releaseRestore();
      await f.context.close();
    }
  }
  await writeFile(
    process.env.ADMIN_ROLE_LIFECYCLE_ONLY === "1"
      ? "test-results/phase18b1/lifecycle-results.json"
      : "test-results/phase18b1/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
