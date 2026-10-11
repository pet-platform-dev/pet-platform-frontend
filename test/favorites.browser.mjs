import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { favoritesFixtures } from "./helpers/favorites-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const contexts = [],
  checks = [],
  errors = [],
  requests = [];
let fixture;
const base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function tab(context) {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
async function go(page, path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
}
const card = (page, id) =>
  page.locator(`.listing-card:has(a[href^="/listings/${id}"])`);
const heart = (page, id) => card(page, id).getByRole("button");
async function pressed(button, value) {
  await button.waitFor();
  await button.page().waitForFunction(
    ({ id, value }) => {
      const el = document.querySelector(`[data-favorite-id="${id}"]`);
      return (
        el?.getAttribute("aria-pressed") === String(value) &&
        !el.disabled &&
        el.getAttribute("aria-disabled") !== "true"
      );
    },
    { id: await button.getAttribute("data-favorite-id"), value },
  );
}
async function geometry(page, name) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      name + width,
    );
    const boxes = await page.locator(".favorite-button").evaluateAll((nodes) =>
      nodes.map((n) => {
        const b = n.getBoundingClientRect();
        return {
          width: b.width,
          height: b.height,
          left: b.left,
          right: b.right,
        };
      }),
    );
    assert.ok(
      boxes.every(
        (b) =>
          b.width >= 44 &&
          b.height >= 44 &&
          b.left >= 0 &&
          b.right <= width + 1,
      ),
    );
    await page.screenshot({
      path: `test-results/phase8a-${name}-${width}.png`,
      fullPage: true,
    });
    pass(name + " " + width + ": no overflow; 44px hearts");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await favoritesFixtures();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await tab(context);
  const catalog =
    "/listings?" +
    new URLSearchParams({ q: fixture.marker, sort: "oldest", page: "1" });
  const [a, b, c] = fixture.listings.slice(0, 3).map((row) => row.id);
  page.on("request", (r) => {
    if (r.url().includes("/favorites"))
      requests.push({
        method: r.method(),
        path: new URL(r.url()).pathname,
        url: r.url(),
      });
  });
  await go(page, catalog);
  assert.equal(await page.locator(".listing-card").count(), 24);
  assert.equal(
    requests.filter((r) => r.path.endsWith("/favorites/state")).length,
    0,
  );
  await heart(page, a).click();
  await page.waitForURL("**/login?*");
  const target = new URL(page.url()).searchParams.get("returnTo");
  assert.equal(new URL(target, base).pathname, "/listings/" + a);
  pass(
    "E: anonymous heart opens login with safe detail and filtered return context; no private state request",
  );
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  const login = page.waitForResponse(
    (r) => r.url().endsWith("/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  const actor = (await (await login).json()).data;
  await page.waitForURL("**/listings/" + a + "*");
  await page.waitForLoadState("networkidle");
  pass("login returns to exact safe destination");
  requests.length = 0;
  await go(page, catalog);
  await pressed(heart(page, a), false);
  const initial = requests.filter((r) => r.path.endsWith("/favorites/state"));
  assert.equal(initial.length, 1);
  assert.equal(
    new URL(initial[0].url).searchParams.get("listingIds").split(",").length,
    24,
  );
  pass("24 catalog cards use exactly one bounded batch-state request; no N+1");
  await geometry(page, "catalog");
  let release;
  await page.route("**/api/v1/favorites/" + a, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.continue();
  });
  await heart(page, a).click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-favorite-id="${id}"]`)
        ?.getAttribute("aria-pressed") === "true",
    a,
  );
  assert.equal(await heart(page, a).isDisabled(), true);
  await heart(page, a).evaluate((el) => {
    el.click();
    el.click();
  });
  assert.equal(
    requests.filter((r) => r.method === "POST" && r.path.endsWith(a)).length,
    1,
  );
  release();
  await pressed(heart(page, a), true);
  await page.unroute("**/api/v1/favorites/" + a);
  pass("A: immediate optimistic heart; repeated toggles locked to one POST");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await pressed(heart(page, a), true);
  pass("A: favorite survives refresh");
  const href = await card(page, a).locator("a").getAttribute("href");
  await card(page, a).locator("a").click();
  await page.waitForURL(base + href);
  const detail = page.locator(".favorite-action-detail button");
  await pressed(detail, true);
  await geometry(page, "detail");
  await detail.click();
  await pressed(detail, false);
  await page.getByRole("link", { name: /До оголошень/ }).click();
  await pressed(heart(page, a), false);
  pass("B: detail state sync, remove and exact catalog back state");
  await page.waitForLoadState("networkidle");
  const oldUrl = page.url();
  await heart(page, a).focus();
  await page.waitForFunction(
    (id) => document.activeElement?.getAttribute("data-favorite-id") === id,
    a,
  );
  await page.keyboard.press("Enter");
  await pressed(heart(page, a), true);
  assert.equal(page.url(), oldUrl);
  assert.equal(
    await heart(page, a).evaluate((el) => getComputedStyle(el).outlineStyle),
    "solid",
  );
  pass("keyboard Enter/visible focus; heart never activates card link");
  await heart(page, b).click();
  await pressed(heart(page, b), true);
  await heart(page, c).click();
  await pressed(heart(page, c), true);
  await go(page, "/favorites");
  assert.equal(await page.locator(".listing-card").count(), 3);
  assert.match(
    await page.locator(".catalog-heading").innerText(),
    /Збережених оголошень: 3/,
  );
  await geometry(page, "favorites");
  await page.route("**/api/v1/favorites/" + b, async (route) => {
    if (route.request().method() === "DELETE")
      await route.fulfill({
        status: 500,
        json: { message: "PRIVATE-INTERNAL-ERROR" },
      });
    else await route.continue();
  });
  await heart(page, b).click();
  await card(page, b).waitFor();
  await page
    .getByRole("alert")
    .getByText("Не вдалося змінити обране. Спробуйте ще раз.")
    .waitFor();
  assert.equal(await page.locator(".listing-card").count(), 3);
  assert.ok(
    !(await page.locator("main").innerText()).includes(
      "PRIVATE-INTERNAL-ERROR",
    ),
  );
  await page.unroute("**/api/v1/favorites/" + b);
  pass("failed remove rolls back card/state and shows safe retryable error");
  await heart(page, b).click();
  await card(page, b).waitFor({ state: "detached" });
  assert.equal(await page.locator(".listing-card").count(), 2);
  pass("C: A/B/C → remove B immediately without refresh");
  const second = await tab(context);
  await go(second, catalog);
  await pressed(heart(second, a), true);
  await heart(second, a).click();
  await pressed(heart(second, a), false);
  await card(page, a).waitFor({ state: "detached" });
  pass("existing BroadcastChannel syncs favorite state/pages across tabs");
  await fixture.closeListing(c);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", {
      name: "В обраному поки нічого немає.",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".listing-card").count(), 0);
  assert.equal(await fixture.countFavorites(), 1);
  pass("D: SOLD absent; private internal favorite retained; empty CTA shown");
  const csrf = (
    await (
      await context.request.get(api + "/auth/csrf", {
        headers: { Origin: base },
      })
    ).json()
  ).data.csrfToken;
  for (const row of fixture.listings.filter((row) => row.id !== c)) {
    const result = await context.request.post(api + "/favorites/" + row.id, {
      headers: {
        Origin: base,
        Authorization: "Bearer " + actor.accessToken,
        "X-CSRF-Token": csrf,
      },
      data: {},
    });
    assert.equal(result.status(), 200);
  }
  await go(page, "/favorites");
  assert.equal(await page.locator(".listing-card").count(), 24);
  await page.getByRole("button", { name: "Далі", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".listing-card").length === 2,
  );
  pass("24 per page; next page contains remaining two eligible favorites");
  const lastIds = await page
    .locator(".favorite-button")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-favorite-id")));
  for (const id of lastIds) {
    await heart(page, id).click();
    await card(page, id).waitFor({ state: "detached" });
  }
  await page.waitForFunction(
    () => document.querySelectorAll(".listing-card").length === 24,
  );
  assert.ok(!(await page.locator("main").innerText()).includes("2 / 1"));
  pass("removing final page clamps pagination and refills previous page");
  await fixture.clearFavorites();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", {
      name: "В обраному поки нічого немає.",
      exact: true,
    })
    .waitFor();
  await go(page, catalog);
  await heart(page, a).click();
  await pressed(heart(page, a), true);
  await go(page, "/favorites");
  await heart(page, a).click();
  await page
    .getByRole("heading", {
      name: "В обраному поки нічого немає.",
      exact: true,
    })
    .waitFor();
  assert.match(
    await page.locator(".catalog-heading").innerText(),
    /Збережених оголошень: 0/,
  );
  assert.ok(
    await page
      .locator(".favorites-empty")
      .evaluate((el) => el.getBoundingClientRect().height < 280),
  );
  await geometry(page, "favorites-empty");
  pass(
    "final card removal shows compact empty state and count without refresh",
  );
  assert.ok(
    !(await page.locator("main").innerText()).includes(
      fixture.seller.user.email,
    ),
  );
  await go(page, "/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await go(page, "/favorites");
  await page.waitForURL("**/login?returnTo=%2Ffavorites");
  pass(
    "logout clears private favorites; protected favorites route preserves login return",
  );
  const anonymous = await browser.newContext();
  contexts.push(anonymous);
  const anon = await tab(anonymous);
  await go(anon, "/login?returnTo=https%3A%2F%2Fevil.invalid");
  await anon
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.fallback.user.email);
  await anon.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await anon.getByRole("button", { name: "Увійти", exact: true }).click();
  await anon.waitForURL("**/account");
  await go(anon, "/favorites");
  await anon
    .getByRole("heading", {
      name: "В обраному поки нічого немає.",
      exact: true,
    })
    .waitFor();
  pass(
    "foreign account sees only own empty list; malicious auth return falls back to account",
  );
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase8a-browser.json",
    JSON.stringify(
      { checks, catalogBatchRequests: initial.length, cards: 24 },
      null,
      2,
    ),
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  if (fixture) await fixture.cleanup();
}
