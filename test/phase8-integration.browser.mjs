import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { reviewsFixtures } from "./helpers/reviews-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  checks = [],
  errors = [];
let fixture, release;
const base = "http://localhost:3000";
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
page.on("pageerror", (e) => errors.push(e.message));
async function login(p, actor, target) {
  await p.goto(base + "/login?" + new URLSearchParams({ returnTo: target }));
  await p.waitForLoadState("networkidle");
  await p
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await p.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  const [response] = await Promise.all([
    p.waitForResponse(
      (r) => r.url().endsWith("/auth/login") && r.request().method() === "POST",
    ),
    p.getByRole("button", { name: "Увійти", exact: true }).click(),
  ]);
  assert.equal(response.status(), 200, "login response status");
  await p.waitForURL(base + target);
  await p.waitForLoadState("networkidle");
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await reviewsFixtures();
  const path = "/sellers/" + fixture.seller.user.id;
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Далі", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".review-list .review-card").length === 1,
  );
  await fixture.hideOldestApprovedReview();
  // Exercise normal focus refetch after the shared 30-second freshness window.
  await page.waitForTimeout(31000);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".review-list .review-card").length === 20,
  );
  await page
    .locator(".seller-reviews .page-pagination")
    .waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
  assert.match(await page.locator(".review-summary").innerText(), /20 відгук/);
  pass(
    "expired profile summary refetches; empty final review page clamps to current public page without reload",
  );
  const peer = await context.newPage();
  peer.on("pageerror", (e) => errors.push(e.message));
  await login(peer, fixture.full, "/account");
  let held;
  const ready = new Promise((r) => (held = r)),
    pattern = "**/api/v1/sellers/" + fixture.seller.user.id + "/reviews/me";
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    held();
    await new Promise((r) => (release = r));
    await route.fulfill({ response }).catch(() => {});
  });
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await ready;
  await peer
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await peer.waitForURL("**/login");
  await page
    .getByRole("link", { name: "Увійдіть, щоб залишити відгук", exact: true })
    .waitFor();
  release();
  release = undefined;
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator(".own-review-card").count(), 0);
  assert.doesNotMatch(
    await page.locator(".seller-reviews").innerText(),
    /PRIVATE-PENDING-REVIEW/,
  );
  pass(
    "cross-tab logout cancels delayed own-review response and leaves public reviews available",
  );
  await page.unroute(pattern);
  await login(page, fixture.fallback, path);
  await page.locator(".review-form").waitFor();
  assert.equal(await page.locator(".own-review-card").count(), 0);
  assert.doesNotMatch(
    await page.locator("main").innerText(),
    /PRIVATE-PENDING-REVIEW/,
  );
  pass(
    "different-user login has fresh eligibility and no previous-user private review state",
  );
  let posts = 0,
    postStarted;
  const postReady = new Promise((resolve) => (postStarted = resolve));
  const postPattern =
    "**/api/v1/sellers/" + fixture.seller.user.id + "/reviews";
  await page.route(postPattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    postStarted();
    await new Promise((resolve) => (release = resolve));
    await route
      .fulfill({ status: 401, json: { message: "Expired old session" } })
      .catch(() => {});
  });
  await page.getByRole("radio", { name: "5 з 5", exact: true }).check();
  await page
    .getByLabel("Коментар", { exact: true })
    .fill("Відгук попереднього користувача для перевірки гонки.");
  await page
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  await postReady;
  await login(peer, fixture.full, "/account");
  await page.locator(".own-review-card").waitFor();
  release();
  release = undefined;
  await page.waitForLoadState("networkidle");
  assert.equal(posts, 1);
  assert.match(
    await page.locator(".own-review-card").innerText(),
    /PRIVATE-PENDING-REVIEW/,
  );
  assert.doesNotMatch(
    await page.locator(".own-review-card").innerText(),
    /Відгук попереднього користувача/,
  );
  pass("late review POST 401 cannot replay under the newer cross-tab login");
  assert.deepEqual(errors, []);
  pass("zero runtime/hydration errors");
  await writeFile(
    "test-results/phase8e-integration-browser.json",
    JSON.stringify({ checks }, null, 2),
  );
} finally {
  release?.();
  await context.close();
  await browser.close();
  if (fixture) await fixture.cleanup();
}
