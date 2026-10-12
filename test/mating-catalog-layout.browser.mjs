// Read-only browser layout stress: synthetic safe public DTO, no database writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  id,
  status: "ACTIVE",
  currency: "UAH",
  fee: "1234.56",
  createdAt: "2026-10-01T00:00:00Z",
  pet: {
    id,
    name: "Лада",
    gender: "FEMALE",
    birthDate: "2024-01-01",
    profileImage: null,
    species: { id, name: "Dog", slug: "dog" },
    breed: {
      id,
      name: "Long breed",
      nameUk: "Довга назва породи ".repeat(8),
      slug: "long-breed",
    },
  },
  location: {
    id,
    countryCode: "UA",
    city: "Довга назва населеного пункту ".repeat(5).slice(0, 145),
    region: "Довга назва області ".repeat(8).slice(0, 145),
    district: null,
    community: null,
    settlementType: "CITY",
    katottgCode: null,
  },
  owner: {
    id,
    displayName: "Розплідник із довгою публічною назвою для перевірки",
  },
};
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mkdir("test-results", { recursive: true });
  await page.route("**/mating-listings?*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [row],
        meta: { page: 1, limit: 24, total: 1, pages: 1 },
      }),
    }),
  );
  await page.goto("http://localhost:3000/mating");
  await page.locator(".mating-public-card").waitFor();
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    for (const selector of [
      ".mating-public-card",
      ".mating-public-card h2",
      ".listing-location",
      ".mating-public-seller",
      ".mating-public-card a",
    ]) {
      for (const node of await page.locator(selector).all()) {
        const bounds = await node.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      }
    }
    const location = page.locator(".mating-public-card .listing-location");
    assert.equal(
      await location.evaluate((el) => getComputedStyle(el).webkitLineClamp),
      "3",
    );
    assert.ok(await location.getAttribute("title"));
    const titleSize = await page
      .locator(".mating-public-card h2")
      .evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        line: parseFloat(getComputedStyle(el).lineHeight),
      }));
    assert.ok(
      titleSize.height >= titleSize.line * 2 - 1,
      "long title retains two complete readable lines",
    );
    await page.screenshot({
      path: `test-results/phase9c-long-breed-${width}.png`,
    });
    checks.push(width);
    console.log("PASS long breed/location/owner wrapping " + width);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/phase9c-layout.json",
    JSON.stringify({ checks, errors, databaseWrites: false }, null, 2),
  );
} finally {
  await browser.close();
}
