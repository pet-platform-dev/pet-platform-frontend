import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.SERVICES_UI_URL ?? "http://localhost:3017";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Local synthetic browser test only",
);
const fixture = JSON.parse(
  await readFile(
    process.env.SERVICES_BROWSER_FIXTURE ??
      "../pet-platform-backend/.tmp/services-s7-browser-fixture.json",
    "utf8",
  ),
);
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(fixture.origin).hostname),
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
});
const checks = [],
  errors = [];
await mkdir("test-results", { recursive: true });
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.route("https://res.cloudinary.com/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J9sAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (/hydrated|hydration|Event handlers cannot/.test(m.text()))
        errors.push(m.text());
    });
    const go = async (path) => {
      const r = await page.goto(base + path);
      assert.notEqual(r.status(), 500, "Next SSR failed: " + path);
      await page.locator("main h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      return r;
    };
    const noOverflow = async () =>
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow ${width} ${page.url()}`,
      );
    const catalog =
      "/services?" +
      new URLSearchParams({ providerId: fixture.providerId, sort: "name_asc" });
    const response = await go(catalog);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("a.services-card").count(), 24);
    await noOverflow();
    const markup = await response.text();
    assert.ok(markup.includes("Послуга"));
    assert.ok(markup.includes("services-card"), "SSR contains public results");
    assert.match(
      await page.locator("meta[name=robots]").getAttribute("content"),
      /noindex/,
    );
    await page.screenshot({
      path: `test-results/services-s7-catalog-${width}.png`,
      fullPage: true,
      caret: "initial",
    });
    const trigger = page.getByRole("combobox", {
      name: "Вид тварини",
      exact: true,
    });
    await trigger.click();
    const gridTop = await page
      .locator(".services-grid")
      .evaluate((e) => e.getBoundingClientRect().top);
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator(".services-grid")
        .evaluate((e) => e.getBoundingClientRect().top),
      gridTop,
    );
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    assert.equal(
      await trigger.evaluate((e) => document.activeElement === e),
      true,
    );
    await page
      .getByRole("link", { name: "Наступна сторінка", exact: true })
      .click();
    await page.waitForURL(/page=2/);
    await page.waitForFunction(
      () => document.querySelectorAll("a.services-card").length === 2,
    );
    assert.ok(page.url().includes("sort=name_asc"));
    const returnUrl = new URL(page.url()).pathname + new URL(page.url()).search;
    await page.locator("a.services-card").first().click();
    await page.waitForURL(/\/services\/offers\//);
    await page.locator("main h1").waitFor();
    await page.reload();
    await page
      .getByRole("link", { name: "До послуг", exact: false })
      .first()
      .click();
    await page.waitForURL((u) => u.pathname + u.search === returnUrl);
    await noOverflow();
    await go(`/services/offers/${fixture.offerId}`);
    await noOverflow();
    await page
      .getByRole("button", { name: /Відкрити фото|Переглянути фото|Збільшити/ })
      .first()
      .click();
    await page.locator("dialog[open]").waitFor();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.screenshot({
      path: `test-results/services-s7-offer-${width}.png`,
      fullPage: true,
      caret: "initial",
    });
    const json = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    assert.equal(JSON.parse(json)["@type"], "Service");
    await go(`/service-providers/${fixture.providerId}`);
    await noOverflow();
    assert.ok(
      await page
        .getByRole("heading", { name: "Про спеціаліста", exact: true })
        .isVisible(),
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Фотогалерея", exact: true })
        .count(),
      1,
    );
    await page.screenshot({
      path: `test-results/services-s7-provider-${width}.png`,
      fullPage: true,
      caret: "initial",
    });
    await go(`/service-providers/${fixture.organizationId}`);
    assert.ok(
      await page
        .getByRole("heading", { name: "Про організацію", exact: true })
        .isVisible(),
    );
    await noOverflow();
    await go(
      "/service-providers?" +
        new URLSearchParams({ providerId: fixture.providerId }),
    );
    assert.equal(await page.locator("a.services-provider-card").count(), 1);
    await noOverflow();
    await go("/services/category/grooming");
    assert.ok(
      await page
        .getByRole("heading", { name: "Грумінг", exact: true })
        .isVisible(),
    );
    await noOverflow();
    await go(
      "/services?" + new URLSearchParams({ q: "Відсутня " + fixture.marker }),
    );
    assert.ok(
      await page
        .getByRole("heading", {
          name: "За цими фільтрами послуг поки немає",
          exact: true,
        })
        .isVisible(),
    );
    await noOverflow();
    const proxy = await page.evaluate(async () => {
      const r = await fetch("/api/v1/service-offers?species=dog&page=1", {
        credentials: "omit",
      });
      return { status: r.status, body: await r.json() };
    });
    assert.equal(proxy.status, 200);
    assert.ok(
      proxy.body.data.every((o) => o.species.some((s) => s.slug === "dog")),
    );
    checks.push({
      width,
      ssr: true,
      overflow: false,
      keyboard: true,
      overlayStationary: true,
      pagination: true,
      refreshReturn: true,
      gallery: true,
      organization: true,
      proxy: true,
    });
    if (width === 1440) {
      for (const slug of fixture.categorySlugs) {
        await go("/services/category/" + slug);
        await noOverflow();
        if (slug === "veterinary-care")
          assert.equal(await page.locator("a.services-card").count(), 0);
      }
      for (const path of [
        `/service-providers/${fixture.privateProviderId}`,
        `/services/offers/${fixture.privateOfferId}`,
        "/services/category/unknown",
      ]) {
        const r = await go(path);
        assert.equal(r.status(), 404, path);
        assert.match(
          await page
            .locator("meta[name=robots]")
            .last()
            .getAttribute("content"),
          /noindex/,
        );
      }
      await go(`/service-providers/${fixture.emptyProviderId}`);
      assert.ok(
        await page
          .getByText("Опублікованих послуг поки немає.", { exact: true })
          .isVisible(),
      );
      await go("/services");
      const field = page.getByRole("searchbox", { name: "Пошук" });
      await field.fill("Грумінг");
      await page
        .getByRole("button", { name: "Застосувати", exact: true })
        .click();
      await page.waitForURL(/q=/);
      await noOverflow();
      await context.route("**/api/v1/locations?**", (route) =>
        route.fulfill({
          status: 503,
          json: { statusCode: 503, message: "synthetic outage" },
        }),
      );
      await page.getByRole("combobox", { name: "Місто", exact: true }).click();
      const search = page.getByRole("combobox", { name: "Місто", exact: true });
      await search.fill("Ки");
      await page
        .getByRole("button", { name: /Повторити|Спробувати/ })
        .last()
        .waitFor();
      await context.unroute("**/api/v1/locations?**");
      await page
        .getByRole("button", { name: "Спробувати ще раз", exact: true })
        .click();
      await page.getByRole("option").first().waitFor();
      await page.keyboard.press("Escape");
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/services-s7-browser.json",
    JSON.stringify(
      { browser: "real Chromium Chrome", checks, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
}
