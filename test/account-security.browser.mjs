import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { load } from "./helpers/load-frontend.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const { legalContentIdentity } = await load(
  "src/features/legal/content/content-integrity.ts",
);
const base = process.env.ACCOUNT_SECURITY_UI_URL ?? "http://localhost:3017";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const results = [];
const initialPassword = "Synthetic-password-42",
  recovered = "Synthetic-recovered-42";
const verifyToken = "v".repeat(43),
  resetToken = "r".repeat(43),
  changeToken = "c".repeat(43);
async function check(page, name, width) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    name,
  );
  await page.screenshot({
    path: `test-results/phase17e/${name}-${width}.png`,
    fullPage: true,
  });
}
async function login(page, email, password) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Електронна адреса", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
}
async function resetForm(page, password) {
  await page.locator('input[name="newPassword"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}
try {
  await mkdir("test-results/phase17e", { recursive: true });
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const owner = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "audit@example.invalid",
      firstName: "Тест",
      lastName: "Безпеки",
      accountType: "SELLER",
      role: "USER",
      verificationStatus: "UNVERIFIED",
      avatarUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
    };
    let active = false,
      password = initialPassword,
      usedReset = false,
      pending = null;
    let verifyPosts = 0,
      resetPosts = 0,
      changePosts = 0,
      holdLogin,
      loginStarted;
    const errors = [];
    await context.route("**/api/v1/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname.replace("/api/v1", "");
      const headers = {
        "Access-Control-Allow-Origin": new URL(base).origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers":
          "content-type,authorization,x-csrf-token",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Cache-Control": "no-store",
      };
      const reply = (data, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: status === 204 ? "" : JSON.stringify({ data }),
        });
      const auth = () => ({
        user: { ...owner },
        accessToken: "synthetic-access",
        expiresIn: 900,
      });
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (path === "/auth/csrf") return reply({ csrfToken: "synthetic-csrf" });
      if (path === "/legal/current")
        return reply({
          acceptanceRequired: false,
          terms: { ...legalContentIdentity.terms, effectiveAt: null },
          privacy: { ...legalContentIdentity.privacy, effectiveAt: null },
        });
      if (req.method() === "POST")
        assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
      if (path === "/auth/register") {
        const body = req.postDataJSON();
        assert.equal(body.legalAcceptance, undefined);
        assert.equal(body.email, owner.email);
        active = true;
        return reply(auth(), 201);
      }
      if (path === "/auth/login") {
        const body = req.postDataJSON();
        if (body.email !== owner.email || body.password !== password)
          return reply(null, 401);
        if (holdLogin) {
          loginStarted();
          await holdLogin;
        }
        active = true;
        return reply(auth());
      }
      if (path === "/auth/refresh")
        return active ? reply(auth()) : reply(null, 401);
      if (path === "/auth/me")
        return active ? reply({ ...owner }) : reply(null, 401);
      if (path === "/auth/logout") {
        active = false;
        return reply(null, 204);
      }
      if (path === "/auth/email-verification/resend")
        return reply({ status: "accepted" }, 202);
      if (path === "/auth/email-verification/confirm") {
        assert.equal(req.postDataJSON().token, verifyToken);
        verifyPosts++;
        owner.verificationStatus = "VERIFIED";
        return reply({ verificationStatus: "VERIFIED" });
      }
      if (path === "/auth/password-reset/request")
        return reply({ status: "accepted" }, 202);
      if (path === "/auth/password-reset/confirm") {
        resetPosts++;
        const body = req.postDataJSON();
        assert.equal(body.token, resetToken);
        if (usedReset) return reply(null, 400);
        usedReset = true;
        password = body.newPassword;
        active = false;
        return reply({ status: "reset" });
      }
      if (path === "/auth/email-change/pending") return reply({ pending });
      if (path === "/auth/email-change/request") {
        const body = req.postDataJSON();
        assert.equal(body.currentPassword, password);
        pending = {
          newEmail: body.newEmail,
          expiresAt: new Date(Date.now() + 1800000).toISOString(),
        };
        return reply({ status: "accepted" }, 202);
      }
      if (path === "/auth/email-change/confirm") {
        assert.equal(req.postDataJSON().token, changeToken);
        changePosts++;
        owner.email = pending.newEmail;
        pending = null;
        active = false;
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
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${base}/register`);
      await page.getByLabel("Ім’я", { exact: true }).fill(owner.firstName);
      await page.getByLabel("Прізвище", { exact: true }).fill(owner.lastName);
      await page
        .getByLabel("Електронна адреса", { exact: true })
        .fill(owner.email);
      await page.getByLabel("Пароль", { exact: true }).fill(password);
      await page
        .getByLabel("Підтвердження пароля", { exact: true })
        .fill(password);
      await check(page, "register", width);
      await page
        .getByRole("button", { name: "Створити акаунт", exact: true })
        .click();
      await page.locator(".verification-email").waitFor();
      assert.equal(owner.verificationStatus, "UNVERIFIED");
      const response = await page.goto(
        `${base}/verify-email?token=${verifyToken}`,
      );
      const verify = page.getByRole("button", {
        name: "Підтвердити пошту",
        exact: true,
      });
      await verify.waitFor();
      assert.equal(verifyPosts, 0);
      assert.equal(new URL(page.url()).search, "");
      assert.equal(response.headers()["referrer-policy"], "no-referrer");
      await verify.click();
      await page
        .getByText("Електронну пошту підтверджено!", { exact: true })
        .waitFor();
      await page.goto(`${base}/account`);
      await page.locator(".verification-email").waitFor();
      const tab = await context.newPage();
      await tab.goto(`${base}/account`);
      await tab.locator(".verification-email").waitFor();
      await page
        .getByRole("button", { name: "Вийти з акаунта", exact: true })
        .click();
      await tab.waitForURL(/\/login/);
      assert.equal(await tab.locator(".verification-email").count(), 0);
      await tab.close();
      await login(page, owner.email, password);
      await page.locator(".verification-email").waitFor();
      await page.goto(`${base}/forgot-password`);
      await page
        .getByLabel("Електронна адреса", { exact: true })
        .fill(owner.email);
      await page.locator('form button[type="submit"]').click();
      await page.getByRole("status").waitFor();
      await check(page, "forgot", width);
      await page.goto(`${base}/reset-password?token=${resetToken}`);
      await page.locator('input[name="newPassword"]').waitFor();
      assert.equal(resetPosts, 0);
      await check(page, "reset", width);
      await resetForm(page, recovered);
      await page.getByText(/Пароль змінено/).waitFor();
      await page.goto(`${base}/reset-password?token=${resetToken}`);
      await resetForm(page, "Another-synthetic-password-42");
      await page
        .getByRole("alert")
        .filter({ hasText: "Посилання недійсне" })
        .waitFor();
      assert.equal(password, recovered);
      await login(page, owner.email, recovered);
      await page.locator(".verification-email").waitFor();
      await page
        .getByRole("button", { name: "Змінити електронну пошту", exact: true })
        .click();
      await page
        .getByLabel("Нова електронна адреса", { exact: true })
        .fill("changed@example.invalid");
      await page.getByLabel("Поточний пароль", { exact: true }).fill(recovered);
      await check(page, "change-form", width);
      await page
        .getByRole("button", { name: "Надіслати підтвердження", exact: true })
        .click();
      await page.getByText(/Очікує підтвердження:/).waitFor();
      assert.equal(owner.email, "audit@example.invalid");
      await page.goto(`${base}/confirm-email-change?token=${changeToken}`);
      const change = page.getByRole("button", {
        name: "Підтвердити зміну пошти",
        exact: true,
      });
      await change.waitFor();
      assert.equal(changePosts, 0);
      await page.keyboard.press("Tab");
      await change.focus();
      assert(
        await change.evaluate(
          (n) =>
            n === document.activeElement &&
            getComputedStyle(n).outlineStyle !== "none",
        ),
      );
      await check(page, "change-confirm", width);
      await change.click();
      await page
        .getByText(/Електронну адресу змінено й підтверджено/)
        .waitFor();
      await login(page, "audit@example.invalid", recovered);
      await page
        .getByRole("alert")
        .filter({ hasText: "Невірна електронна адреса або пароль" })
        .waitFor();
      await check(page, "login-error", width);
      await login(page, owner.email, recovered);
      await page.locator(".verification-email").waitFor();
      await page
        .getByRole("button", { name: "Вийти з акаунта", exact: true })
        .click();
      await page.waitForURL(/\/login/);
      let release;
      holdLogin = new Promise((resolve) => {
        release = resolve;
      });
      const started = new Promise((resolve) => {
        loginStarted = resolve;
      });
      await page
        .getByLabel("Електронна адреса", { exact: true })
        .fill(owner.email);
      await page.getByLabel("Пароль", { exact: true }).fill(recovered);
      await page.getByRole("button", { name: "Увійти", exact: true }).click();
      await started;
      await page.evaluate(() => {
        const c = new BroadcastChannel("pet-platform-session");
        c.postMessage({ kind: "logout", source: "synthetic-other-tab" });
        c.close();
      });
      await page.waitForTimeout(100);
      release();
      await page.getByRole("alert").waitFor();
      assert.equal(new URL(page.url()).pathname, "/login");
      assert.equal(await page.locator(".verification-email").count(), 0);
      assert.equal(
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
      assert.deepEqual(errors, []);
      results.push({
        width,
        journeys:
          "registration/verification/login/logout/reset/used-reset/change/old-login/multitab/delayed-login/focus/overflow",
        passed: true,
      });
    } finally {
      await context.close();
    }
  }
  await writeFile(
    "test-results/phase17e/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
