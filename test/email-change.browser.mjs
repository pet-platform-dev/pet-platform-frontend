import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.EMAIL_CHANGE_UI_URL ?? "http://localhost:3017";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
  }),
  results = [];
const password = "Synthetic-password-42",
  token = "a".repeat(43),
  target = "owner-new@example.invalid";
const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner-old@example.invalid",
  firstName: "Тест",
  lastName: "Пошти",
  accountType: "SELLER",
  role: "USER",
  verificationStatus: "VERIFIED",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
};
async function fixture(width, identity = "guest", hold = false) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  let active =
    identity === "guest"
      ? null
      : {
          ...owner,
          ...(identity === "other"
            ? {
                id: "22222222-2222-4222-8222-222222222222",
                email: "other@example.invalid",
              }
            : {}),
        };
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let pending = null,
    requests = 0,
    confirmations = 0,
    mode = "accepted",
    temporary = 0;
  const errors = [];
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
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ data }),
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (path === "/auth/csrf") return reply({ csrfToken: "synthetic-csrf" });
    if (path === "/auth/refresh") {
      if (hold) await gate;
      return active
        ? reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          })
        : reply(null, 401);
    }
    if (path === "/auth/me") return active ? reply(active) : reply(null, 401);
    if (path === "/auth/email-change/pending")
      return active ? reply({ pending }) : reply(null, 401);
    if (path === "/auth/email-change/request") {
      requests++;
      assert(active);
      assert.equal(req.headers().authorization, "Bearer synthetic-access");
      assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
      assert.deepEqual(Object.keys(req.postDataJSON()).sort(), [
        "currentPassword",
        "newEmail",
      ]);
      assert.equal(req.postDataJSON().newEmail, target);
      if (mode === "wrong") return reply(null, 400);
      if (mode === "limited") return reply(null, 429);
      if (mode === "failed") return reply(null, 503);
      assert.equal(req.postDataJSON().currentPassword, password);
      pending = {
        newEmail: target,
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
      };
      return reply({ status: "accepted" }, 202);
    }
    if (path === "/auth/email-change/confirm") {
      confirmations++;
      assert.equal(req.headers().authorization, undefined);
      assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
      assert.equal(req.headers().referer, undefined);
      const body = req.postDataJSON();
      assert.deepEqual(Object.keys(body), ["token"]);
      await new Promise((r) => setTimeout(r, 120));
      if (body.token === "b".repeat(43)) return reply(null, 400);
      if (body.token === "c".repeat(43) && temporary++ === 0)
        return reply(null, 503);
      assert([token, "c".repeat(43)].includes(body.token));
      if (active?.id === owner.id) active = null;
      pending = null;
      return reply({ status: "changed" });
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
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/hydration failed|hydrated but|same key/i.test(m.text()))
      errors.push(m.text());
  });
  return {
    page,
    context,
    release,
    errors,
    mode: (value) => {
      mode = value;
    },
    counts: () => ({ requests, confirmations }),
    active: () => active,
  };
}
async function layout(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal overflow",
  );
}
async function focus(button) {
  await button.page().keyboard.press("Tab");
  await button.focus();
  assert(await button.evaluate((n) => n === document.activeElement));
  assert(
    await button.evaluate((n) => {
      const s = getComputedStyle(n);
      return s.outlineStyle !== "none" || s.boxShadow !== "none";
    }),
  );
}
const button = (page) =>
  page.getByRole("button", { name: "Підтвердити зміну пошти", exact: true });
try {
  await mkdir("test-results/phase17d", { recursive: true });
  for (const width of [375, 768, 1440]) {
    const f = await fixture(width, "same");
    const { page } = f;
    try {
      await page.goto(`${base}/account`);
      await page
        .locator(".verification-email")
        .getByText(owner.email, { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Змінити електронну пошту", exact: true })
        .click();
      const send = page.getByRole("button", {
        name: "Надіслати підтвердження",
        exact: true,
      });
      await send.click();
      await page.locator("#change-newEmail-error").waitFor();
      assert.equal(f.counts().requests, 0);
      await page
        .getByLabel("Нова електронна адреса", { exact: true })
        .fill(owner.email);
      await page.getByLabel("Поточний пароль", { exact: true }).fill(password);
      await send.click();
      await page
        .getByText("Вкажіть іншу електронну адресу.", { exact: true })
        .waitFor();
      assert.equal(f.counts().requests, 0);
      await page
        .getByLabel("Нова електронна адреса", { exact: true })
        .fill(" OWNER-NEW@Example.invalid ");
      for (const [mode, copy] of [
        ["wrong", "Перевірте нову адресу"],
        ["limited", "Забагато запитів"],
        ["failed", "Не вдалося підтвердити надсилання"],
      ]) {
        f.mode(mode);
        await page
          .getByLabel("Поточний пароль", { exact: true })
          .fill(mode === "wrong" ? "incorrect-password" : password);
        await send.click();
        await page.getByRole("alert").filter({ hasText: copy }).waitFor();
        assert.equal(
          await page
            .getByLabel("Поточний пароль", { exact: true })
            .inputValue(),
          "",
        );
      }
      f.mode("accepted");
      await page.getByLabel("Поточний пароль", { exact: true }).fill(password);
      await focus(send);
      await page.keyboard.press("Enter");
      await page
        .getByText(/Ми підготували підтвердження нової адреси/)
        .waitFor();
      await page.getByText(/Очікує підтвердження: owner-new/).waitFor();
      assert.equal(
        await page.locator(".verification-email").innerText(),
        owner.email,
      );
      assert.equal(
        await page.locator('input[name="currentPassword"]').count(),
        0,
      );
      await layout(page);
      await page.screenshot({
        path: `test-results/phase17d/settings-${width}.png`,
        fullPage: true,
      });
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        settings:
          "validation/password/errors/cooldown/pending/no premature mutation/focus/overflow",
        passed: true,
      });
    } finally {
      f.release();
      await f.context.close();
    }
    for (const identity of ["guest", "same", "other"]) {
      const f = await fixture(width, identity, true);
      const { page } = f;
      try {
        const response = await page.goto(
          `${base}/confirm-email-change?token=${token}`,
        );
        await button(page).waitFor();
        assert.equal(new URL(page.url()).search, "");
        assert.equal(f.counts().confirmations, 0);
        assert.equal(response.headers()["referrer-policy"], "no-referrer");
        assert.match(response.headers()["cache-control"], /no-store/);
        assert.match(response.headers()["x-robots-tag"], /noindex/);
        if (identity !== "guest") {
          const restored = page.waitForResponse((r) =>
            new URL(r.url()).pathname.endsWith("/auth/me"),
          );
          f.release();
          await restored;
        } else f.release();
        await page.waitForTimeout(300);
        assert(await button(page).isVisible());
        await focus(button(page));
        await layout(page);
        await page.screenshot({
          path: `test-results/phase17d/confirm-${identity}-${width}.png`,
          fullPage: true,
        });
        await button(page).evaluate((n) => {
          n.click();
          n.click();
        });
        await page
          .getByText(/Електронну адресу змінено й підтверджено/)
          .waitFor();
        assert.equal(f.counts().confirmations, 1);
        assert.equal(
          f.active()?.email ?? null,
          identity === "other" ? "other@example.invalid" : null,
        );
        assert.equal(
          await page.evaluate(
            () => localStorage.length + sessionStorage.length,
          ),
          0,
        );
        await layout(page);
        if (identity === "guest") {
          await page.reload();
          await page.getByText(/Відкрийте оригінальне посилання/).waitFor();
          await page.goto(`${base}/confirm-email-change?token=bad`);
          await page.getByText(/Посилання має неправильний формат/).waitFor();
          assert.equal(await button(page).count(), 0);
          await page.goto(
            `${base}/confirm-email-change?token=${"b".repeat(43)}`,
          );
          await button(page).click();
          await page
            .getByRole("alert")
            .filter({ hasText: "Посилання недійсне" })
            .waitFor();
          assert.equal(await button(page).count(), 0);
          await page.goto(
            `${base}/confirm-email-change?token=${"c".repeat(43)}`,
          );
          await button(page).click();
          await page
            .getByRole("alert")
            .filter({ hasText: "Не вдалося підтвердити зміну" })
            .waitFor();
          await button(page).click();
          await page
            .getByText(/Електронну адресу змінено й підтверджено/)
            .waitFor();
          await page
            .getByRole("link", { name: "Перейти до входу", exact: true })
            .click();
          await page
            .getByRole("heading", { name: "Увійти до акаунта", exact: true })
            .waitFor();
        }
        assert.deepEqual(f.errors, []);
        results.push({
          width,
          identity,
          confirmation:
            "real Next hydration/token cleanup/auth restoration/explicit single POST/session policy/retry/login/focus/overflow",
          passed: true,
        });
      } finally {
        f.release();
        await f.context.close();
      }
    }
  }
  await writeFile(
    "test-results/phase17d/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
