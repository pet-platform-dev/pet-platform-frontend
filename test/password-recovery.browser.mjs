import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.PASSWORD_RECOVERY_UI_URL ?? "http://localhost:3017";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Local synthetic frontend only",
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const results = [],
  password = "Synthetic-password-42",
  valid = "a".repeat(43);
const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "synthetic@example.invalid",
  firstName: "Тест",
  lastName: "Відновлення",
  role: "USER",
  accountType: "SELLER",
  verificationStatus: "UNVERIFIED",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
};
async function fixture(width, authenticated = false, sameAccount = false) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  let active =
    authenticated && sameAccount
      ? { ...owner }
      : authenticated
        ? {
            ...owner,
            id: "22222222-2222-4222-8222-222222222222",
            email: "other@example.invalid",
          }
        : null;
  let restore;
  const restored = new Promise((resolve) => {
    restore = resolve;
  });
  let requested = 0,
    confirmed = 0,
    failures = 0,
    requestFailure = false;
  const errors = [];
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Expose-Headers": "Retry-After",
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
      if (authenticated) await restored;
      return active
        ? reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          })
        : reply(null, 401);
    }
    if (path === "/auth/me") return active ? reply(active) : reply(null, 401);
    if (path === "/auth/password-reset/request") {
      requested++;
      assert.equal(req.method(), "POST");
      assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
      assert.equal(req.headers().authorization, undefined);
      assert.deepEqual(Object.keys(req.postDataJSON()), ["email"]);
      return requestFailure
        ? reply(null, 503)
        : reply({ status: "accepted" }, 202);
    }
    if (path === "/auth/password-reset/confirm") {
      confirmed++;
      const body = req.postDataJSON();
      assert.deepEqual(Object.keys(body).sort(), ["newPassword", "token"]);
      assert.equal(body.newPassword, password);
      assert.equal(req.method(), "POST");
      assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
      assert.equal(req.headers().authorization, undefined);
      assert.equal(req.headers().referer, undefined);
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (body.token === "b".repeat(43)) return reply(null, 400);
      if (body.token === "c".repeat(43) && failures++ === 0)
        return reply(null, 503);
      assert([valid, "c".repeat(43)].includes(body.token));
      if (active?.id === owner.id) active = null;
      return reply({ status: "reset" });
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
  page.on("console", (message) => {
    if (/hydration failed|hydrated but|same key/i.test(message.text()))
      errors.push(message.text());
  });
  return {
    page,
    context,
    errors,
    restore,
    counts: () => ({ requested, confirmed }),
    setRequestFailure: (value) => {
      requestFailure = value;
    },
    current: () => active,
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
  assert(await button.evaluate((node) => node === document.activeElement));
  assert(
    await button.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    }),
    "Visible keyboard focus",
  );
}
async function fill(page, confirm = password) {
  await page.locator('input[name="newPassword"]').fill(password);
  await page.getByLabel("Підтвердження пароля", { exact: true }).fill(confirm);
}
try {
  await mkdir("test-results/phase17c", { recursive: true });
  for (const width of [375, 768, 1440]) {
    const f = await fixture(width);
    const { page } = f;
    try {
      await page.goto(`${base}/login`);
      await page
        .getByRole("link", { name: "Забули пароль?", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Відновлення пароля", exact: true })
        .waitFor();
      const send = page.getByRole("button", {
        name: "Надіслати інструкції",
        exact: true,
      });
      await send.click();
      await page.locator("#recovery-email-error").waitFor();
      assert.equal(f.counts().requested, 0);
      await page
        .getByLabel("Електронна адреса", { exact: true })
        .fill(" UNKNOWN@Example.invalid ");
      f.setRequestFailure(true);
      await send.click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Не вдалося прийняти" })
        .waitFor();
      f.setRequestFailure(false);
      await send.click();
      await page
        .getByRole("status")
        .filter({ hasText: "Якщо акаунт із такою адресою існує" })
        .waitFor();
      await layout(page);
      const response = await page.goto(`${base}/reset-password?token=${valid}`);
      await page.locator('input[name="newPassword"]').waitFor();
      assert.equal(new URL(page.url()).search, "");
      assert.equal(f.counts().confirmed, 0);
      assert.equal(response.headers()["referrer-policy"], "no-referrer");
      assert.match(response.headers()["cache-control"], /no-store/);
      assert.match(response.headers()["x-robots-tag"], /noindex/);
      const submit = page.getByRole("button", {
        name: "Змінити пароль",
        exact: true,
      });
      await fill(page, "different");
      await submit.click();
      await page.getByText("Паролі не збігаються", { exact: true }).waitFor();
      assert.equal(f.counts().confirmed, 0);
      await fill(page);
      await layout(page);
      await focus(submit);
      await page.screenshot({
        path: `test-results/phase17c/reset-${width}.png`,
        fullPage: true,
      });
      await submit.evaluate((button) => {
        button.click();
        button.click();
      });
      await page
        .getByText("Пароль змінено. Увійдіть із новим паролем.", {
          exact: true,
        })
        .waitFor();
      assert.equal(f.counts().confirmed, 1);
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      assert.equal(
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
      await layout(page);
      await page
        .getByRole("link", { name: "Повернутися до входу", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Увійти до акаунта", exact: true })
        .waitFor();
      for (const [token, message] of [
        ["", "Відкрийте оригінальне"],
        ["bad", "Посилання має неправильний формат"],
        ["b".repeat(43), "Посилання недійсне"],
      ]) {
        await page.goto(
          `${base}/reset-password${token ? `?token=${token}` : ""}`,
        );
        if (token.length === 43) {
          await fill(page);
          await submit.click();
        }
        await page.getByText(new RegExp(message)).waitFor();
        assert.equal(await page.locator('input[type="password"]').count(), 0);
        await layout(page);
      }
      await page.goto(`${base}/reset-password?token=${"c".repeat(43)}`);
      await fill(page);
      await submit.click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Не вдалося змінити" })
        .waitFor();
      await submit.click();
      await page
        .getByText("Пароль змінено. Увійдіть із новим паролем.", {
          exact: true,
        })
        .waitFor();
      await page.reload();
      await page.getByText(/Відкрийте оригінальне/).waitFor();
      assert.deepEqual(f.errors, []);
      results.push({
        width,
        guest:
          "request validation/generic/error/retry; token cleanup; mismatch; single-flight reset; invalid/missing; retry; refresh; login navigation; focus; no overflow",
        passed: true,
      });
    } finally {
      f.restore();
      await f.context.close();
    }
    for (const sameAccount of [false, true]) {
      const signed = await fixture(width, true, sameAccount);
      try {
        await signed.page.goto(`${base}/reset-password?token=${valid}`);
        await signed.page.locator('input[name="newPassword"]').waitFor();
        assert.equal(new URL(signed.page.url()).search, "");
        const me = signed.page.waitForResponse((response) =>
          new URL(response.url()).pathname.endsWith("/auth/me"),
        );
        signed.restore();
        await me;
        await signed.page.waitForTimeout(300);
        assert(
          await signed.page.locator('input[name="newPassword"]').isVisible(),
          "Root auth restoration must not discard recovery token",
        );
        await fill(signed.page);
        await signed.page
          .getByRole("button", { name: "Змінити пароль", exact: true })
          .click();
        await signed.page
          .getByText("Пароль змінено. Увійдіть із новим паролем.", {
            exact: true,
          })
          .waitFor();
        assert.equal(
          signed.current()?.email ?? null,
          sameAccount ? null : "other@example.invalid",
        );
        assert.equal(signed.counts().confirmed, 1);
        assert.deepEqual(signed.errors, []);
        await layout(signed.page);
        results.push({
          width,
          auth: sameAccount
            ? "reset session expires without remounting the success view"
            : "delayed auth restoration preserves token and unrelated session identity",
          passed: true,
        });
      } finally {
        signed.restore();
        await signed.context.close();
      }
    }
  }
  await writeFile(
    "test-results/phase17c/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
