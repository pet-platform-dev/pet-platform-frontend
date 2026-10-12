import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingCatalogFixtures } from "./helpers/mating-catalog-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
let f;
const checks = [],
  errors = [],
  requests = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/api/v1/")) requests.push(r.url());
});
async function go(path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
async function results() {
  await page.locator(".mating-public-card").first().waitFor();
  await page.waitForLoadState("networkidle");
}
async function api(params) {
  return await (
    await fetch("http://localhost:4000/api/v1/mating-listings?" + params)
  ).json();
}
async function select(label, text) {
  const combo = page.getByRole("combobox", { name: label, exact: true });
  await combo.click();
  await page.getByRole("option", { name: text, exact: true }).click();
  await page.waitForLoadState("networkidle");
}
async function widths(label, drawer = false) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    if (drawer && width >= 1024) continue;
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow " + width,
    );
    const scope = drawer ? page.locator("dialog[open]") : page.locator("main");
    for (const el of await scope
      .locator("button,a,input:not([type=checkbox]):not([type=radio]),select")
      .all()) {
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      assert.ok(
        b.x >= -1 && b.x + b.width <= width + 1,
        label + " bounds " + width,
      );
      if (
        await el.evaluate(
          (e) =>
            e.matches("button,a,select") && e.getAttribute("role") !== "option",
        )
      )
        assert.ok(b.height >= 43, label + " target " + width);
    }
    await page.screenshot({
      path: "test-results/phase9c-" + label + "-" + width + ".png",
      fullPage: !drawer,
    });
    pass(label + " " + width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingCatalogFixtures();
  const locationQuery = "locationIds=" + f.longLocation.id;
  await go("/listings");
  await page
    .locator("header")
    .first()
    .getByRole("link", { name: "В’язка", exact: true })
    .click();
  await page.waitForURL("**/mating");
  await results();
  assert.equal(await page.locator("main h1").innerText(), "В’язка");
  assert.equal(
    await page.locator("meta[name=robots]").getAttribute("content"),
    "index, follow",
  );
  pass("A desktop navigation opens real public indexable catalog");
  await go("/mating?" + locationQuery);
  await results();
  assert.equal(await page.locator(".mating-public-card").count(), 24);
  assert.equal(
    await page.locator("main").getByText("Без імені", { exact: true }).count(),
    0,
  );
  const publicResponse = await api(locationQuery);
  assert.ok(publicResponse.data.every((r) => r.status === "ACTIVE"));
  assert.ok(
    publicResponse.data.every(
      (r) => !r.owner.email && !r.owner.phone && !r.closedAt,
    ),
  );
  assert.ok(
    publicResponse.data.some((r) => r.fee === null) &&
      publicResponse.data.some((r) => r.fee === "0.00") &&
      publicResponse.data.some((r) => r.fee === "1234.56"),
  );
  pass("ACTIVE projection, 24 cards, optional names + three exact fee modes");
  await widths("catalog");
  await page
    .getByRole("link", { name: "Наступна сторінка", exact: true })
    .click();
  await page.waitForURL((u) => u.searchParams.get("page") === "2");
  await results();
  assert.equal(await page.locator(".mating-public-card").count(), 3);
  pass("pagination page 2 preserves settlement and 24/page");
  await page.goBack();
  await page.waitForURL((u) => u.searchParams.get("page") === null);
  await results();
  await page.goForward();
  await page.waitForURL((u) => u.searchParams.get("page") === "2");
  await page.reload();
  await results();
  assert.equal(await page.locator(".mating-public-card").count(), 3);
  pass("browser Back/Forward/reload restores exact query and page");
  await go("/mating?" + locationQuery);
  await page.getByRole("radio", { name: "Собаки", exact: true }).check();
  await page.waitForURL((u) => u.searchParams.get("species") === "dog");
  const breed = page.getByRole("combobox", { name: /^Породи/ });
  await breed.fill(f.dog.nameUk ?? f.dog.name);
  const breedOption = page
    .locator(".reference-results [role=option]")
    .filter({ hasText: f.dog.nameUk ?? f.dog.name })
    .first();
  await breedOption.waitFor();
  await breedOption.getByRole("button").click();
  await page.waitForURL((u) => u.searchParams.get("breedIds") === f.dog.id);
  await page.getByRole("checkbox", { name: "Самка", exact: true }).check();
  await page.waitForURL((u) => u.searchParams.get("genders") === "FEMALE");
  await results();
  assert.ok(
    (
      await page
        .locator(".mating-public-card .listing-metadata")
        .allTextContents()
    ).every((s) => s.includes("Самка")),
  );
  pass(
    "B species, searchable local breed, gender + settlement combine with AND",
  );
  const shared = page.url();
  const tab = await context.newPage();
  await tab.goto(shared);
  await tab.locator(".mating-public-card").first().waitFor();
  assert.equal(
    await tab.locator(".mating-public-card").count(),
    await page.locator(".mating-public-card").count(),
  );
  assert.equal(
    await tab.getByRole("checkbox", { name: "Самка", exact: true }).isChecked(),
    true,
  );
  await tab.close();
  pass("C shared URL restores same filters and cards");
  await page.getByRole("checkbox", { name: "Самець", exact: true }).check();
  await page.waitForURL((u) => u.searchParams.get("genders")?.includes("MALE"));
  await results();
  assert.ok(
    (
      await page
        .locator(".mating-public-card .listing-metadata")
        .allTextContents()
    ).some((s) => s.includes("Самець")),
  );
  pass("same-group gender OR broadens results");
  await select("Оплата", "Безкоштовно");
  await page.waitForURL((u) => u.searchParams.get("feeMode") === "free");
  await results();
  assert.ok(
    (await page.locator(".listing-price").allTextContents()).every(
      (s) => s === "Безкоштовно",
    ),
  );
  await select("Оплата", "За домовленістю");
  await page.waitForURL((u) => u.searchParams.get("feeMode") === "agreement");
  await results();
  assert.ok(
    (await page.locator(".listing-price").allTextContents()).every(
      (s) => s === "За домовленістю",
    ),
  );
  await select("Оплата", "Фіксована оплата");
  await page.getByLabel("Від", { exact: true }).fill("1234,56");
  await page.getByLabel("До", { exact: true }).fill("1234,56");
  await page.waitForURL(
    (u) =>
      u.searchParams.get("feeMin") === "1234.56" &&
      u.searchParams.get("feeMax") === "1234.56",
  );
  await results();
  assert.ok(
    (await page.locator(".listing-price").allTextContents()).every((s) =>
      s.includes("1 234,56"),
    ),
  );
  pass("fee free/agreement/fixed range preserves exact decimal");
  await select("Сортування", "Ціна: від нижчої");
  await page.waitForURL((u) => u.searchParams.get("sort") === "price_asc");
  await select("Сортування", "Ціна: від вищої");
  await page.waitForURL((u) => u.searchParams.get("sort") === "price_desc");
  await page.getByLabel("Вік", { exact: true }).selectOption("12-24");
  await page.waitForURL((u) => u.searchParams.get("ageMinMonths") === "12");
  await page
    .getByRole("heading", { name: "Оголошень не знайдено", exact: true })
    .waitFor();
  pass("sort options + calendar age filtering + G useful empty state");
  await widths("empty");
  await page
    .getByRole("button", { name: "Очистити фільтри", exact: true })
    .last()
    .click();
  await page.waitForURL("**/mating");
  await results();
  pass("clear resets all filters, page and sort to marketplace defaults");
  const region = page.getByRole("combobox", { name: /^Область/ });
  await region.fill("Кіровоград");
  await page
    .locator(".reference-results [role=option]")
    .filter({ hasText: "Кіровоградська" })
    .first()
    .getByRole("button")
    .click();
  await page.waitForURL((u) => u.searchParams.get("regionIds") === "UA35");
  await results();
  assert.ok(
    (await page.locator(".listing-location").allTextContents()).every((s) =>
      s.includes("Кіровоградська"),
    ),
  );
  pass("region selector filters canonical and legacy regional locations");
  await page
    .getByRole("button", { name: "Очистити фільтри", exact: true })
    .first()
    .click();
  const settlement = page.getByRole("combobox", { name: /^Місто або село/ });
  await settlement.fill("с");
  await page
    .getByText("Введіть щонайменше 2 символи.", { exact: true })
    .waitFor();
  await settlement.fill("Кіровоградська");
  await page
    .getByText("Нічого не знайдено. Спробуйте іншу назву.", { exact: true })
    .waitFor();
  await settlement.fill("сві");
  await page.locator(".reference-results [role=option]").first().waitFor();
  await settlement.fill("Світловодськ");
  await page
    .locator(".reference-results [role=option]")
    .filter({ hasText: "Світловодськ" })
    .first()
    .getByRole("button")
    .click();
  await page.waitForURL((u) => !!u.searchParams.get("locationIds"));
  await results();
  assert.ok(
    (await page.locator(".listing-location").allTextContents()).every((s) =>
      s.includes("Світловодськ"),
    ),
  );
  pass(
    "settlement selector preserves minimum two characters and settlement-name-only search",
  );
  await go("/mating?" + locationQuery);
  await page.setViewportSize({ width: 375, height: 900 });
  const trigger = page.getByRole("button", { name: /^Фільтри/ });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const before = page.url();
  await dialog.getByRole("radio", { name: "Коти", exact: true }).check();
  assert.equal(page.url(), before);
  await page.screenshot({ path: "test-results/phase9c-drawer-375.png" });
  await dialog.getByRole("button", { name: /^(Застосувати|Показати)/ }).click();
  await page.waitForURL((u) => u.searchParams.get("species") === "cat");
  await results();
  assert.equal(await page.locator(".mating-public-card").count(), 1);
  assert.ok(
    (await page.locator(".mating-public-seller").innerText()).includes(
      "Тихий розплідник",
    ),
  );
  pass(
    "D mobile draft applies atomically with accurate cards and breeder identity",
  );
  await trigger.click();
  await dialog.getByRole("button", { name: "Очистити", exact: true }).click();
  assert.ok(page.url().includes("species=cat"));
  await dialog
    .getByRole("button", { name: "Закрити фільтри", exact: true })
    .press("Escape");
  assert.equal(
    await trigger.evaluate((e) => e === document.activeElement),
    true,
  );
  assert.ok(page.url().includes("species=cat"));
  pass("drawer clear/discard + Escape returns keyboard focus");
  await trigger.click();
  const close = dialog.getByRole("button", {
    name: "Закрити фільтри",
    exact: true,
  });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  assert.ok(await dialog.evaluate((d) => d.contains(document.activeElement)));
  await page.keyboard.press("Tab");
  assert.equal(await close.evaluate((e) => e === document.activeElement), true);
  await dialog.getByRole("button", { name: "Очистити", exact: true }).click();
  await dialog.getByRole("button", { name: /^(Застосувати|Показати)/ }).click();
  await page.waitForURL("**/mating");
  pass("drawer Tab trap and Clear Apply reset URL");
  await trigger.click();
  await widths("drawer", true); // resizing to desktop closes the existing native drawer
  await page.setViewportSize({ width: 320, height: 900 });
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Мобільна навігація", exact: true })
    .getByRole("link", { name: "В’язка", exact: true })
    .click();
  await page.waitForURL("**/mating");
  pass("mobile product navigation reaches public catalog");
  await page
    .getByRole("link", { name: "Подати оголошення", exact: true })
    .click();
  await page.waitForURL(
    (u) =>
      u.pathname === "/login" &&
      u.searchParams.get("returnTo") === "/mating/new",
  );
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/mating/new");
  await page.getByRole("combobox", { name: "Тварина", exact: true }).waitFor();
  assert.match(
    await page.locator("meta[name=robots]").getAttribute("content"),
    /noindex/,
  );
  pass("F anonymous owner CTA safely returns to private create after login");
  await go("/mating");
  await page
    .getByRole("link", { name: "Подати оголошення", exact: true })
    .click();
  await page.waitForURL("**/mating/new");
  pass("E authenticated direct create CTA");
  await go("/mating/my");
  await page
    .getByRole("link", { name: "Переглянути в’язку", exact: true })
    .click();
  await page.waitForURL("**/mating");
  pass("owner page public catalog action");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/mating?" + locationQuery);
  const beforeClose = (await api(locationQuery)).meta.total;
  const publicFetches = requests.filter((u) =>
    u.includes("/mating-listings?"),
  ).length;
  await page
    .getByRole("main")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page.waitForURL("**/mating/my");
  await page.locator(`a[href="/mating/${f.rows[0].id}/edit"]`).click();
  await page
    .getByRole("button", { name: "Завершити пошук", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Підтвердити", exact: true })
    .click();
  await page.getByText("Завершено", { exact: true }).waitFor();
  await page
    .locator("header")
    .first()
    .getByRole("link", { name: "В’язка", exact: true })
    .click();
  await page.waitForURL("**/mating");
  await results();
  // Return to the primed filtered key through client navigation, inside staleTime.
  await page.evaluate((query) => {
    history.pushState(null, "", "/mating?" + query);
  }, locationQuery);
  await results();
  assert.equal((await api(locationQuery)).meta.total, beforeClose - 1);
  assert.ok(
    requests.filter((u) => u.includes("/mating-listings?")).length >
      publicFetches,
  );
  assert.equal(
    await page
      .locator(
        `.mating-public-card:has(a[href="/sellers/${f.seller.user.id}"])`,
      )
      .filter({ hasText: f.rows[0].title })
      .count(),
    0,
  );
  assert.match(
    await page.locator(".catalog-count").innerText(),
    new RegExp(String(beforeClose - 1)),
  );
  pass(
    "owner close invalidates cached public filter/page keys during client navigation",
  );
  await go("/mating");
  let blocked, continued;
  const routeContinued = new Promise((resolve) => {
    continued = resolve;
  });
  await page.route("**/mating-listings?*", async (r) => {
    if (new URL(r.request().url()).searchParams.get("feeMode") === "free") {
      await new Promise((resolve) => {
        blocked = () => resolve();
      });
      await r.continue();
      continued();
    } else await r.continue();
  });
  await page.getByRole("combobox", { name: "Оплата", exact: true }).click();
  await page.getByRole("option", { name: "Безкоштовно", exact: true }).click();
  await page
    .getByRole("status", { name: "Завантажуємо оголошення", exact: true })
    .waitFor();
  blocked();
  await routeContinued;
  await results();
  await page.unroute("**/mating-listings?*");
  pass("loading skeleton and stable filter controls");
  await page.route("**/mating-listings?*", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "private diagnostic" }),
    }),
  );
  await go("/mating?feeMode=agreement");
  await page
    .getByText("Не вдалося завантажити оголошення.", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByText("private diagnostic", { exact: true }).count(),
    0,
  );
  await page.unroute("**/mating-listings?*");
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await results();
  pass("compact safe error and retry");
  await go("/mating?" + locationQuery);
  const localRequests = requests.filter((u) => u.includes("/mating-listings?"));
  assert.ok(localRequests.length);
  assert.equal(
    requests.filter((u) => /\/api\/v1\/(?:sellers|pets)\/[0-9a-f-]{36}/.test(u))
      .length,
    0,
  );
  pass("no per-card seller/Pet/breed/location detail requests");
  assert.deepEqual(errors, []);
  pass("zero browser runtime errors");
  await writeFile(
    "test-results/phase9c-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/phase9c-failure.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/phase9c-failure.txt",
    e.stack + "\n" + (await page.locator("body").innerText()),
  );
  throw e;
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
