import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingCatalogFixtures } from "./helpers/mating-catalog-fixtures.mjs";
import { selectFormOption } from "./helpers/select-form-option.mjs";
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
let f, ownerAuthorization;
page.on("request", (r) => {
  if (f && r.url().endsWith("/mating-listings/" + f.active.id))
    ownerAuthorization = r.headers().authorization;
});
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => {
  const response = await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
  return response;
};
try {
  await mkdir("test-results", { recursive: true });
  f = await matingCatalogFixtures();
  await f.db.sellerProfile.create({
    data: {
      userId: f.seller.user.id,
      phone: "+380501234567",
      telegram: "seller_fixture",
    },
  });
  await f.db.breederProfile.create({
    data: { userId: f.full.user.id, kennelName: "Royal Malinois" },
  });
  await f.db.pet.update({
    where: { id: f.breeder.id },
    data: { showOnBreederProfile: true },
  });
  const breederRow = await f.db.matingListing.create({
    data: {
      ownerId: f.full.user.id,
      title: "Оголошення про в’язку",
      petId: f.breeder.id,
      locationId: f.location.id,
      description: "Публічні умови розплідника.",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
      price: "1234.56",
    },
  });
  const catalog =
    "/mating?locationIds=" + f.longLocation.id + "&sort=price_desc&page=2";
  await go(catalog);
  const link = page.locator(".mating-public-card .listing-card-link").first();
  const detailHref = await link.getAttribute("href");
  assert.ok(detailHref.startsWith("/mating/"));
  await link.click();
  await page
    .locator(".mating-detail-summary, .mating-detail .listing-detail-summary")
    .waitFor();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page
      .getByRole("link", { name: "← До оголошень про в’язку", exact: true })
      .getAttribute("href"),
    catalog,
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("link", { name: "← До оголошень про в’язку", exact: true })
    .click();
  await page.waitForURL("**" + catalog);
  pass("filtered catalog page 2 → detail → refresh → exact catalog return");
  for (const [n, text] of [
    [0, "За домовленістю"],
    [1, "Безкоштовно"],
    [2, "1 234,56 ₴"],
  ]) {
    await go("/mating/" + f.rows[n].id);
    assert.equal(await page.locator(".listing-detail-price").innerText(), text);
    assert.equal(
      await page.locator(".listing-back-link").getAttribute("href"),
      "/mating",
    );
    pass("ACTIVE detail fee " + text);
  }
  await go("/mating/" + f.active.id + "?returnTo=https%3A%2F%2Fevil.test");
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    "/mating",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Переглянути профіль тварини", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Зв’язатися через Telegram", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Зв’язатися через Viber", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Зв’язатися через WhatsApp", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Показати телефон", exact: true })
    .click();
  assert.equal(
    await page
      .locator('a[href="tel:+380501234567"]')
      .evaluate((n) => n === document.activeElement),
    true,
  );
  assert.ok(
    !(await page.locator("main").innerText()).includes(f.seller.user.email),
  );
  pass(
    "safe return fallback, SELLER full name, configured contacts, phone reveal focus, private email absent",
  );
  await go("/mating/" + breederRow.id);
  const card = page.getByRole("region", { name: "Розплідник", exact: true });
  assert.equal(
    await card.locator(".listing-seller-name").innerText(),
    "Royal Malinois",
  );
  assert.ok((await card.innerText()).includes("Олександр Єпік"));
  assert.equal(await card.locator(".seller-contacts .button").count(), 4);
  await page
    .getByRole("link", { name: "Переглянути профіль тварини", exact: true })
    .click();
  await page.waitForURL("**/pets/" + f.breeder.id);
  await page.locator(".public-pet-profile").waitFor();
  pass(
    "BREEDER kennel/full-name identity, four configured contacts, valid public Pet CTA",
  );
  await f.db.pet.update({
    where: { id: f.breeder.id },
    data: { showOnBreederProfile: false },
  });
  await go("/mating/" + breederRow.id);
  assert.equal(
    await page
      .getByRole("link", { name: "Переглянути профіль тварини", exact: true })
      .count(),
    0,
  );
  pass("private Pet has no dead public profile CTA");
  const publicDTO = await (
    await fetch(
      "http://localhost:4000/api/v1/mating-listings/" +
        breederRow.id +
        "/public",
    )
  ).json();
  assert.doesNotMatch(
    JSON.stringify(publicDTO),
    /email|passwordHash|chipNumber|privateNotes|publicId|storageKey|cloudinaryId/,
  );
  pass(
    "actual public DTO omits private Pet, email and provider/storage fields",
  );
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(await page.locator("main h1").count(), 1);
    for (const button of await page
      .locator("main .button, main .listing-back-link")
      .all())
      assert.ok((await button.boundingBox()).height >= 44);
    await page.screenshot({
      path: `test-results/phase9d-detail-${width}.png`,
      fullPage: true,
    });
    pass("detail hierarchy, contacts and no overflow " + width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await go("/mating/" + f.active.id);
  assert.equal(await page.locator(".seller-contacts").count(), 0);
  assert.equal(
    await page
      .getByRole("heading", { name: "Зв’язатися з власником", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("link", { name: "Редагувати оголошення", exact: true })
    .click();
  await page.waitForURL("**/mating/" + f.active.id + "/edit");
  await page.getByLabel("Опис", { exact: true }).waitFor();
  pass("owner detail suppresses self contacts and opens protected edit flow");
  const inactive = await f.db.matingListing.findMany({
    where: {
      ownerId: f.seller.user.id,
      status: { in: ["DRAFT", "CLOSED", "ARCHIVED"] },
    },
    distinct: ["status"],
  });
  let unavailable;
  for (const id of [
    ...inactive.map((r) => r.id),
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ]) {
    await go("/mating/" + id);
    const text = await page.locator("main").innerText();
    assert.ok(text.includes("Оголошення не знайдено"));
    assert.doesNotMatch(text, /DRAFT|CLOSED|ARCHIVED|Чернетка/);
    if (unavailable) assert.equal(text, unavailable);
    else unavailable = text;
  }
  pass("DRAFT/CLOSED/ARCHIVED/nonexistent share identical safe unavailable UX");
  await go("/mating/" + f.active.id);
  await page.route("**/mating-listings/" + f.active.id + "/public", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "unavailable" }),
    }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  // Explicit blur/focus triggers stale public query revalidation.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .waitFor();
  await page.unroute("**/mating-listings/" + f.active.id + "/public");
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await page.locator(".listing-detail-summary").waitFor();
  pass("public detail failure hides stale content and retry restores it");
  assert.ok(ownerAuthorization, "owner edit request uses authenticated API");
  const csrfResponse = await context.request.get(
    "http://localhost:4000/api/v1/auth/csrf",
    { headers: { Origin: "http://localhost:3000" } },
  );
  assert.equal(csrfResponse.status(), 200);
  const csrf = (await csrfResponse.json()).data.csrfToken;
  for (const action of ["close", "archive"]) {
    const response = await context.request.post(
      "http://localhost:4000/api/v1/mating-listings/" +
        f.active.id +
        "/" +
        action,
      {
        headers: {
          Authorization: ownerAuthorization,
          Origin: "http://localhost:3000",
          "X-CSRF-Token": csrf,
        },
        data: {},
      },
    );
    assert.equal(response.status(), 200);
    assert.equal(
      (
        await fetch(
          "http://localhost:4000/api/v1/mating-listings/" +
            f.active.id +
            "/public",
        )
      ).status,
      404,
    );
    await go("/mating/" + f.active.id);
    assert.ok(
      (await page.locator("main").innerText()).includes(
        "Оголошення не знайдено",
      ),
    );
  }
  pass(
    "authenticated close/archive immediately conceals previously viewed public detail",
  );
  await go("/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Увійти", exact: true })
    .first()
    .waitFor();
  await go("/mating/" + f.rows[0].id);
  assert.equal(
    await page
      .getByRole("link", { name: "Редагувати оголошення", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Показати телефон", exact: true })
      .count(),
    1,
  );
  pass("logout removes owner CTA and restores configured public contacts");

  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await go(
      "/listings?type=SALE&gender=MALE&ageMinMonths=13&ageMaxMonths=47&sort=oldest&page=2",
    );
    const mobile = width < 1024;
    if (mobile) await page.getByRole("button", { name: /^Фільтри/ }).click();
    const scope = mobile
      ? page.getByRole("dialog")
      : page.locator(".listing-filters-panel");
    assert.equal(await scope.locator("select").count(), 0);
    for (const [label, value] of [
      ["Тип оголошення", "SALE"],
      ["Стать", "MALE"],
      ["Вік", "range:13:47"],
    ]) {
      const combo = scope.getByRole("combobox", { name: label, exact: true });
      assert.equal(await combo.getAttribute("data-value"), value);
      assert.equal(await combo.locator("svg").count(), 1);
      await combo.focus();
      await page.keyboard.press("End");
      assert.ok(await combo.getAttribute("aria-activedescendant"));
      await page.keyboard.press("Escape");
      assert.equal(
        await combo.evaluate((n) => n === document.activeElement),
        true,
      );
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `test-results/phase9d-dropdowns-${width}.png`,
      fullPage: !mobile,
    });
    if (mobile) await page.keyboard.press("Escape");
    pass(
      "marketplace custom controls restore URL, keyboard focus and geometry " +
        width,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/listings");
  for (const [label, value, parameter] of [
    ["Тип оголошення", "FREE", "type"],
    ["Стать", "FEMALE", "gender"],
    ["Вік", "12-24", "ageMinMonths"],
  ]) {
    await selectFormOption(page, label, value);
    await page.waitForFunction(
      ([parameter, value]) =>
        new URLSearchParams(location.search).get(parameter) === value,
      [parameter, parameter === "ageMinMonths" ? "12" : value],
    );
  }
  await selectFormOption(page, "Сортування", "oldest");
  await page.waitForURL("**sort=oldest*");
  pass("marketplace type/gender/age/sort custom selections update URL");
  assert.deepEqual(errors, []);
  pass("zero browser runtime errors");
  await writeFile(
    "test-results/phase9d-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/phase9d-failure.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/phase9d-failure.txt",
    e.stack + "\n" + (await page.locator("body").innerText()),
  );
  throw e;
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
