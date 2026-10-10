import { chooseCatalogSort } from "./helpers/catalog-sort-browser.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { catalogFilterFixtures } from "./helpers/catalog-filter-fixtures.mjs";
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
  viewport: { width: 375, height: 812 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const records = [],
  requests = [],
  errors = [],
  checks = [];
let data, draftSearch;
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
const until = async (work) => {
  let last;
  for (let end = Date.now() + 20000; Date.now() < end;) {
    try {
      return await work();
    } catch (error) {
      last = error;
      await page.waitForTimeout(100);
    }
  }
  throw last;
};
const matches = (row, expected) =>
  Object.entries(expected).every(
    ([key, value]) =>
      row.url.searchParams.get(key) ===
      (value === undefined ? null : String(value)),
  );
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
        status: response.status(),
        body: await response.json(),
      });
    } catch {}
  }
});
const catalogRequests = () =>
  requests.filter((url) => url.searchParams.get("limit") === "24").length;
const previewRequests = () =>
  requests.filter((url) => url.searchParams.get("limit") === "1").length;
const cards = () =>
  page
    .locator(".catalog-results .listing-card a.listing-card-link")
    .evaluateAll((items) =>
      items.map(
        (item) => new URL(item.getAttribute("href"), location.origin).pathname,
      ),
    );
const dialog = () => page.getByRole("dialog", { name: "Фільтри", exact: true });
const applyButton = () =>
  dialog().locator(".mobile-filters-footer button").last();
async function catalog(expected) {
  return until(async () => {
    assert.equal(
      await page.locator(".catalog-results .listing-skeleton").count(),
      0,
    );
    const hrefs = await cards();
    const count = await page.locator(".catalog-count").innerText();
    const record = records.findLast(
      (row) =>
        row.status === 200 &&
        matches(row, { limit: 24, ...expected }) &&
        JSON.stringify(hrefs) ===
          JSON.stringify(row.body.data.map((item) => `/listings/${item.id}`)) &&
        count.includes(String(row.body.meta.total)),
    );
    assert.ok(record, "Expected rendered catalog from real API response");
    return record;
  });
}
async function preview(expected) {
  return until(async () => {
    assert.match(await applyButton().innerText(), /^Показати /);
    const row = records.findLast(
      (item) =>
        item.status === 200 &&
        matches(item, { limit: 1, q: draftSearch, ...expected }),
    );
    assert.ok(row, "Expected real preview response");
    assert.ok(
      (await applyButton().innerText()).includes(String(row.body.meta.total)),
    );
    return row;
  });
}
async function open() {
  draftSearch = new URL(page.url()).searchParams.get("q") ?? undefined;
  await page.locator(".mobile-filters-trigger").click();
  await dialog().waitFor();
  assert.equal(
    await page
      .locator("[data-drawer-close]")
      .evaluate((node) => node === document.activeElement),
    true,
  );
}
async function close() {
  await dialog()
    .getByRole("button", { name: "Закрити фільтри", exact: true })
    .click();
  await dialog().waitFor({ state: "detached" });
  assert.equal(
    await page
      .locator(".mobile-filters-trigger")
      .evaluate((node) => node === document.activeElement),
    true,
  );
}
async function pick(name, term, label) {
  await dialog()
    .getByRole("button", { name: "Закрити фільтри", exact: true })
    .focus();
  const input = dialog().getByRole("combobox", { name });
  await input.fill(term);
  await input.focus();
  const option = dialog()
    .locator(".reference-results [role=option]")
    .filter({ hasText: label });
  await option.waitFor();
  await option.getByRole("button").click();
}
const csv = (items) => items.slice().sort().join(",");
await mkdir("test-results", { recursive: true });
try {
  data = await catalogFilterFixtures();
  await page.goto("http://localhost:3000/listings");
  await catalog({ page: 1, sort: "newest" });
  await page.getByLabel("Пошук оголошень", { exact: true }).fill(data.marker);
  assert.equal(
    (await catalog({ q: data.marker, page: 1 })).body.meta.total,
    37,
  );
  assert.equal(await page.locator(".listing-filters-panel").isVisible(), false);
  pass("Mobile toolbar keeps debounced search outside and Filters beside Sort");
  const before = catalogRequests(),
    hrefs = await cards();
  await open();
  await preview({});
  assert.equal(catalogRequests(), before);
  pass(
    "Opening drawer uses separate limit=1 preview and leaves catalog unchanged",
  );
  await dialog().getByRole("radio", { name: "Собаки", exact: true }).check();
  await preview({ species: "dog" });
  await pick(/^Породи/, data.marker, data.fixture.breeds[0].nameUk);
  await pick(/^Породи/, data.marker, data.fixture.breeds[1].nameUk);
  await pick(/^Область/, "Кіровоградська", data.fixture.locations[0].region);
  await pick(/^Область/, "Полтавська", data.fixture.locations[1].region);
  await pick(
    /^Місто або село/,
    "Однакова назва",
    data.fixture.locations[0].region,
  );
  await pick(
    /^Місто або село/,
    "Однакова назва",
    data.fixture.locations[1].region,
  );
  const breeds = csv(data.fixture.breeds.slice(0, 2).map((item) => item.id)),
    locations = csv(data.fixture.locations.map((item) => item.id));
  await preview({
    species: "dog",
    breedIds: breeds,
    regionIds: "UA35,UA53",
    locationIds: locations,
  });
  for (const name of [
    "Обрані: Породи",
    "Обрані: Область",
    "Обрані: Місто або село",
  ])
    assert.equal(
      await dialog()
        .getByRole("list", { name, exact: true })
        .locator("li")
        .count(),
      2,
    );
  assert.equal(catalogRequests(), before);
  assert.deepEqual(await cards(), hrefs);
  pass(
    "Multi breed/region/same-name settlement drafts reuse controls without catalog requests",
  );
  for (const width of [320, 375, 430, 768]) {
    await page.setViewportSize({ width, height: 812 });
    const geometry = await page.evaluate(() => {
      const root = document.querySelector(".mobile-filters-drawer"),
        body = root.querySelector(".mobile-filters-body"),
        header = root
          .querySelector(".mobile-filters-header")
          .getBoundingClientRect(),
        footer = root
          .querySelector(".mobile-filters-footer")
          .getBoundingClientRect();
      return {
        overflow:
          document.documentElement.scrollWidth > innerWidth ||
          root.scrollWidth > root.clientWidth + 1 ||
          body.scrollWidth > body.clientWidth + 1,
        header: header.top >= 0,
        footer: footer.bottom <= innerHeight + 1,
        bodyScroll: body.scrollHeight > body.clientHeight,
        chips: [...root.querySelectorAll(".reference-chips")].some(
          (node) => node.scrollWidth > node.clientWidth + 1,
        ),
        touch: [...root.querySelectorAll(".reference-chips button")].every(
          (node) => node.getBoundingClientRect().height >= 44,
        ),
        duplicateIds: [...document.querySelectorAll("[id]")]
          .map((node) => node.id)
          .filter((id, index, ids) => ids.indexOf(id) !== index),
      };
    });
    assert.equal(geometry.overflow, false);
    assert.equal(geometry.chips, false);
    assert.equal(geometry.header, true);
    assert.equal(geometry.footer, true);
    assert.equal(geometry.bodyScroll, true);
    assert.equal(geometry.touch, true);
    assert.deepEqual(geometry.duplicateIds, []);
    await page.screenshot({ path: `test-results/mobile-filters-${width}.png` });
    pass(
      `${width}px: long chips wrap, touch targets fit, independent body scroll and fixed footer/header`,
    );
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await dialog()
    .getByRole("button", { name: "Закрити фільтри", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await applyButton().evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("[data-drawer-close]")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  const y = await page.evaluate(() => scrollY);
  await page.mouse.move(2, 2);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => scrollY), y);
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).overflow,
    ),
    "hidden",
  );
  pass("Native modal traps/enters focus and locks background scroll");
  await close();
  await open();
  assert.equal(
    await dialog().getByRole("radio", { name: "Усі", exact: true }).isChecked(),
    true,
  );
  assert.equal(await dialog().locator(".reference-chips").count(), 0);
  pass("X cancels all draft edits; reopen copies applied state");
  await dialog().getByRole("radio", { name: "Коти", exact: true }).check();
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => document.documentElement.style.overflow),
    "",
  );
  await open();
  assert.equal(
    await dialog().getByRole("radio", { name: "Усі", exact: true }).isChecked(),
    true,
  );
  pass("Escape cancels draft, unlocks page and restores focus");
  await dialog().getByRole("radio", { name: "Коти", exact: true }).check();
  await page.mouse.click(5, 5);
  await dialog().waitFor({ state: "detached" });
  await open();
  assert.equal(
    await dialog().getByRole("radio", { name: "Усі", exact: true }).isChecked(),
    true,
  );
  pass("Backdrop dismisses and discards draft");
  await dialog().getByRole("radio", { name: "Собаки", exact: true }).check();
  await pick(/^Породи/, data.marker, data.fixture.breeds[0].nameUk);
  await preview({ species: "dog", breedIds: data.fixture.breeds[0].id });
  const applyStart = catalogRequests();
  await applyButton().click();
  await catalog({
    species: "dog",
    breedIds: data.fixture.breeds[0].id,
    page: 1,
  });
  await page.waitForTimeout(500);
  assert.equal(catalogRequests() - applyStart, 1);
  assert.equal(await dialog().count(), 0);
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри (2)",
  );
  pass("Apply commits once, closes drawer and counts groups rather than chips");
  await page.getByRole("link", { name: "Сторінка 2", exact: true }).click();
  await catalog({ page: 2, species: "dog" });
  await open();
  assert.equal(
    await dialog()
      .getByRole("list", { name: "Обрані: Породи", exact: true })
      .locator("li")
      .count(),
    1,
  );
  await dialog()
    .getByRole("button", {
      name: "Видалити: " + data.fixture.breeds[0].nameUk,
      exact: true,
    })
    .click();
  await applyButton().click();
  await catalog({ page: 1, breedIds: undefined, species: "dog" });
  pass(
    "Applied selections persist on page 2; removing draft chip and Apply resets page 1",
  );
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  assert.equal(await dialog().isVisible(), true);
  assert.equal(
    await dialog().getByRole("radio", { name: "Усі", exact: true }).isChecked(),
    true,
  );
  await close();
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри (1)",
  );
  pass("Clear changes draft only, stays open, Cancel preserves catalog");
  await chooseCatalogSort(page, "oldest");
  await catalog({ sort: "oldest", species: "dog", page: 1 });
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  await preview({ q: undefined, species: undefined });
  await applyButton().click();
  await catalog({
    q: undefined,
    sort: "newest",
    species: undefined,
    page: 1,
  });
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри",
  );
  pass("Clear then Apply resets structured groups, outside q/sort and the URL");
  assert.equal(
    new URL(page.url()).pathname + new URL(page.url()).search,
    "/listings",
  );
  await page.getByLabel("Пошук оголошень", { exact: true }).fill(data.marker);
  await catalog({ q: data.marker, page: 1 });
  await open();
  const price = dialog().getByLabel("Від", { exact: true }),
    max = dialog().getByLabel("До", { exact: true });
  const previewStart = previewRequests(),
    catalogStart = catalogRequests();
  await price.fill("1");
  await price.fill("10");
  await price.fill("100,01");
  await preview({ priceMin: "100.01" });
  await page.waitForTimeout(450);
  assert.equal(previewRequests() - previewStart, 1);
  assert.equal(catalogRequests(), catalogStart);
  pass(
    "Rapid exact-price edits debounce into one preview without catalog storm",
  );
  await max.fill("5");
  await page.waitForTimeout(450);
  assert.equal(await applyButton().isDisabled(), true);
  const invalidStart = previewRequests();
  await page.waitForTimeout(400);
  assert.equal(previewRequests(), invalidStart);
  pass("Invalid draft price blocks Apply and preview");
  await dialog()
    .getByLabel("Тип оголошення", { exact: true })
    .selectOption("FREE");
  assert.equal(await price.isDisabled(), true);
  assert.equal(await max.isDisabled(), true);
  assert.equal(await price.inputValue(), "");
  await preview({ type: "FREE", priceMin: undefined, priceMax: undefined });
  assert.equal(await applyButton().isEnabled(), true);
  pass("FREE clears/disables price using existing reducer semantics");
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  await price.fill("42");
  await max.fill("42");
  const zero = await preview({ q: undefined, priceMin: "42", priceMax: "42" });
  assert.equal(zero.body.meta.total, 0);
  assert.equal(await applyButton().isEnabled(), true);
  await applyButton().click();
  await catalog({ priceMin: "42", priceMax: "42", page: 1 });
  assert.equal(await dialog().count(), 0);
  pass("Zero preview remains applicable and produces normal empty catalog");
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  await applyButton().click();
  await catalog({ priceMin: undefined, priceMax: undefined, page: 1 });
  await page.getByLabel("Пошук оголошень", { exact: true }).fill(data.marker);
  await catalog({ q: data.marker, page: 1 });
  for (const sort of ["newest", "price_asc", "price_desc", "oldest"]) {
    await chooseCatalogSort(page, sort);
    await catalog({ sort, page: 1 });
  }
  pass("All four outside sort options apply immediately");

  await open();
  await pick(/^Область/, "Кіровоградська", data.fixture.locations[0].region);
  await pick(
    /^Місто або село/,
    "Однакова назва",
    data.fixture.locations[1].region,
  );
  assert.equal(
    (
      await preview({
        regionIds: "UA35",
        locationIds: data.fixture.locations[1].id,
      })
    ).body.meta.total,
    37,
  );
  pass("Draft preview preserves region OR outside settlement semantics");
  const region = dialog().getByRole("combobox", { name: /^Область/ });
  await dialog()
    .getByRole("button", { name: "Закрити фільтри", exact: true })
    .focus();
  await region.fill("");
  await region.focus();
  await dialog().locator(".reference-results [role=option]").first().waitFor();
  await dialog()
    .locator(".reference-results ul")
    .evaluate((list) => {
      list.scrollTop = list.scrollHeight;
      list.dispatchEvent(new Event("scroll"));
    });
  await until(async () => {
    const last = dialog().locator(".reference-results [role=option]").last();
    assert.equal(
      await last.getAttribute("aria-posinset"),
      await last.getAttribute("aria-setsize"),
    );
  });
  await region.press("Escape");
  assert.equal(await dialog().isVisible(), true);
  pass(
    "Mobile reference virtual scroll reaches last region; Escape first closes nested listbox",
  );
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  await dialog().getByRole("radio", { name: "Собаки", exact: true }).check();
  await pick(/^Породи/, data.marker, data.fixture.breeds[0].nameUk);
  await dialog().getByRole("radio", { name: "Усі", exact: true }).check();
  assert.equal(
    await dialog()
      .getByRole("list", { name: "Обрані: Породи", exact: true })
      .locator("li")
      .count(),
    1,
  );
  await dialog().getByRole("radio", { name: "Собаки", exact: true }).check();
  assert.equal(
    await dialog()
      .getByRole("list", { name: "Обрані: Породи", exact: true })
      .locator("li")
      .count(),
    1,
  );
  await dialog().getByRole("radio", { name: "Коти", exact: true }).check();
  assert.equal(await dialog().locator(".reference-chips").count(), 0);
  pass(
    "Draft species changes preserve compatible breeds and remove incompatible ones only",
  );
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  for (const [value, min, max] of [
    ["0-3", 0, 3],
    ["3-6", 3, 6],
    ["6-12", 6, 12],
    ["12-24", 12, 24],
    ["24-60", 24, 60],
    ["60+", 60, undefined],
  ]) {
    await dialog().getByLabel("Вік", { exact: true }).selectOption(value);
    await preview({ q: undefined, ageMinMonths: min, ageMaxMonths: max });
  }
  pass(
    "All six age presets use the same inclusive API mappings in draft preview",
  );
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  await dialog().getByLabel("Від", { exact: true }).fill("100");
  await dialog()
    .getByLabel("Тип оголошення", { exact: true })
    .selectOption("ADOPTION");
  assert.equal(
    await dialog().getByLabel("Від", { exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await dialog().getByLabel("Від", { exact: true }).inputValue(),
    "",
  );
  await preview({ q: undefined, type: "ADOPTION", priceMin: undefined });
  pass("ADOPTION also clears/disables draft price");
  const footerBefore = await dialog()
    .locator(".mobile-filters-footer")
    .boundingBox();
  await dialog()
    .locator(".mobile-filters-body")
    .evaluate((node) => (node.scrollTop = 0));
  const body = await dialog().locator(".mobile-filters-body").boundingBox();
  await page.mouse.move(body.x + body.width / 2, body.y + 100);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(200);
  assert.ok(
    await dialog()
      .locator(".mobile-filters-body")
      .evaluate((node) => node.scrollTop > 0),
  );
  assert.deepEqual(
    await dialog().locator(".mobile-filters-footer").boundingBox(),
    footerBefore,
  );
  await dialog()
    .locator(".mobile-filters-body")
    .evaluate((node) => (node.scrollTop = 0));
  await page.screenshot({ path: "test-results/mobile-filters-body-top.png" });
  await dialog()
    .locator(".mobile-filters-body")
    .evaluate((node) => (node.scrollTop = node.scrollHeight));
  await page.screenshot({
    path: "test-results/mobile-filters-body-bottom.png",
  });
  pass(
    "Mouse wheel scrolls drawer body while footer remains fixed and reachable",
  );
  await close();
  const previewRoute = async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("limit") === "1") {
      url.searchParams.set("unsupportedPreviewCheck", "1");
      await route.continue({ url: url.toString() });
    } else await route.continue();
  };
  await page.route("**/api/v1/listings?**", previewRoute);
  await open();
  await dialog().getByLabel("Стать", { exact: true }).selectOption("FEMALE");
  await until(async () =>
    assert.ok(
      (await dialog().getByRole("status").innerText()).includes(
        "Кількість недоступна",
      ),
    ),
  );
  assert.equal(await applyButton().innerText(), "Застосувати фільтри");
  assert.equal(await applyButton().isEnabled(), true);
  await applyButton().click();
  await catalog({ gender: "FEMALE", page: 1 });
  await page.unroute("**/api/v1/listings?**", previewRoute);
  pass(
    "Real backend preview failure falls back to Apply; catalog requests remain unaffected",
  );
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  draftSearch = undefined;
  await applyButton().click();
  await catalog({ gender: undefined, page: 1 });
  const searchStart = catalogRequests();
  await page
    .getByLabel("Пошук оголошень", { exact: true })
    .fill(data.marker + "no-match");
  await page.waitForTimeout(100);
  assert.equal(catalogRequests(), searchStart);
  await catalog({ q: data.marker + "no-match", page: 1 });
  await page.getByLabel("Пошук оголошень", { exact: true }).fill(data.marker);
  await catalog({ q: data.marker, page: 1 });
  pass(
    "Outside mobile search retains 350ms debounce and literal backend semantics",
  );

  await open();
  await dialog().getByRole("radio", { name: "Коти", exact: true }).check();
  await page.setViewportSize({ width: 1024, height: 900 });
  await dialog().waitFor({ state: "detached" });
  assert.equal(await page.locator(".listing-filters-panel").isVisible(), true);
  assert.equal(
    await page.getByRole("radio", { name: "Усі", exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.style.overflow),
    "",
  );
  pass("Crossing desktop breakpoint cancels draft and restores sidebar/scroll");
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.locator(".mobile-filters-trigger").isVisible(),
      false,
    );
    assert.equal(
      await page.locator(".listing-filters-panel").isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `test-results/mobile-filters-desktop-${width}.png`,
    });
    pass(
      `${width}px: desktop sidebar unchanged, mobile trigger hidden, no overflow`,
    );
  }
  assert.deepEqual(errors, []);
  pass("No browser runtime errors");
} finally {
  await context.close();
  await browser.close();
  if (data) await data.cleanup();
  await writeFile(
    "test-results/mobile-filters-validation.json",
    JSON.stringify(
      {
        checks,
        errors,
        catalogRequests: catalogRequests(),
        previewRequests: previewRequests(),
      },
      null,
      2,
    ),
  );
}
console.log(
  `${checks.length} mobile filter browser checks passed; fixture domain restored.`,
);
