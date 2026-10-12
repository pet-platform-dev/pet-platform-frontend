import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
import { ListingsService } from "../../pet-platform-backend/dist/src/listings/listings.service.js";
import { MatingListingsService } from "../../pet-platform-backend/dist/src/mating-listings/mating-listings.service.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const publicPage = await browser.newPage();
const checks = [],
  errors = [],
  network = {};
let f;
page.on("pageerror", (e) => errors.push(e.message));
publicPage.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    r.method() !== "OPTIONS" &&
    r.url().startsWith("http://localhost:4000/api/v1/")
  ) {
    const key = new URL(r.url()).pathname;
    network[key] = (network[key] ?? 0) + 1;
  }
});
function pass(label) {
  checks.push(label);
  console.log("PASS " + label);
}
async function go(path, target = page) {
  await target.goto("http://localhost:3000" + path);
  await target.waitForLoadState("networkidle");
}
async function login(actor, target = "/account") {
  await go("/login?" + new URLSearchParams({ returnTo: target }));
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**" + target);
  await page.waitForLoadState("networkidle");
}
async function location() {
  const combo = page.getByPlaceholder("Введіть назву міста або села");
  await combo.fill(f.location.city);
  const option = page
    .getByRole("option")
    .filter({ hasText: f.location.city })
    .first();
  await option.waitFor();
  await option.click();
}
async function decision(kind, id, action) {
  const table = kind === "listings" ? f.db.listing : f.db.matingListing;
  const row = await table.findUniqueOrThrow({ where: { id } });
  const service =
    kind === "listings"
      ? new ListingsService(f.db, null, null)
      : new MatingListingsService(f.db);
  return service.moderate(id, row.updatedAt, action);
}
async function status(text) {
  await page
    .locator(".publication-state .listing-status")
    .filter({ hasText: text })
    .first()
    .waitFor();
}
async function absent(kind, id) {
  const response = await publicPage.request.get(
    `http://localhost:4000/api/v1/${kind}/${id}${kind === "mating-listings" ? "/public" : ""}`,
  );
  assert.equal(response.status(), 404);
}
async function geometry(path, label) {
  await go(path);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      label + " overflow " + width,
    );
    assert.equal(await page.locator("main select").count(), 0);
    for (const control of await page.locator("main .button").all()) {
      if (!(await control.isVisible())) continue;
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      assert.ok(
        box.height >= 44 && box.x >= -1 && box.x + box.width <= width + 1,
        label +
          " target " +
          width +
          " " +
          (await control.innerText()) +
          " " +
          JSON.stringify(box),
      );
    }
    pass(label + " responsive " + width);
    if (label === "listing-pending") {
      const archive = page.getByRole("button", {
        name: "В архів",
        exact: true,
      });
      await archive.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      for (let n = 0; n < 5; n++) {
        await page.keyboard.press("Tab");
        assert.ok(
          await dialog.evaluate((node) =>
            node.contains(document.activeElement),
          ),
        );
      }
      await page.keyboard.press("Escape");
      assert.ok(
        await archive.evaluate((node) => node === document.activeElement),
      );
      pass("pending confirmation keyboard trap/return " + width);
    }
    if ([320, 1440].includes(width))
      await page.evaluate(() => window.scrollTo(0, 0));
    if ([320, 1440].includes(width))
      await page.screenshot({
        path: `test-results/phase10a-${label}-${width}.png`,
        fullPage: false,
      });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  await login(f.seller);
  await go(`/listings/new?petId=${f.known.id}`);
  await page.getByLabel("Безкоштовно", { exact: true }).check();
  await location();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill("Тварина очікує модерації");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Повний опис тварини для перевірки.");
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Відкрити оголошення", exact: true })
    .waitFor();
  const listingId = (
    await page
      .getByRole("link", { name: "Відкрити оголошення", exact: true })
      .getAttribute("href")
  ).split("/")[2];
  await f.db.listingImage.create({
    data: {
      listingId,
      url: "https://res.cloudinary.com/fixture/image/upload/v1/fixture.png",
      position: 0,
    },
  });
  await go(`/listings/${listingId}/edit`);
  await status("Чернетка");
  await page
    .getByRole("button", { name: "Надіслати на модерацію", exact: true })
    .click();
  await status("На модерації");
  await absent("listings", listingId);
  assert.equal(
    await page
      .getByRole("button", { name: "Надіслати на модерацію", exact: true })
      .count(),
    0,
  );
  pass("A listing draft creates then submits PENDING/private");
  await geometry("/my-listings", "listing-management");
  await geometry(`/listings/${listingId}/edit`, "listing-pending");
  await decision("listings", listingId, "reject");
  await go(`/listings/${listingId}/edit`);
  await status("Відхилено");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Виправлений зміст оголошення.");
  await page
    .getByRole("button", { name: "Надіслати на модерацію", exact: true })
    .click();
  await status("На модерації");
  pass("C rejected owner edits and resubmits");
  await decision("listings", listingId, "approve");
  await go(`/listings/${listingId}`, publicPage);
  assert.ok(
    await publicPage
      .getByRole("heading", { name: "Про тварину", exact: true })
      .isVisible(),
  );
  await go(`/sellers/${f.seller.user.id}`, publicPage);
  assert.ok(
    (await publicPage.locator(`a[href*="/listings/${listingId}"]`).count()) > 0,
  );
  pass("B approved listing visible in detail and seller");
  await f.db.favorite.create({ data: { userId: f.seller.user.id, listingId } });
  await go("/favorites");
  assert.ok(
    (await page.locator(`a[href*="/listings/${listingId}"]`).count()) > 0,
  );
  await go(`/listings/${listingId}/edit`);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Матеріальна зміна схваленого оголошення.");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await status("На модерації");
  await absent("listings", listingId);
  await go("/favorites");
  assert.equal(
    await page.locator(`a[href*="/listings/${listingId}"]`).count(),
    0,
  );
  assert.equal(
    await f.db.favorite.count({
      where: { userId: f.seller.user.id, listingId },
    }),
    1,
  );
  pass(
    "D/G approved edit requeues and favorites retain row without public leakage",
  );
  await decision("listings", listingId, "approve");
  await decision("listings", listingId, "hide");
  await geometry(`/listings/${listingId}/edit`, "listing-hidden");
  await status("Приховано");
  assert.equal(
    await page
      .getByRole("button", { name: "Надіслати на модерацію", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByLabel("Опис", { exact: true }).count(), 0);
  await absent("listings", listingId);
  pass("E hidden content cannot edit or submit");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go(`/mating/new?petId=${f.known.id}`);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Умови пошуку пари до модерації.");
  await location();
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL(/\/mating\/[^/]+\/edit/);
  await page.waitForLoadState("networkidle");
  const matingId = new URL(page.url()).pathname.split("/")[2];
  await page
    .getByRole("button", { name: "Надіслати на модерацію", exact: true })
    .click();
  await status("На модерації");
  await absent("mating-listings", matingId);
  pass("F mating draft submit remains private");
  await geometry("/mating/my", "mating-management");
  await geometry(`/mating/${matingId}/edit`, "mating-pending");
  await decision("mating-listings", matingId, "reject");
  await geometry(`/mating/${matingId}/edit`, "mating-rejected");
  await status("Відхилено");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Виправлені умови пошуку пари.");
  await page
    .getByRole("button", { name: "Надіслати на модерацію", exact: true })
    .click();
  await status("На модерації");
  await decision("mating-listings", matingId, "approve");
  await go(`/mating/${matingId}`, publicPage);
  assert.equal(await publicPage.locator("#mating-heading").count(), 1);
  pass("F mating rejection/resubmit/approval public detail");
  await go(`/mating/${matingId}/edit`);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Нові умови схваленої в’язки.");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await status("На модерації");
  await absent("mating-listings", matingId);
  await decision("mating-listings", matingId, "approve");
  await decision("mating-listings", matingId, "hide");
  await geometry(`/mating/${matingId}/edit`, "mating-hidden");
  await status("Приховано");
  assert.equal(
    await page
      .getByRole("button", { name: "Надіслати на модерацію", exact: true })
      .count(),
    0,
  );
  await absent("mating-listings", matingId);
  pass("F approved edit and hidden mating remain private");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await page.waitForLoadState("networkidle");
  await login(f.full, "/mating/my");
  assert.equal(await page.locator(`a[href*="${matingId}"]`).count(), 0);
  await go("/my-listings");
  assert.equal(await page.locator(`a[href*="${listingId}"]`).count(), 0);
  pass("H session switch does not cross owner moderation state");
  assert.deepEqual(errors, []);
  pass("No runtime/hydration errors");
  await writeFile(
    "test-results/phase10a-browser.json",
    JSON.stringify({ checks, errors, network }, null, 2),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
