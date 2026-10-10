import { chooseCatalogSort } from "./helpers/catalog-sort-browser.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { catalogFilterFixtures } from "./helpers/catalog-filter-fixtures.mjs";
import { catalogSelectionBrowser } from "./helpers/catalog-selection-browser.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const records = [],
  errors = [],
  checks = [],
  requests = [];
const base = "http://localhost:3000";
let data;
await mkdir("test-results", { recursive: true });
const pass = (text) => {
  checks.push(text);
  console.log("PASS " + text);
};
const until = async (work) => {
  let last;
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    try {
      return await work();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw last;
};
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.pathname === "/api/v1/listings") requests.push(url);
});
page.on("response", async (response) => {
  const url = new URL(response.url());
  if (url.pathname === "/api/v1/listings") {
    try {
      records.push({
        url,
        body: await response.json(),
        status: response.status(),
      });
    } catch {}
  }
});
const matches = (record, expected) =>
  Object.entries(expected).every(
    ([key, value]) =>
      record.url.searchParams.get(key) ===
      (value === undefined ? null : String(value)),
  );
async function step(label, action, expected) {
  await action();
  const record = await until(async () => {
    assert.equal(
      await page.locator(".catalog-results .listing-skeleton").count(),
      0,
    );
    const hrefs = await page
      .locator(".catalog-results .listing-card a.listing-card-link")
      .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
    const count = await page.locator(".catalog-count").innerText();
    // The existing 30-second query cache may reuse a prior real API response.
    const row = records.findLast(
      (item) =>
        item.status === 200 &&
        matches(item, expected) &&
        JSON.stringify(hrefs) ===
          JSON.stringify(
            item.body.data.map((listing) => `/listings/${listing.id}`),
          ) &&
        count.includes(String(item.body.meta.total)),
    );
    assert.ok(row, "Expected current rendered data from a real API response");
    return row;
  });
  assert.ok(record.body.data.every((item) => item.status === "ACTIVE"));
  pass(label);
  return record;
}
async function selectedLayout(name) {
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.ok(await page.locator(".catalog-clear").isVisible());
    await page.screenshot({
      path: `test-results/catalog-selected-${name}-${width}.png`,
    });
    pass(
      `${width}px: selected ${name} wraps without overflow; Clear stays reachable`,
    );
  }
}
async function clear() {
  await step(
    "Clear resets all filters, page and newest sort",
    () => page.locator(".catalog-clear").click(),
    {
      q: undefined,
      species: undefined,
      breedIds: undefined,
      locationIds: undefined,
      regionIds: undefined,
      type: undefined,
      gender: undefined,
      ageMinMonths: undefined,
      ageMaxMonths: undefined,
      priceMin: undefined,
      priceMax: undefined,
      page: 1,
      sort: "newest",
    },
  );
}
async function scope() {
  await step(
    "Catalog q uses literal server search",
    () => page.getByLabel("Пошук оголошень", { exact: true }).fill(data.marker),
    { q: data.marker, page: 1 },
  );
}
try {
  data = await catalogFilterFixtures();
  await step(
    "Default catalog uses real ACTIVE-only API",
    () => page.goto(base + "/listings"),
    { page: 1, sort: "newest" },
  );
  const before = requests.length;
  await page.getByLabel("Пошук оголошень", { exact: true }).fill(data.marker);
  await page.waitForTimeout(150);
  assert.equal(requests.length, before);
  assert.ok((await page.locator(".listing-skeleton").count()) > 0);
  await until(async () =>
    assert.ok(
      records.some(
        (row) => matches(row, { q: data.marker }) && row.status === 200,
      ),
    ),
  );
  await until(async () =>
    assert.equal(
      await page.locator(".catalog-count").innerText(),
      "Знайдено 37 оголошень",
    ),
  );
  pass(
    "350 ms search debounce hides stale cards and avoids keystroke requests",
  );
  const dog = await step(
    "Dogs send dog slug",
    () => page.getByRole("radio", { name: "Собаки", exact: true }).check(),
    { species: "dog", q: data.marker },
  );
  assert.ok(dog.body.data.every((item) => item.pet.species.slug === "dog"));
  const cat = await step(
    "Cats send cat slug",
    () => page.getByRole("radio", { name: "Коти", exact: true }).check(),
    { species: "cat" },
  );
  assert.ok(cat.body.data.every((item) => item.pet.species.slug === "cat"));
  await step(
    "Species scoped breed setup",
    () => page.getByRole("radio", { name: "Собаки", exact: true }).check(),
    { species: "dog" },
  );
  const breed = page.getByRole("combobox", { name: /^Породи/ });
  await breed.fill(data.marker);
  await page.locator(".reference-results [role=option]").first().waitFor();
  await breed.press("ArrowDown");
  const chosen = await step(
    "Breed keyboard ArrowDown/Enter sends exact breedIds",
    () => breed.press("Enter"),
    { species: "dog", breedIds: data.fixture.breeds[0].id },
  );
  assert.ok(
    chosen.body.data.every(
      (item) => item.pet.breed?.id === data.fixture.breeds[0].id,
    ),
  );
  await selectedLayout("breed");
  await step(
    "Changing species clears incompatible breed",
    () => page.getByRole("radio", { name: "Коти", exact: true }).check(),
    { species: "cat", breedIds: undefined },
  );
  await clear();
  await scope();
  const location = page.getByRole("combobox", {
    name: /^Місто або село/,
  });
  const locationBefore = requests.length;
  await location.fill("О");
  await page.waitForTimeout(350);
  assert.equal(requests.length, locationBefore);
  assert.equal(
    await page.locator(".reference-results [role=option]").count(),
    0,
  );
  await location.fill("Однакова назва");
  await page.locator(".reference-results [role=option]").first().waitFor();
  // Same-name locations remain independent choices with region context.
  const expectedRegion = data.fixture.locations[0].region;
  const option = page
    .locator(".reference-results [role=option]")
    .filter({ hasText: expectedRegion });
  await option.waitFor();
  const located = await step(
    "Exact Location selection retains regional context",
    () => option.getByRole("button").click(),
    { locationIds: data.fixture.locations[0].id },
  );
  assert.ok(
    located.body.data.every(
      (item) => item.location.id === data.fixture.locations[0].id,
    ),
  );
  assert.ok(
    await page
      .locator(".reference-chips")
      .filter({ hasText: expectedRegion })
      .count(),
  );
  await selectedLayout("location");
  await clear();
  await scope();
  await catalogSelectionBrowser({ page, data, step, clear, scope, pass });
  for (const type of ["SALE", "FREE", "ADOPTION"]) {
    const row = await step(
      `${type} type uses server filter`,
      () =>
        page.getByLabel("Тип оголошення", { exact: true }).selectOption(type),
      { type },
    );
    assert.ok(row.body.data.every((item) => item.type === type));
  }
  await step(
    "Clear type selection",
    () => page.getByLabel("Тип оголошення", { exact: true }).selectOption(""),
    { type: undefined },
  );
  for (const gender of ["MALE", "FEMALE", "UNKNOWN"]) {
    const row = await step(
      `${gender} gender uses server filter`,
      () => page.getByLabel("Стать", { exact: true }).selectOption(gender),
      { gender },
    );
    assert.ok(row.body.data.every((item) => item.pet.gender === gender));
  }
  await step(
    "Clear gender selection",
    () => page.getByLabel("Стать", { exact: true }).selectOption(""),
    { gender: undefined },
  );
  for (const [value, min, max] of [
    ["0-3", 0, 3],
    ["3-6", 3, 6],
    ["6-12", 6, 12],
    ["12-24", 12, 24],
    ["24-60", 24, 60],
    ["60+", 60, undefined],
  ])
    await step(
      `Age preset ${value} maps to calendar months`,
      () => page.getByLabel("Вік", { exact: true }).selectOption(value),
      { ageMinMonths: min, ageMaxMonths: max },
    );
  await step(
    "Clear age selection",
    () => page.getByLabel("Вік", { exact: true }).selectOption(""),
    { ageMinMonths: undefined, ageMaxMonths: undefined },
  );
  await step(
    "Price minimum preserves decimal cents",
    () => page.getByLabel("Від", { exact: true }).fill("100,01"),
    { priceMin: "100.01" },
  );
  const priced = await step(
    "Price maximum combines inclusive SALE range",
    () => page.getByLabel("До", { exact: true }).fill("200.02"),
    { priceMin: "100.01", priceMax: "200.02" },
  );
  assert.ok(
    priced.body.data.every(
      (item) =>
        item.type === "SALE" &&
        Number(item.price) >= 100.01 &&
        Number(item.price) <= 200.02,
    ),
  );
  let count = requests.length;
  await page.getByLabel("До", { exact: true }).fill("-1");
  await page.waitForTimeout(500);
  assert.equal(requests.length, count);
  assert.equal(
    await page.getByLabel("До", { exact: true }).getAttribute("aria-invalid"),
    "true",
  );
  assert.ok(
    await page.getByText("Перевірте діапазон ціни", { exact: true }).count(),
  );
  pass("Invalid price stays local and hides stale cards");
  await step(
    "FREE clears and disables price instead of producing confusing empty results",
    () =>
      page.getByLabel("Тип оголошення", { exact: true }).selectOption("FREE"),
    { type: "FREE", priceMin: undefined, priceMax: undefined },
  );
  assert.ok(await page.getByLabel("Від", { exact: true }).isDisabled());
  assert.equal(await page.getByLabel("До", { exact: true }).inputValue(), "");
  await clear();
  await scope();
  for (const sort of ["oldest", "price_asc", "price_desc", "newest"]) {
    const row = await step(
      `Sort ${sort} matches real backend order`,
      () => chooseCatalogSort(page, sort),
      { sort },
    );
    if (sort.startsWith("price_")) {
      let nullSeen = false,
        previous;
      for (const item of row.body.data) {
        if (item.price === null) {
          nullSeen = true;
          continue;
        }
        assert.equal(nullSeen, false);
        const value = Number(item.price);
        if (previous !== undefined)
          assert.ok(
            sort === "price_asc" ? value >= previous : value <= previous,
          );
        previous = value;
      }
    }
  }
  await step(
    "Combined q + dog + SALE filters",
    async () => {
      await page.getByRole("radio", { name: "Собаки", exact: true }).check();
      await page
        .getByLabel("Тип оголошення", { exact: true })
        .selectOption("SALE");
    },
    { q: data.marker, species: "dog", type: "SALE" },
  );
  await step(
    "Filtered pagination retains selected filters on page 2",
    () => page.getByRole("link", { name: "Сторінка 2", exact: true }).click(),
    { q: data.marker, species: "dog", type: "SALE", page: 2 },
  );
  await step(
    "Filter change from page 2 resets page 1",
    () => page.getByLabel("Стать", { exact: true }).selectOption("MALE"),
    { q: data.marker, species: "dog", type: "SALE", gender: "MALE", page: 1 },
  );
  assert.ok(new URL(page.url()).searchParams.get("page") === "1");
  await step(
    "Zero-result filtered state",
    () =>
      page
        .getByLabel("Пошук оголошень", { exact: true })
        .fill(`відсутнє-${data.marker}`),
    { q: `відсутнє-${data.marker}` },
  );
  assert.ok(
    await page
      .getByText("За вибраними параметрами оголошень не знайдено.", {
        exact: true,
      })
      .count(),
  );
  await clear();
  // A real backend validation error exercises retry; successful requests remain unmocked.
  const route = "**/api/v1/listings?*";
  await page.route(route, async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("unsupported", "1");
    await route.continue({ url: url.href });
  });
  await page
    .getByLabel("Пошук оголошень", { exact: true })
    .fill(`${data.marker}-retry`);
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .waitFor({ timeout: 25000 });
  assert.equal(
    await page.getByLabel("Пошук оголошень", { exact: true }).inputValue(),
    `${data.marker}-retry`,
  );
  await page.unroute(route);
  await step(
    "Real API error keeps filters and retry recovers",
    () =>
      page
        .getByRole("button", { name: "Спробувати ще раз", exact: true })
        .click(),
    { q: `${data.marker}-retry` },
  );
  await clear();
  for (const width of [320, 375, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => {
      const sidebar = document.querySelector(".listing-filters-panel"),
        results = document.querySelector(".catalog-results"),
        grid = document.querySelector(".catalog-results .listings-grid");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        sidebar: getComputedStyle(sidebar).display,
        sidebarRight: sidebar.getBoundingClientRect().right,
        resultLeft: results.getBoundingClientRect().left,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      };
    });
    assert.equal(geometry.overflow, false);
    assert.equal(geometry.sidebar === "none", width < 1024);
    if (width >= 1024) {
      assert.ok(geometry.sidebarRight < geometry.resultLeft);
      assert.equal(geometry.columns, width >= 1280 ? 3 : 2);
    }
    assert.ok(
      await page.getByLabel("Пошук оголошень", { exact: true }).isVisible(),
    );
    await page.screenshot({
      path: `test-results/catalog-filters-${width}.png`,
      fullPage: true,
    });
    pass(
      `${width}px: responsive catalog, sidebar breakpoint and no horizontal overflow`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await step(
    "Default pagination remains usable after clearing",
    () => page.getByRole("link", { name: "Сторінка 2", exact: true }).click(),
    { page: 2, q: undefined },
  );
  assert.deepEqual(errors, []);
  pass("No browser runtime or hydration errors");
  await writeFile(
    "test-results/catalog-filters-validation.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/catalog-filters-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  if (data) {
    await data.cleanup();
    console.log(
      "PASS Original database fingerprints preserved after exact fixture cleanup",
    );
  }
}
