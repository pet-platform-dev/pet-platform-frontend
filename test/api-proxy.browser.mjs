import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { once } from "node:events";
import { apiProxyAuthFixture } from "../../pet-platform-backend/test/helpers/api-proxy-auth-fixture.mjs";

// Reuse the installed Playwright runtime. Never download another browser/library.
const require = createRequire(import.meta.url);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? require.resolve("playwright")
);
let fixture = await apiProxyAuthFixture();
const origin = "http://127.0.0.1:3018";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3018",
  ],
  {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NEXT_PUBLIC_API_PROXY_ENABLED: "true",
      API_PROXY_BACKEND_ORIGIN: "http://127.0.0.1:4018",
      API_PROXY_FRONTEND_ORIGIN: origin,
    },
  },
);
// Drain server output without retaining request URLs, headers or credentials.
server.stdout.resume();
server.stderr.resume();
let browser;
try {
  for (let count = 0; ; count++) {
    try {
      await fetch(origin + "/login");
      break;
    } catch {
      if (count > 100 || server.exitCode !== null)
        throw Error("Proxy test server did not start");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [375, 768, 1440]) {
    if (width !== 375) {
      await fixture.close();
      fixture = await apiProxyAuthFixture();
    }
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const browserApiOrigins = new Set();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v1/"))
        browserApiOrigins.add(url.origin);
    });
    await page.goto(origin + "/account", { waitUntil: "networkidle" });
    await page.waitForURL(origin + "/login");
    const call = (path, body, headers = {}) =>
      page.evaluate(
        async ({ path, body, headers }) => {
          const response = await fetch("/api/v1" + path, {
            method: body === undefined ? "GET" : "POST",
            credentials: "include",
            cache: "no-store",
            headers: { "Content-Type": "application/json", ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          return {
            status: response.status,
            body: await response.json().catch(() => null),
          };
        },
        { path, body, headers },
      );
    const csrf = await call("/auth/csrf");
    assert.equal(csrf.status, 200);
    const headers = { "X-CSRF-Token": csrf.body.data.csrfToken };
    const cookies = await context.cookies();
    const cookie = cookies.find((row) => row.name === "__Host-pet_csrf");
    assert(
      cookie &&
        cookie.httpOnly &&
        cookie.secure &&
        cookie.sameSite === "Lax" &&
        cookie.domain === "127.0.0.1",
    );
    assert.equal((await call("/auth/register", {})).status, 403);
    assert.equal(
      (await call("/auth/register", {}, { "X-CSRF-Token": "x".repeat(43) }))
        .status,
      403,
    );
    assert.equal((await call("/auth/register", {}, headers)).status, 400);
    const input = {
      email: "proxy@example.invalid",
      password: "Synthetic-password-42",
      firstName: "Тест",
    };
    const registered = await call("/auth/register", input, headers);
    assert.equal(registered.status, 201);
    assert.equal(
      (
        await call("/auth/me", undefined, {
          Authorization: "Bearer " + registered.body.data.accessToken,
        })
      ).status,
      200,
    );
    const refreshed = await call("/auth/refresh", {}, headers);
    assert.equal(refreshed.status, 200);
    const restored = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/auth/refresh") &&
        response.status() === 200,
    );
    await page.reload({ waitUntil: "networkidle" });
    await restored;
    // The actual SessionProvider restores through the proxy after reload.
    await page.waitForFunction(
      () => !document.body.textContent.includes("Завантаження…"),
    );
    assert.equal((await call("/auth/refresh", {}, headers)).status, 200);
    assert.equal((await call("/auth/logout", {}, headers)).status, 204);
    assert.equal((await call("/auth/refresh", {}, headers)).status, 401);
    assert.equal(
      (
        await call(
          "/auth/login",
          { email: input.email, password: "Wrong-password-42" },
          headers,
        )
      ).status,
      401,
    );
    const logged = await call(
      "/auth/login",
      { email: input.email, password: input.password },
      headers,
    );
    assert.equal(logged.status, 200);
    assert.equal(
      (
        await call(
          "/auth/email-verification/confirm",
          { token: "v".repeat(43) },
          headers,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/auth/email-verification/resend",
          {},
          {
            ...headers,
            Authorization: "Bearer " + logged.body.data.accessToken,
          },
        )
      ).status,
      202,
    );
    assert.equal(
      (
        await call(
          "/auth/password-reset/request",
          { email: input.email },
          headers,
        )
      ).status,
      202,
    );
    assert.equal(
      (
        await call(
          "/auth/password-reset/confirm",
          { token: "r".repeat(43), newPassword: "Synthetic-next-password-42" },
          headers,
        )
      ).status,
      200,
    );
    assert.equal((await call("/auth/refresh", {}, headers)).status, 401);
    const relogged = await call(
      "/auth/login",
      { email: input.email, password: "Synthetic-next-password-42" },
      headers,
    );
    assert.equal(relogged.status, 200);
    fixture.expire();
    assert.equal(
      (
        await call("/auth/me", undefined, {
          Authorization: "Bearer " + relogged.body.data.accessToken,
        })
      ).status,
      401,
    );
    assert.equal((await call("/auth/refresh", {}, headers)).status, 401);
    assert.equal((await call("/proxy-test/multiple-cookies")).status, 200);
    const names = (await context.cookies()).map((row) => row.name);
    assert(names.includes("synthetic_one") && names.includes("synthetic_two"));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await context.clearCookies();
    assert.equal((await call("/auth/login", input, headers)).status, 403);
    // Duplicate CSRF cookies must reach the real guard intact and be rejected.
    const duplicate = await fetch(origin + "/api/v1/auth/login", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: `__Host-pet_csrf=${"a".repeat(43)}; __Host-pet_csrf=${"a".repeat(43)}`,
        "X-CSRF-Token": "a".repeat(43),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    assert.equal(duplicate.status, 403);
    assert.equal(
      (
        await fetch(origin + "/api/v1/auth/login", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    // Exercise the unmodified login UI and the actual client module, not just fetch.
    await page.goto(origin + "/login", { waitUntil: "networkidle" });
    await page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(input.email);
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("Synthetic-next-password-42");
    const uiLogin = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/auth/login") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    assert.equal((await uiLogin).status(), 200);
    await page.waitForURL(origin + "/account");
    fixture.expire();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForURL(origin + "/login");
    assert.deepEqual([...browserApiOrigins], [origin]);
    console.log(
      `PASS Chrome ${width}: CSRF/cookies/register/login/logout/refresh/restoration/verification/recovery/expiry/rejections/multiple cookies/no overflow`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
  if (server.exitCode === null) await once(server, "exit");
  await fixture.close();
}
