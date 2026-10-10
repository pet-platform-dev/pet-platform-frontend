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
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const records = [],
  requests = [],
  errors = [],
  checks = [];
let data;
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
        matches(item, { limit: 1, q: data.marker, ...expected }),
    );
    assert.ok(row, "Expected real preview response");
    assert.ok(
      (await applyButton().innerText()).includes(String(row.body.meta.total)),
    );
    return row;
  });
}
async function open() {
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
async function pick(name, term, label, scope = page) {
  await page.getByLabel("Пошук оголошень", { exact: true }).focus();
  const input = scope.getByRole("combobox", { name });
  await input.fill(term);
  await input.focus();
  const option = scope
    .locator(".reference-results [role=option]")
    .filter({ hasText: label });
  await option.waitFor();
  await option.getByRole("button").click();
}
const csv = (items) => items.slice().sort().join(",");

const path = () => new URL(page.url()).pathname + new URL(page.url()).search;
const params = () => new URL(page.url()).searchParams;
const search = () => page.getByLabel("Пошук оголошень", { exact: true });
const historyLength = () => page.evaluate(() => history.length);
const selected = (name, scope = page) =>
  scope.getByRole("list", { name, exact: true }).locator("li").count();
async function expectParam(key, value) {
  await until(() => assert.equal(params().get(key), value));
}
async function settled(expected = {}) {
  return catalog({ q: data.marker, page: 1, sort: "newest", ...expected });
}
async function pageTwo() {
  await page.getByRole("link", { name: "Сторінка 2", exact: true }).click();
  await expectParam("page", "2");
}
await mkdir("test-results", { recursive: true });
try {
  data = await catalogFilterFixtures();
  await page.goto("http://localhost:3000/listings?q=" + data.marker);
  await settled();
  const initialHistory = await historyLength(),
    initialRequests = catalogRequests();
  await page.getByRole("radio", { name: "Собаки", exact: true }).check();
  await settled({ species: "dog" });
  assert.equal(await historyLength(), initialHistory + 1);
  await page.waitForTimeout(400);
  assert.equal(catalogRequests(), initialRequests + 1);
  assert.equal(
    await page
      .getByRole("radio", { name: "Собаки", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  pass("Desktop species pushes once, fetches once, retains keyboard focus");
  await pick(/^Породи/, data.marker, data.fixture.breeds[0].nameUk);
  await pick(/^Породи/, data.marker, data.fixture.breeds[1].nameUk);
  await pick(/^Область/, "Кіровоградська", data.fixture.locations[0].region);
  await pick(
    /^Місто або село/,
    "Однакова назва",
    data.fixture.locations[1].region,
  );
  await page.getByLabel("Тип оголошення", { exact: true }).selectOption("SALE");
  await page.getByLabel("Стать", { exact: true }).selectOption("MALE");
  await page.getByLabel("Вік", { exact: true }).selectOption("0-3");
  const priceHistory = await historyLength();
  await page.getByLabel("Від", { exact: true }).fill("100,01");
  await page.getByLabel("До", { exact: true }).fill("1000");
  await expectParam("priceMin", "100.01");
  assert.equal(await historyLength(), priceHistory + 1);
  await chooseCatalogSort(page, "price_asc");
  const complex = {
    species: "dog",
    breedIds: csv(data.fixture.breeds.slice(0, 2).map((i) => i.id)),
    regionIds: "UA35",
    locationIds: data.fixture.locations[1].id,
    type: "SALE",
    gender: "MALE",
    ageMinMonths: 0,
    ageMaxMonths: 3,
    priceMin: "100.01",
    priceMax: "1000",
    sort: "price_asc",
  };
  await settled(complex);
  await pageTwo();
  const row = await settled({ ...complex, page: 2 }),
    hrefs = await cards(),
    copied = page.url();
  assert.equal(await selected("Обрані: Породи"), 2);
  assert.equal(params().get("breedIds"), complex.breedIds);
  assert.deepEqual(
    [...params().keys()],
    [
      "q",
      "species",
      "breedIds",
      "regionIds",
      "locationIds",
      "type",
      "gender",
      "ageMinMonths",
      "ageMaxMonths",
      "priceMin",
      "priceMax",
      "sort",
      "page",
    ],
  );
  pass(
    "Complex desktop controls serialize deterministic CSV, price, sort and page-two links",
  );
  await page.reload();
  await settled({ ...complex, page: 2 });
  assert.equal(page.url(), copied);
  assert.deepEqual(await cards(), hrefs);
  assert.equal(await selected("Обрані: Породи"), 2);
  assert.equal(await selected("Обрані: Область"), 1);
  assert.equal(await selected("Обрані: Місто або село"), 1);
  assert.equal(await search().inputValue(), data.marker);
  assert.equal(
    await page.getByLabel("Вік", { exact: true }).inputValue(),
    "0-3",
  );
  assert.equal(
    await page.getByLabel("Від", { exact: true }).inputValue(),
    "100.01",
  );
  pass(
    "Refresh restores all query fields and identical ordered page-two results",
  );
  const returnTarget = new URL(copied).pathname + new URL(copied).search;
  const detailLink = page
    .locator(".catalog-results .listing-card-link")
    .first();
  const detailUrl = new URL(await detailLink.getAttribute("href"), page.url());
  assert.equal(detailUrl.searchParams.get("returnTo"), returnTarget);
  await detailLink.click();
  await page.locator(".listing-back-link").waitFor();
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    returnTarget,
  );
  pass(
    "Catalog detail link preserves all filters, search, sort and page=2 in safe returnTo",
  );
  await page.reload();
  await page.locator(".listing-back-link").waitFor();
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    returnTarget,
  );
  await page.getByRole("link", { name: "До оголошень" }).click();
  await until(() => assert.equal(page.url(), copied));
  await settled({ ...complex, page: 2 });
  assert.deepEqual(await cards(), hrefs);
  await page.goBack();
  await page.locator(".listing-back-link").waitFor();
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    returnTarget,
  );
  await page.goForward();
  await until(() => assert.equal(page.url(), copied));
  await settled({ ...complex, page: 2 });
  pass(
    "Detail refresh and return restore exact catalog/results; Back/Forward have no redirect loop",
  );
  const directDetail = new URL(detailUrl.pathname, page.url()).href;
  await page.goto(directDetail);
  await page.locator(".listing-back-link").waitFor();
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    "/listings",
  );
  pass("Direct detail without catalog context falls back to /listings");
  for (const unsafe of [
    "https://evil.example/listings",
    "//evil.example/listings",
    "/listings/../account",
    "/listings-evil?q=x",
  ]) {
    await page.goto(
      directDetail + "?" + new URLSearchParams({ returnTo: unsafe }),
    );
    await page.locator(".listing-back-link").waitFor();
    assert.equal(
      await page.locator(".listing-back-link").getAttribute("href"),
      "/listings",
    );
  }
  pass(
    "External/protocol-relative/lookalike/traversal return targets are rejected on detail",
  );
  await page.goto(copied);
  await settled({ ...complex, page: 2 });
  const sharedContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const shared = await sharedContext.newPage();
    const api = shared.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/v1/listings",
    );
    await shared.goto(copied);
    const response = await api;
    assert.equal(response.status(), 200);
    assert.deepEqual(
      (await response.json()).data.map((i) => i.id),
      row.body.data.map((i) => i.id),
    );
    await shared.locator(".listing-card").first().waitFor();
    assert.equal(
      await shared
        .getByRole("radio", { name: "Собаки", exact: true })
        .isChecked(),
      true,
    );
    assert.equal(
      await shared
        .getByRole("list", { name: "Обрані: Породи", exact: true })
        .locator("li")
        .count(),
      2,
    );
    assert.equal(
      await shared.getByLabel("Стать", { exact: true }).inputValue(),
      "MALE",
    );
    assert.equal(
      await shared.getByLabel("Тип оголошення", { exact: true }).inputValue(),
      "SALE",
    );
  } finally {
    await sharedContext.close();
  }
  pass(
    "Copied complex URL works in a fresh browser context without prior metadata/state",
  );
  await page
    .locator(".listing-filters-panel")
    .getByRole("button", { name: "Очистити фільтри", exact: true })
    .click();
  await until(() => assert.equal(path(), "/listings"));
  await catalog({ q: undefined, page: 1, sort: "newest" });
  assert.equal(await search().inputValue(), "");
  pass(
    "Desktop clear removes q, every filter, page and sort to clean /listings",
  );
  await search().fill(data.marker);
  await settled();
  const states = [page.url()];
  await page.getByRole("radio", { name: "Собаки", exact: true }).check();
  await settled({ species: "dog" });
  states.push(page.url());
  await pick(/^Породи/, data.marker, data.fixture.breeds[0].nameUk);
  await settled({ species: "dog", breedIds: data.fixture.breeds[0].id });
  states.push(page.url());
  await pick(
    /^Місто або село/,
    "Однакова назва",
    data.fixture.locations[0].region,
  );
  await settled({
    species: "dog",
    breedIds: data.fixture.breeds[0].id,
    locationIds: data.fixture.locations[0].id,
  });
  states.push(page.url());
  await pageTwo();
  await settled({ page: 2 });
  states.push(page.url());
  for (let i = 3; i >= 0; i--) {
    await page.goBack();
    await until(() => assert.equal(page.url(), states[i]));
    await settled({ page: 1 });
    assert.equal(await search().inputValue(), data.marker);
  }
  assert.equal(
    await page.getByRole("radio", { name: "Усі", exact: true }).isChecked(),
    true,
  );
  assert.equal(await selected("Обрані: Породи"), 0);
  pass(
    "Four Back actions restore page-one and previous location/breed/species controls/results",
  );
  for (let i = 1; i < states.length; i++) {
    await page.goForward();
    await until(() => assert.equal(page.url(), states[i]));
    await settled({ page: i === 4 ? 2 : 1 });
  }
  assert.equal(await selected("Обрані: Породи"), 1);
  assert.equal(await selected("Обрані: Місто або село"), 1);
  pass(
    "Four Forward actions restore every filtered state and page-two results",
  );
  const beforeSearchHistory = await historyLength();
  await search().fill(data.marker + "x");
  await search().fill(data.marker + "xy");
  await search().fill(data.marker + "xyz");
  await expectParam("q", data.marker + "xyz");
  await settled({ q: data.marker + "xyz", page: 1 });
  assert.equal(await historyLength(), beforeSearchHistory);
  assert.equal(params().get("page"), null);
  await search().fill("PENDING-MUST-NOT-COMMIT");
  await page.goBack();
  await until(() => assert.equal(page.url(), states[3]));
  await page.waitForTimeout(600);
  assert.equal(page.url(), states[3]);
  assert.equal(await search().inputValue(), data.marker);
  await settled({ page: 1 });
  pass(
    "Search debounce replaces history; Back cancels pending typing and restores URL/input",
  );
  await page.goForward();
  await expectParam("q", data.marker + "xyz");
  assert.equal(await search().inputValue(), data.marker + "xyz");
  pass("Forward restores the debounced q without per-character entries");
  await page.goto(
    "http://localhost:3000/listings?q=" + data.marker + "&species=dog",
  );
  await settled({ species: "dog" });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри (1)",
  );
  const mobileUrl = page.url(),
    mobileRequests = catalogRequests();
  await open();
  await dialog().getByLabel("Стать", { exact: true }).selectOption("MALE");
  await preview({ species: "dog", gender: "MALE" });
  assert.equal(page.url(), mobileUrl);
  assert.equal(catalogRequests(), mobileRequests);
  await close();
  assert.equal(page.url(), mobileUrl);
  pass(
    "Mobile draft and Cancel leave applied URL/catalog untouched; count derives from URL",
  );
  await open();
  await dialog().getByLabel("Стать", { exact: true }).selectOption("MALE");
  const applyHistory = await historyLength();
  await applyButton().click();
  await settled({ species: "dog", gender: "MALE" });
  assert.equal(await historyLength(), applyHistory + 1);
  assert.equal(params().get("gender"), "MALE");
  const appliedMobile = page.url();
  await page.reload();
  await settled({ species: "dog", gender: "MALE" });
  assert.equal(page.url(), appliedMobile);
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри (2)",
  );
  await open();
  assert.equal(
    await dialog().getByLabel("Стать", { exact: true }).inputValue(),
    "MALE",
  );
  await close();
  pass(
    "Mobile Apply pushes once; refresh restores draft controls and applied count",
  );
  await chooseCatalogSort(page, "oldest");
  await settled({ sort: "oldest" });
  const beforeClear = page.url();
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  assert.equal(page.url(), beforeClear);
  await close();
  assert.equal(page.url(), beforeClear);
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  await applyButton().click();
  await until(() => assert.equal(path(), "/listings"));
  await catalog({ q: undefined, page: 1, sort: "newest" });
  assert.equal(await search().inputValue(), "");
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри",
  );
  pass(
    "Mobile Clear remains draft-only; Clear+Apply resets q/sort to clean /listings",
  );
  await page.goBack();
  await until(() => assert.equal(page.url(), beforeClear));
  await settled({ sort: "oldest" });
  await open();
  await dialog().getByRole("radio", { name: "Коти", exact: true }).check();
  await page.goBack();
  await dialog().waitFor({ state: "detached" });
  await settled({ species: "dog", gender: "MALE" });
  pass(
    "Back during an open draft discards stale draft and restores applied history safely",
  );
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (width < 1024) {
      await open();
      assert.equal(
        await dialog().getByLabel("Стать", { exact: true }).inputValue(),
        "MALE",
      );
      assert.equal(
        await page.evaluate(() => {
          const n = document.querySelector(".mobile-filters-drawer");
          return n.scrollWidth > n.clientWidth + 1;
        }),
        false,
      );
      await close();
    } else
      assert.equal(
        await page.getByLabel("Стать", { exact: true }).inputValue(),
        "MALE",
      );
    await page.screenshot({
      path: "test-results/filter-url-" + width + ".png",
    });
    pass(
      width +
        "px URL-derived controls stay aligned with no horizontal overflow",
    );
  }
  await page.goto(
    "http://localhost:3000/listings?sort=newest&page=1&species=bad&priceMin=bad&breedIds=invalid&x=y&q=" +
      data.marker,
  );
  await until(() => assert.equal(path(), "/listings?q=" + data.marker));
  await settled();
  const stable = catalogRequests(),
    length = await historyLength();
  await page.waitForTimeout(800);
  assert.equal(catalogRequests(), stable);
  assert.equal(await historyLength(), length);
  pass("Malformed URL normalization replaces once with no history/fetch loops");
  await page.goto("http://localhost:3000/listings");
  await catalog({ q: undefined, page: 1, sort: "newest" });
  const cleanHistory = await historyLength();
  await search().fill("pending clear");
  await page.locator(".catalog-clear").click();
  await page.waitForTimeout(600);
  assert.equal(path(), "/listings");
  assert.equal(await search().inputValue(), "");
  await page.getByLabel("Від", { exact: true }).fill("invalid");
  await page.locator(".catalog-clear").click();
  assert.equal(await page.getByLabel("Від", { exact: true }).inputValue(), "");
  await catalog({ q: undefined, page: 1, sort: "newest" });
  assert.equal(await historyLength(), cleanHistory);
  pass(
    "Clear cancels pending search and invalid price even when the URL is already clean",
  );
  const mixedHistory = await historyLength();
  await page.getByLabel("Від", { exact: true }).fill("100.01");
  await search().fill(data.marker);
  await settled({ priceMin: "100.01" });
  await expectParam("priceMin", "100.01");
  assert.equal(await historyLength(), mixedHistory + 1);
  await page.getByLabel("До", { exact: true }).fill("50");
  await page.goBack();
  await until(() => assert.equal(path(), "/listings"));
  await page.waitForTimeout(600);
  assert.equal(await page.getByLabel("Від", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("До", { exact: true }).inputValue(), "");
  assert.equal(await search().inputValue(), "");
  pass(
    "Mixed pending price/search pushes for the price action; Back discards invalid price edits",
  );
  const unknown = "99999999-9999-4999-8999-999999999999";
  await page.goto(
    "http://localhost:3000/listings?species=cat&breedIds=" +
      unknown +
      "&locationIds=" +
      unknown +
      "&ageMinMonths=3&ageMaxMonths=12",
  );
  const empty = await catalog({
    q: undefined,
    species: "cat",
    breedIds: unknown,
    locationIds: unknown,
    ageMinMonths: 3,
    ageMaxMonths: 12,
  });
  assert.equal(empty.body.meta.total, 0);
  assert.equal(params().get("breedIds"), unknown);
  assert.equal(await selected("Обрані: Породи"), 1);
  assert.equal(await selected("Обрані: Місто або село"), 1);
  assert.equal(
    await page.getByLabel("Вік", { exact: true }).inputValue(),
    "range:3:12",
  );
  pass(
    "Well-formed unknown IDs stay selected and empty; custom direct age range survives UI",
  );
  assert.deepEqual(errors, []);
  pass(
    "No runtime/hydration errors, history loops or duplicate applied fetches",
  );
} finally {
  await context.close();
  await browser.close();
  if (data) await data.cleanup();
  await writeFile(
    "test-results/filter-url-validation.json",
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
  checks.length +
    " URL/history browser checks passed; fixture domain restored.",
);
