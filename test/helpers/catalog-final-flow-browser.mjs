import { selectFormOption } from "./select-form-option.mjs";
import assert from "node:assert/strict";
import { chooseCatalogSort } from "./catalog-sort-browser.mjs";
const widths = [320, 375, 430, 768, 1024, 1280, 1440];
export async function verifyCatalogGeometry(page, route, pass) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(await page.locator("main h1").count(), 1);
    if (route === "complex" && width < 1024)
      assert.equal(
        await page.locator(".mobile-filters-trigger").innerText(),
        "Фільтри (7)",
      );
    await page.screenshot({
      path: `test-results/phase6e-${route}-${width}.png`,
    });
  }
  pass(
    `${route}: 320/375/430/768/1024/1280/1440px has one heading, no page overflow, stable content grid`,
  );
}
export async function verifyFinalCatalogFlows({
  page,
  data,
  catalog,
  preview,
  pick,
  open,
  close,
  dialog,
  applyButton,
  catalogRequests,
  pass,
}) {
  const search = () => page.getByLabel("Пошук оголошень", { exact: true });
  const base = "http://localhost:3000";
  await page.goto(base + "/listings?q=" + data.marker);
  await catalog({ q: data.marker, page: 1, sort: "newest" });
  await page.setViewportSize({ width: 375, height: 812 });
  const before = await page.evaluate(() => history.length),
    beforeRequests = catalogRequests();
  await search().fill(data.marker + "pending");
  await open();
  await page.waitForTimeout(700);
  assert.equal(await dialog().isVisible(), true);
  assert.equal(
    new URL(page.url()).searchParams.get("q"),
    data.marker + "pending",
  );
  assert.equal(await page.evaluate(() => history.length), before);
  await catalog({ q: data.marker + "pending", page: 1 });
  assert.equal(catalogRequests(), beforeRequests + 1);
  await preview({ q: data.marker + "pending" });
  await close();
  pass(
    "Opening mobile Filters flushes pending search with replace once; drawer stays open and preview/catalog agree",
  );
  await search().fill(data.marker);
  await catalog({ q: data.marker, page: 1 });
  await chooseCatalogSort(page, "price_asc");
  await catalog({ q: data.marker, sort: "price_asc", page: 1 });
  await open();
  const draftCatalogRequests = catalogRequests(),
    initialUrl = page.url();
  await dialog().getByRole("radio", { name: "Собаки", exact: true }).check();
  for (const breed of data.fixture.breeds.slice(0, 2))
    await pick(/^Породи/, data.marker, breed.nameUk, dialog());
  await pick(
    /^Область/,
    "Кіровоградська",
    data.fixture.locations[0].region,
    dialog(),
  );
  await pick(
    /^Область/,
    "Полтавська",
    data.fixture.locations[1].region,
    dialog(),
  );
  for (const location of data.fixture.locations)
    await pick(/^Місто або село/, "Однакова назва", location.region, dialog());
  await selectFormOption(dialog(), "Тип оголошення", "SALE");
  await selectFormOption(dialog(), "Стать", "MALE");
  await selectFormOption(dialog(), "Вік", "0-3");
  await dialog().getByLabel("Від", { exact: true }).fill("100,01");
  await dialog().getByLabel("До", { exact: true }).fill("1000");
  const expected = {
    q: data.marker,
    species: "dog",
    breedIds: data.fixture.breeds
      .slice(0, 2)
      .map((i) => i.id)
      .sort()
      .join(","),
    regionIds: "UA35,UA53",
    locationIds: data.fixture.locations
      .map((i) => i.id)
      .sort()
      .join(","),
    type: "SALE",
    gender: "MALE",
    ageMinMonths: 0,
    ageMaxMonths: 3,
    priceMin: "100.01",
    priceMax: "1000",
  };
  await preview({ ...expected, sort: "newest" });
  assert.equal(page.url(), initialUrl);
  assert.equal(catalogRequests(), draftCatalogRequests);
  await applyButton().click();
  const result = await catalog({ ...expected, page: 1, sort: "price_asc" });
  assert.ok(result.body.meta.total > 24);
  assert.equal(catalogRequests(), draftCatalogRequests + 1);
  assert.equal(
    await page.locator(".mobile-filters-trigger").innerText(),
    "Фільтри (7)",
  );
  const complexUrl = page.url();
  await open();
  assert.equal(
    await dialog()
      .getByRole("list", { name: "Обрані: Місто або село", exact: true })
      .locator("li")
      .count(),
    2,
  );
  await selectFormOption(dialog(), "Вік", "60+");
  await close();
  assert.equal(page.url(), complexUrl);
  assert.equal(catalogRequests(), draftCatalogRequests + 1);
  pass(
    "Mobile full multi-breed/region/same-name settlements + age/price Apply sends one query; draft Cancel preserves exact URL/count",
  );
  await page.getByRole("link", { name: "Сторінка 2", exact: true }).click();
  await catalog({ ...expected, page: 2, sort: "price_asc" });
  const pageTwoUrl = page.url();
  await page.locator(".catalog-results .listing-card-link").first().click();
  await page.locator(".listing-back-link").waitFor();
  await page.reload();
  await page.locator(".listing-back-link").waitFor();
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    new URL(pageTwoUrl).pathname + new URL(pageTwoUrl).search,
  );
  await page.locator(".listing-back-link").click();
  await catalog({ ...expected, page: 2, sort: "price_asc" });
  assert.equal(page.url(), pageTwoUrl);
  pass(
    "Mobile complex page two → detail refresh → return preserves full conditions and page",
  );
  await open();
  await dialog().getByRole("button", { name: "Очистити", exact: true }).click();
  await applyButton().click();
  await catalog({ q: undefined, page: 1, sort: "newest" });
  assert.equal(page.url(), base + "/listings");
  pass(
    "Mobile complex Clear+Apply resets every condition, page, search and sort",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await search().fill(data.fixture.breeds[0].nameUk);
  const ukrainian = await catalog({
    q: data.fixture.breeds[0].nameUk,
    page: 1,
  });
  assert.ok(ukrainian.body.meta.total > 0);
  const searchUrl = page.url();
  await page.locator(".catalog-results .listing-card-link").first().click();
  await page.locator(".listing-back-link").waitFor();
  await page.locator(".listing-back-link").click();
  await catalog({ q: data.fixture.breeds[0].nameUk, page: 1 });
  assert.equal(page.url(), searchUrl);
  await page.goBack();
  await page.locator(".listing-back-link").waitFor();
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    new URL(searchUrl).pathname + new URL(searchUrl).search,
  );
  await page.goForward();
  await catalog({ q: data.fixture.breeds[0].nameUk, page: 1 });
  pass(
    "Literal Ukrainian breed-name search round-trips through detail return and Back/Forward",
  );
  let release, intercepted, handled;
  const finished = new Promise((resolve) => {
    handled = resolve;
  });
  const ready = new Promise((resolve) => {
    intercepted = resolve;
  });
  const loadingQ = data.marker + "loading";
  const hold = async (route) => {
    const url = new URL(route.request().url());
    const held =
      url.searchParams.get("limit") === "24" &&
      url.searchParams.get("q") === loadingQ;
    if (held)
      await new Promise((resolve) => {
        release = resolve;
        intercepted();
      });
    try {
      await route.continue();
    } finally {
      if (held) handled();
    }
  };
  await page.route("**/api/v1/listings?**", hold);
  try {
    await search().fill(loadingQ);
    await Promise.race([
      ready,
      page.waitForTimeout(20_000).then(() => {
        throw new Error("Loading test did not intercept its isolated request");
      }),
    ]);
    await page.locator(".catalog-results .listing-skeleton").first().waitFor();
    assert.equal(await page.locator("main h1").isVisible(), true);
    assert.equal(
      await page.locator(".listing-filters-panel").isVisible(),
      true,
    );
    assert.equal(
      await page
        .locator(".catalog-results .listing-card:not(.listing-skeleton)")
        .count(),
      0,
    );
    await page
      .getByRole("status")
      .filter({ hasText: "Завантажуємо" })
      .first()
      .waitFor();
    pass(
      "Delayed filter response keeps the page/controls and one coherent skeleton while hiding stale cards",
    );
  } finally {
    release?.();
    if (release) await finished;
    await page.unroute("**/api/v1/listings?**", hold);
  }
  await catalog({ q: loadingQ, page: 1 });
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page
        .getByRole("heading", {
          name: "За вибраними параметрами оголошень не знайдено.",
          exact: true,
        })
        .isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(await page.locator(".catalog-clear").isVisible(), true);
    await page.screenshot({ path: `test-results/phase6e-empty-${width}.png` });
  }
  await page.locator(".catalog-clear").click();
  await catalog({ q: undefined, page: 1, sort: "newest" });
  assert.equal(page.url(), base + "/listings");
  pass(
    "Zero results remain intentional across all seven widths; Clear returns to the default catalog",
  );
  const unavailable = (route) => route.abort("connectionrefused");
  await page.route("**/api/v1/listings?**", unavailable);
  await search().fill(data.marker + "unavailable");
  await page
    .getByRole("heading", {
      name: "Не вдалося завантажити оголошення.",
      exact: true,
    })
    .waitFor();
  assert.equal(await search().inputValue(), data.marker + "unavailable");
  assert.equal(await page.locator(".listing-filters-panel").isVisible(), true);
  assert.equal(
    await page
      .locator(".catalog-state")
      .innerText()
      .then((t) => /ECONN|stack|connectionrefused|Prisma/.test(t)),
    false,
  );
  await page.unroute("**/api/v1/listings?**", unavailable);
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await catalog({ q: data.marker + "unavailable", page: 1 });
  pass(
    "Connection failure keeps chosen search/controls, reveals no raw diagnostics, and Retry recovers against real API",
  );
}
