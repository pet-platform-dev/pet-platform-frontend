import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { load } from "./helpers/load-frontend.mjs";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.EMAIL_VERIFICATION_UI_URL ?? "http://localhost:3017";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Local frontend only",
);
const { legalContentIdentity } = await load(
  "src/features/legal/content/content-integrity.ts",
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "msedge",
});
const results = [];
const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "phase17b@example.invalid",
  firstName: "Тест",
  lastName: "Пошти",
  avatarUrl: null,
  accountType: "SELLER",
  role: "USER",
  verificationStatus: "UNVERIFIED",
  createdAt: "2026-01-01T00:00:00Z",
};
async function fixture(width, loggedIn = false, holdRestoration = false) {
  let releaseRestoration;
  const restoration = new Promise((resolve) => {
    releaseRestoration = resolve;
  });
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  let active = loggedIn ? { ...owner } : null,
    confirmCount = 0,
    resendCount = 0,
    temporaryCount = 0,
    mode = "accepted",
    meCount = 0;
  const errors = [];
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", "");
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Expose-Headers": "Retry-After",
      "Cache-Control": "no-store",
    };
    const reply = (data, status = 200, extra = {}) =>
      route.fulfill({
        status,
        headers: { ...headers, ...extra },
        contentType: "application/json",
        body: JSON.stringify({ data }),
      });
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (path === "/auth/csrf") return reply({ csrfToken: "synthetic-csrf" });
    if (path === "/legal/current")
      return reply({
        acceptanceRequired: false,
        terms: { ...legalContentIdentity.terms, effectiveAt: null },
        privacy: { ...legalContentIdentity.privacy, effectiveAt: null },
      });
    if (path === "/auth/register" || path === "/auth/login") {
      active = { ...owner };
      return reply(
        { user: active, accessToken: "synthetic-access", expiresIn: 900 },
        path.endsWith("register") ? 201 : 200,
      );
    }
    if (path === "/auth/refresh") {
      if (holdRestoration) await restoration;
      return active
        ? reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          })
        : reply(null, 401);
    }
    if (path === "/auth/me") {
      meCount++;
      return active ? reply(active) : reply(null, 401);
    }
    if (path === "/auth/email-verification/confirm") {
      confirmCount++;
      assert.equal(request.method(), "POST");
      assert.equal(request.headers()["x-csrf-token"], "synthetic-csrf");
      assert.equal(request.headers().authorization, undefined);
      assert.equal(
        request.headers().referer,
        undefined,
        "Credential page must send no Referer",
      );
      const input = request.postDataJSON();
      assert.deepEqual(Object.keys(input), ["token"]);
      if (input.token === "b".repeat(43)) return reply(null, 400);
      if (input.token === "c".repeat(43) && temporaryCount++ === 0)
        return reply(null, 503);
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (active?.id === owner.id)
        active = { ...active, verificationStatus: "VERIFIED" };
      return reply({ verificationStatus: "VERIFIED" });
    }
    if (path === "/auth/email-verification/resend") {
      resendCount++;
      assert(active);
      assert.deepEqual(request.postDataJSON(), {});
      assert.equal(request.headers()["x-csrf-token"], "synthetic-csrf");
      assert.equal(request.headers().authorization, "Bearer synthetic-access");
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (mode === "limited") return reply(null, 429);
      if (mode === "retry-after")
        return reply(null, 429, { "Retry-After": "3" });
      if (mode === "failure") return reply(null, 503);
      if (mode === "already_verified") {
        active = { ...active, verificationStatus: "VERIFIED" };
        return reply({ status: mode }, 202);
      }
      return reply({ status: "accepted" }, 202);
    }
    if (path.endsWith("unread-count") || path.endsWith("unread"))
      return reply({ count: 0 });
    return reply([]);
  });
  // Realtime is unrelated and stays wholly synthetic in this focused browser run.
  await context.route("**/socket.io/**", (route) =>
    route.fulfill({
      status: 200,
      body: '0{"sid":"fixture","upgrades":[],"pingInterval":25000,"pingTimeout":20000}',
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration failed|hydrated but|same key/i.test(message.text()))
      errors.push(message.text());
  });
  return {
    context,
    page,
    errors,
    releaseRestoration,
    counts: () => ({ confirmCount, resendCount, meCount }),
    setMode: (value) => {
      mode = value;
    },
    setActive: (value) => {
      active = value;
    },
  };
}
async function noOverflow(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
async function keyboardFocus(button) {
  await button.page().keyboard.press("Tab");
  await button.focus();
  assert(await button.evaluate((node) => node === document.activeElement));
  const focus = await button.evaluate((node) => ({
    outline: getComputedStyle(node).outlineStyle,
    shadow: getComputedStyle(node).boxShadow,
  }));
  assert(
    focus.outline !== "none" || focus.shadow !== "none",
    "Visible focus expected",
  );
  assert(
    await button.evaluate((node) => node.getBoundingClientRect().height >= 44),
  );
}
async function settled(page) {
  await page.locator("main").waitFor();
  await page.waitForTimeout(160);
}
try {
  await mkdir("test-results/phase17b", { recursive: true });
  for (const width of [375, 768, 1440]) {
    const f = await fixture(width, true, true);
    try {
      await f.page.goto(`${base}/verify-email?token=${"a".repeat(43)}`);
      const confirm = f.page.getByRole("button", {
        name: "Підтвердити пошту",
        exact: true,
      });
      await confirm.waitFor();
      assert.equal(new URL(f.page.url()).search, "");
      assert.equal(f.counts().confirmCount, 0);
      const restored = f.page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/auth/me"),
      );
      f.releaseRestoration();
      await restored;
      await f.page.waitForTimeout(500);
      assert(
        await confirm.isVisible(),
        "restoring auth after URL cleanup must preserve the route controller",
      );
      await noOverflow(f.page);
      await keyboardFocus(confirm);
      await confirm.click();
      await f.page
        .getByText("Електронну пошту підтверджено!", { exact: true })
        .waitFor();
      assert.equal(f.counts().confirmCount, 1);
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        delayedRestoration:
          "confirmation survives auth restoration after URL cleanup",
        passed: true,
      });
    } finally {
      f.releaseRestoration();
      await f.context.close();
    }
  }
  for (const width of [375, 768, 1440]) {
    const f = await fixture(width);
    const { page } = f;
    try {
      let response = await page.goto(
        `${base}/verify-email?token=${"a".repeat(43)}`,
      );
      await settled(page);
      const confirm = page.getByRole("button", {
        name: "Підтвердити пошту",
        exact: true,
      });
      await confirm.waitFor();
      assert.equal(new URL(page.url()).search, "");
      await page.waitForTimeout(500);
      assert(
        await confirm.isVisible(),
        "URL cleanup must not discard the active confirmation token",
      );
      assert.equal(f.counts().confirmCount, 0);
      assert.equal(response.headers()["referrer-policy"], "no-referrer");
      assert.match(response.headers()["cache-control"], /no-store/);
      assert.match(response.headers()["x-robots-tag"], /noindex/);
      assert.equal(
        await page.locator('meta[name="referrer"]').getAttribute("content"),
        "no-referrer",
      );
      await noOverflow(page);
      await keyboardFocus(confirm);
      await page.screenshot({
        path: `test-results/phase17b/ready-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Enter");
      await page
        .getByText("Електронну пошту підтверджено!", { exact: true })
        .waitFor();
      assert.equal(f.counts().confirmCount, 1);
      await noOverflow(page);
      assert.equal(
        await page.evaluate(
          () =>
            Object.keys(localStorage).length +
            Object.keys(sessionStorage).length,
        ),
        0,
      );
      await page.screenshot({
        path: `test-results/phase17b/success-${width}.png`,
        fullPage: true,
      });
      await page.reload();
      await page
        .getByText(/Відкрийте посилання з листа для підтвердження/)
        .waitFor();
      assert.equal(f.counts().confirmCount, 1);
      await page.goto(`${base}/verify-email?token=invalid`);
      await page.getByText(/Посилання має неправильний формат/).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Підтвердити пошту", exact: true })
          .count(),
        0,
      );
      await noOverflow(page);
      await page.goto(`${base}/verify-email?token=${"b".repeat(43)}`);
      await page
        .getByRole("button", { name: "Підтвердити пошту", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Посилання недійсне" })
        .waitFor();
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/phase17b/invalid-${width}.png`,
        fullPage: true,
      });
      await page.goto(`${base}/verify-email?token=${"c".repeat(43)}`);
      await page
        .getByRole("button", { name: "Підтвердити пошту", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Не вдалося перевірити" })
        .waitFor();
      await page
        .getByRole("button", { name: "Підтвердити пошту", exact: true })
        .click();
      await page
        .getByText("Електронну пошту підтверджено!", { exact: true })
        .waitFor();
      await page.goto(`${base}/register`);
      await page.getByLabel("Ім’я", { exact: true }).fill("Тест");
      await page.getByLabel("Прізвище", { exact: true }).fill("Пошти");
      await page
        .getByLabel("Електронна адреса", { exact: true })
        .fill(owner.email);
      await page
        .getByLabel("Пароль", { exact: true })
        .fill("Synthetic-password-42");
      await page
        .getByLabel("Підтвердження пароля", { exact: true })
        .fill("Synthetic-password-42");
      await page
        .getByRole("button", { name: "Створити акаунт", exact: true })
        .click();
      await page.waitForURL("**/account");
      const card = page.locator(".account-email-verification");
      await card
        .getByText("Електронну пошту не підтверджено", { exact: true })
        .waitFor();
      assert((await card.innerText()).includes(owner.email));
      assert(!(await card.innerText()).includes("Ми надіслали"));
      assert.equal(f.counts().resendCount, 0);
      await noOverflow(page);
      const resend = card.getByRole("button", {
        name: "Надіслати лист повторно",
      });
      await keyboardFocus(resend);
      await page.screenshot({
        path: `test-results/phase17b/account-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Enter");
      await card.getByText(/Запит на повторне надсилання прийнято/).waitFor();
      assert.equal(f.counts().resendCount, 1);
      assert(await resend.isDisabled());
      await noOverflow(page);
      await page.goto(`${base}/verify-email?token=${"a".repeat(43)}`);
      await page
        .getByRole("button", { name: "Підтвердити пошту", exact: true })
        .click();
      await page
        .getByText("Електронну пошту підтверджено!", { exact: true })
        .waitFor();
      await page.locator('.verification-links a[href="/account"]').click();
      await card
        .getByText("Електронну пошту підтверджено", { exact: true })
        .waitFor();
      assert.equal(
        await card
          .getByRole("button", { name: "Надіслати лист повторно" })
          .count(),
        0,
      );
      await noOverflow(page);
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        guest: "ready/missing/malformed/invalid/temporary/retry/success",
        registration: "truthful notice",
        resend: "accepted/cooldown",
        sameAccount: "server-refreshed",
        keyboard: "passed",
        overflow: false,
      });
    } finally {
      await f.context.close();
    }
  }
  for (const mode of [
    "limited",
    "retry-after",
    "failure",
    "already_verified",
  ]) {
    const f = await fixture(375, true);
    f.setMode(mode);
    try {
      await f.page.goto(`${base}/account`);
      const card = f.page.locator(".account-email-verification");
      await card
        .getByRole("button", { name: "Надіслати лист повторно" })
        .click();
      if (mode === "already_verified")
        await card
          .getByText("Електронну пошту підтверджено", { exact: true })
          .waitFor();
      else {
        await card.getByRole("alert").waitFor();
        const disabled = await card
          .getByRole("button", { name: "Надіслати лист повторно" })
          .isDisabled();
        assert.equal(disabled, mode === "retry-after");
      }
      await noOverflow(f.page);
      assert.deepEqual(f.errors, []);
      results.push({ resendMode: mode, passed: true });
    } finally {
      await f.context.close();
    }
  }
  const f = await fixture(768, true);
  f.setActive({
    ...owner,
    id: "22222222-2222-4222-8222-222222222222",
    email: "different@example.invalid",
  });
  try {
    await f.page.goto(`${base}/verify-email?token=${"a".repeat(43)}`);
    await f.page
      .getByRole("button", { name: "Підтвердити пошту", exact: true })
      .click();
    await f.page
      .getByText("Електронну пошту підтверджено!", { exact: true })
      .waitFor();
    await f.page.locator('.verification-links a[href="/account"]').click();
    const card = f.page.locator(".account-email-verification");
    await card
      .getByText("different@example.invalid", { exact: true })
      .waitFor();
    await card
      .getByText("Електронну пошту не підтверджено", { exact: true })
      .waitFor();
    assert.deepEqual(f.errors, []);
    results.push({
      differentAccount: "identity/status preserved",
      passed: true,
    });
  } finally {
    await f.context.close();
  }
  await writeFile(
    "test-results/phase17b/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
