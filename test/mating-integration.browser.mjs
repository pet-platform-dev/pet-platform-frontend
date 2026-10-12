import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingCatalogFixtures } from "./helpers/mating-catalog-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  checks = [],
  errors = [],
  requests = [];
let f, token;
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400 && r.url().includes("localhost:4000"))
    console.log("HTTP", r.status(), new URL(r.url()).pathname);
});
page.on("request", (r) => {
  if (r.url().includes("localhost:4000/api/v1/")) requests.push(r.url());
  if (r.headers().authorization) token = r.headers().authorization;
});
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const go = async (path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
async function refocus() {
  await page.bringToFront();
  console.log(
    "VISIBILITY",
    await page.evaluate(() => document.visibilityState),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
}
async function login(user, keepPage = false) {
  if (!keepPage) await go("/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
}
async function logout(keepPage = false) {
  if (!keepPage) await go("/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Увійти", exact: true })
    .first()
    .waitFor();
}
async function mutation(id, action) {
  assert.ok(token);
  const csrfResponse = await context.request.get(
    "http://localhost:4000/api/v1/auth/csrf",
    { headers: { Origin: "http://localhost:3000" } },
  );
  assert.equal(csrfResponse.status(), 200);
  const csrf = (await csrfResponse.json()).data.csrfToken;
  const response = await context.request.post(
    "http://localhost:4000/api/v1/mating-listings/" + id + "/" + action,
    {
      headers: {
        Authorization: token,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": csrf,
      },
      data: {},
    },
  );
  assert.equal(response.status(), 200);
}
async function geometry(path, label) {
  await go(path);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    assert.ok(size.scroll <= size.width + 1, label + " overflow " + width);
    const profileGrid = page.locator(".profile-mating-section .listings-grid");
    if (await profileGrid.count()) {
      const columns = await profileGrid.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
      assert.equal(
        columns,
        width >= 1024 ? 3 : width >= 768 ? 2 : 1,
        label + " shared grid " + width,
      );
    }
    for (const action of await page
      .locator(
        ".pet-mating-actions .button, .profile-mating-section .button, .public-pet-profile .button, .mating-detail .button, .mating-editor .button",
      )
      .all()) {
      const box = await action.boundingBox();
      if (box) assert.ok(box.height >= 44, label + " touch " + width);
    }
    pass(label + " responsive " + width);
    if ([320, 1440].includes(width)) {
      await page.screenshot({
        path: "test-results/phase9e-" + label + "-" + width + ".png",
        fullPage: true,
      });
      await page.screenshot({
        path: "test-results/phase9e-" + label + "-" + width + "-viewport.png",
      });
      const mating = page.locator(".profile-mating-section");
      if (await mating.count()) {
        await mating.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: "test-results/phase9e-" + label + "-" + width + "-mating.png",
        });
      }
    }
  }
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingCatalogFixtures();
  await f.db.pet.update({
    where: { id: f.known.id },
    data: { createdAt: new Date(Date.now() + 200000) },
  });
  await f.db.pet.update({
    where: { id: f.competing.id },
    data: { createdAt: new Date(Date.now() + 190000) },
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
      petId: f.breeder.id,
      locationId: f.location.id,
      title: "В’язка",
      description: "Умови в’язки розплідника.",
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
  await f.db.listing.create({
    data: {
      sellerId: f.full.user.id,
      petId: f.breeder.id,
      locationId: f.location.id,
      title: "Оголошення розплідника",
      description: "Публічний опис.",
      type: "FREE",
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
  await login(f.seller.user);
  requests.length = 0;
  await go("/pets");
  assert.equal(
    requests.filter((r) => r.includes("/mating-listings")).length,
    0,
  );
  await page
    .getByRole("link", { name: "Знайти пару: Рекс", exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Тварина", exact: true })
      .getAttribute("data-value"),
    f.known.id,
  );
  assert.match(page.url(), /petId=/);
  pass("owned Pet CTA preselects without per-Pet mating requests");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Спокійний характер. Умови обговорюються з власником.");
  const location = page.getByRole("combobox", {
    name: "Місце в’язки",
    exact: true,
  });
  await location.fill(f.location.city);
  await page
    .getByRole("option")
    .filter({ hasText: f.location.city })
    .first()
    .waitFor();
  await location.press("ArrowDown");
  await location.press("Enter");
  const created = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" && r.url().endsWith("/mating-listings"),
  );
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  const createdResponse = await created;
  assert.equal(createdResponse.status(), 201);
  const row = (await createdResponse.json()).data;
  await page.waitForURL("**/mating/" + row.id + "/edit?*");
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator(".back-link").getAttribute("href"), "/pets");
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page.getByText("Оголошення опубліковано.", { exact: true }).waitFor();
  await page.locator(".back-link").click();
  await page.waitForURL("**/pets");
  await page.waitForLoadState("networkidle");
  const ownCard = page
    .locator(".pet-card")
    .filter({ has: page.getByRole("heading", { name: "Рекс", exact: true }) });
  const currentPetResponse = await context.request.get(
    "http://localhost:4000/api/v1/pets/" + f.known.id,
    { headers: { Authorization: token } },
  );
  assert.deepEqual((await currentPetResponse.json()).data.activeMatingListing, {
    id: row.id,
    status: "ACTIVE",
  });
  await ownCard
    .getByText("Активне оголошення про в’язку", { exact: true })
    .waitFor();
  assert.equal(
    await ownCard
      .getByRole("link", { name: "Знайти пару: Рекс", exact: true })
      .count(),
    0,
  );
  pass("draft save/publish updates Pet summary and owner return context");
  await go("/mating/new?petId=" + f.breeder.id);
  assert.equal(
    await page
      .getByRole("combobox", { name: "Тварина", exact: true })
      .getAttribute("data-value"),
    "",
  );
  await go("/mating/new?petId=" + f.unknown.id);
  assert.ok(
    await page
      .getByRole("button", { name: "Зберегти чернетку", exact: true })
      .isDisabled(),
  );
  assert.ok(
    (await page.locator("main").innerText()).includes("вкажіть стать тварини"),
  );
  pass("foreign preselection ignored and UNKNOWN eligibility preserved");
  await go("/mating/new?petId=" + f.known.id);
  await page
    .getByText("Для цієї тварини вже є активне оголошення про в’язку.", {
      exact: true,
    })
    .waitFor();
  pass("stale creation CTA encounters ACTIVE conflict safely");
  await geometry("/pets", "owner-pets");
  await geometry("/mating/new?petId=" + f.known.id, "preselection");
  await logout();
  requests.length = 0;
  await go("/sellers/" + f.seller.user.id + "?matingPage=2");
  const section = page.locator(".profile-mating-section");
  await section.locator(".mating-public-card").first().waitFor();
  assert.equal(
    requests.filter((r) =>
      r.includes("/sellers/" + f.seller.user.id + "/mating-listings"),
    ).length,
    1,
  );
  await section.locator(".listing-card-link").first().click();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    "/sellers/" + f.seller.user.id + "?matingPage=2",
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.locator(".listing-back-link").click();
  await page.waitForURL("**/sellers/" + f.seller.user.id + "?matingPage=2");
  await page.waitForLoadState("networkidle");
  assert.match(page.url(), /matingPage=2/);
  pass(
    "seller collection is bounded and profile page 2 survives detail refresh/return",
  );
  await section.locator(".mating-public-card").first().waitFor();
  const sellerApi =
    "**/api/v1/sellers/" + f.seller.user.id + "/mating-listings**";
  await page.route(sellerApi, (route) =>
    route.fulfill({
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
      },
      contentType: "application/json",
      body: "{}",
    }),
  );
  await refocus();
  await section.getByRole("alert").waitFor();
  assert.equal(await section.locator(".mating-public-card").count(), 0);
  await page.unroute(sellerApi);
  await section.getByRole("button", { name: "Спробувати ще раз" }).click();
  await section.locator(".mating-public-card").first().waitFor();
  pass(
    "profile refetch error conceals stale ACTIVE cards and retry restores them",
  );
  await f.db.matingListing.updateMany({
    where: { id: { in: f.rows.slice(0, 8).map((r) => r.id) } },
    data: { status: "CLOSED" },
  });
  await go("/sellers/" + f.seller.user.id + "?matingPage=2");
  await page.waitForURL("**/sellers/" + f.seller.user.id);
  await section.locator(".mating-public-card").first().waitFor();
  pass(
    "shrinking profile page 2 recovers page 1 instead of omitting live entries",
  );
  await go("/sellers/" + f.full.user.id);
  for (const text of [
    "Наші тварини",
    "Оголошення розплідника",
    "Оголошення про в’язку",
  ])
    await page.getByRole("heading", { name: text, exact: true }).waitFor();
  const titles = await page.locator("main h2").allTextContents();
  assert.ok(
    titles.indexOf("Наші тварини") < titles.indexOf("Оголошення розплідника"),
  );
  assert.ok(
    titles.indexOf("Оголошення розплідника") <
      titles.indexOf("Оголошення про в’язку"),
  );
  pass(
    "breeder animals, ordinary listings, mating and reviews remain distinct",
  );
  requests.length = 0;
  await go("/pets/" + f.breeder.id);
  assert.equal(
    requests.filter((r) => r.includes("/mating-listings")).length,
    0,
  );
  const publicPetApi = "**/api/v1/pets/" + f.breeder.id + "/public";
  const withoutJs = await browser.newContext({ javaScriptEnabled: false });
  const serverPet = await withoutJs.newPage();
  await serverPet.goto("http://localhost:3000/pets/" + f.breeder.id);
  assert.ok(await serverPet.locator(".public-pet-profile").isVisible());
  assert.ok(
    await serverPet.getByText("Тварина заводчика", { exact: true }).isVisible(),
  );
  assert.ok(
    await serverPet
      .getByRole("link", {
        name: "Переглянути оголошення про в’язку",
        exact: true,
      })
      .isVisible(),
  );
  await withoutJs.close();
  pass(
    "fresh public Pet content and mating CTA remain server-rendered without JavaScript",
  );
  await go("/pets/" + f.breeder.id);
  await page
    .getByRole("link", {
      name: "Переглянути оголошення про в’язку",
      exact: true,
    })
    .waitFor();
  let releaseFailure;
  const blockedFailure = new Promise((resolve) => {
    releaseFailure = resolve;
  });
  await page.route(publicPetApi, async (route) => {
    await blockedFailure;
    await route.fulfill({
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
      },
      contentType: "application/json",
      body: "{}",
    });
  });
  await refocus();
  await page.locator(".listing-detail-skeleton").waitFor();
  assert.equal(
    await page
      .getByRole("link", {
        name: "Переглянути оголошення про в’язку",
        exact: true,
      })
      .count(),
    0,
  );
  releaseFailure();
  await page.getByRole("button", { name: "Спробувати ще раз" }).waitFor();
  assert.equal(
    await page
      .getByRole("link", {
        name: "Переглянути оголошення про в’язку",
        exact: true,
      })
      .count(),
    0,
  );
  await page.unroute(publicPetApi);
  await page.getByRole("button", { name: "Спробувати ще раз" }).click();
  await page
    .getByRole("link", {
      name: "Переглянути оголошення про в’язку",
      exact: true,
    })
    .waitFor();
  pass(
    "public Pet refetch failure hides cached CTA and retry restores fresh public data",
  );
  await page
    .getByRole("link", {
      name: "Переглянути оголошення про в’язку",
      exact: true,
    })
    .press("Enter");
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    "/pets/" + f.breeder.id,
  );
  await page.locator(".listing-back-link").click();
  await page.waitForURL("**/pets/" + f.breeder.id);
  await page.waitForLoadState("networkidle");
  pass(
    "public Pet summary uses no extra mating lookup and returns from detail",
  );
  await geometry("/pets/" + f.breeder.id, "public-pet");
  await geometry("/sellers/" + f.seller.user.id, "seller");
  await geometry("/sellers/" + f.full.user.id, "breeder");
  await geometry("/mating/" + breederRow.id, "detail");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(f.seller.user);
  await go("/mating/" + row.id + "/edit");
  await page
    .getByRole("button", { name: "Завершити пошук", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Підтвердити", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await go("/pets");
  await page
    .getByRole("link", { name: "Знайти пару: Рекс", exact: true })
    .waitFor();
  pass("close removes owner ACTIVE state");
  let releasePrivate, capturedPrivate;
  const latePrivate = new Promise((resolve) => {
    releasePrivate = resolve;
  });
  const captured = new Promise((resolve) => {
    capturedPrivate = resolve;
  });
  const ownedPetsApi = "**/api/v1/pets/me?*";
  await page.route(ownedPetsApi, async (route) => {
    const response = await route.fetch();
    capturedPrivate();
    await latePrivate;
    await route.fulfill({ response }).catch(() => {}); // Aborted transport after logout is expected.
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await captured;
  await page.locator('header a[href="/account"]').first().click();
  await page.waitForURL("**/account");
  await logout(true);
  await page.waitForURL("**/login");
  await login(f.full.user, true);
  releasePrivate();
  await page.unroute(ownedPetsApi);
  pass(
    "delayed user A Pet response cannot repopulate private state after SPA logout/login B",
  );
  await go("/profile/breeder/animals");
  assert.equal(
    await page
      .getByRole("link", {
        name: "Редагувати оголошення про в’язку: Тварина заводчика",
        exact: true,
      })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Знайти пару: Рекс", exact: true })
      .count(),
    0,
  );
  pass("account switch has only current user Pet and mating state");
  await geometry("/profile/breeder/animals", "owner-breeder");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/mating/" + breederRow.id + "/edit");
  await mutation(breederRow.id, "close");
  await go("/pets/" + f.breeder.id);
  assert.equal(
    await page
      .getByRole("link", {
        name: "Переглянути оголошення про в’язку",
        exact: true,
      })
      .count(),
    0,
  );
  await go("/sellers/" + f.full.user.id);
  assert.equal(await page.locator(".profile-mating-section").count(), 0);
  assert.ok(
    await page
      .getByRole("heading", { name: "Оголошення розплідника", exact: true })
      .isVisible(),
  );
  pass(
    "close omits public Pet and breeder mating sections without hiding ordinary listings",
  );
  await mutation(breederRow.id, "archive");
  await go("/mating/" + breederRow.id);
  assert.ok(
    (await page.locator("main").innerText()).includes("Оголошення не знайдено"),
  );
  pass("archive stays safely unavailable");
  await f.db.pet.update({
    where: { id: f.breeder.id },
    data: { showOnBreederProfile: false },
  });
  await go("/pets/" + f.breeder.id);
  assert.equal(await page.locator(".public-pet-profile").count(), 0);
  pass("withdrawn Pet consent conceals public profile");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  pass("zero browser runtime errors");
  await writeFile(
    "test-results/phase9e-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (error) {
  console.log(
    "FAIL PAGE",
    page.url(),
    await page
      .locator("main")
      .innerText()
      .catch(() => "Unavailable"),
  );
  await page.screenshot({
    path: "test-results/phase9e-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await context.close();
  await browser.close();
  if (f) await f.cleanup();
}
