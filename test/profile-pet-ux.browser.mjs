import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";
import { selectFormOption } from "./helpers/select-form-option.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const base = "http://localhost:3000",
  checks = [],
  errors = [];
let fixture;
page.on("pageerror", (error) => errors.push(error.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (path) => {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
};
const card = (id) => page.locator(`[data-pet-id="${id}"]`);
const png = {
  name: "pet.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J9sAAAAASUVORK5CYII=",
    "base64",
  ),
};
async function geometry(label) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " " + width,
    );
    for (const el of await page
      .locator('main .button,main [role="combobox"]')
      .all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      assert.ok(
        box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1,
      );
    }
    await page.screenshot({
      path: `test-results/phase7e1-${label}-${width}.png`,
      fullPage: true,
    });
    pass(`${label} ${width} no overflow/44px actions`);
  }
}
async function login(actor, target = page) {
  await target.goto(base + "/login");
  await target
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await target.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await target.getByRole("button", { name: "Увійти", exact: true }).click();
  await target.waitForURL("**/account");
}
async function savePhoto(button) {
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/profile-image") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: button, exact: true }).click();
  assert.equal((await response).status(), 201);
  await page.waitForURL("**/pets");
  await page.waitForLoadState("networkidle");
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures({
    animals: true,
    historicalPreview: true,
  });
  await login(fixture.full);
  await go("/profile/breeder");
  await page
    .getByRole("heading", { name: "Тварини розплідника", exact: true })
    .waitFor();
  await geometry("breeder-entry");
  await page
    .getByRole("link", { name: "Керувати тваринами", exact: true })
    .click();
  await card(fixture.full.listings[0].petId).waitFor();
  pass("A: discoverable card opens breeder animals");
  await go("/pets/new");
  await page
    .getByRole("combobox", { name: "Вид тварини", exact: true })
    .waitFor();
  await selectFormOption(page, "Вид тварини", { label: "Собака" });
  const gender = page.getByRole("combobox", { name: "Стать", exact: true });
  await gender.focus();
  await gender.press("ArrowDown");
  await gender.press("ArrowDown");
  await gender.press("Enter");
  assert.equal(await gender.getAttribute("data-value"), "MALE");
  await gender.press("Enter");
  await gender.press("ArrowUp");
  await gender.press("Escape");
  assert.equal(
    await page.getByRole("listbox", { name: "Стать", exact: true }).count(),
    0,
  );
  assert.equal(
    await gender.evaluate((el) => el === document.activeElement),
    true,
  );
  await selectFormOption(page, "Стать", { label: "Самка" });
  assert.equal(await gender.getAttribute("data-value"), "FEMALE");
  await gender.click();
  await page
    .getByRole("heading", { name: "Додати тварину", exact: true })
    .click();
  assert.equal(
    await page.getByRole("listbox", { name: "Стать", exact: true }).count(),
    0,
  );
  pass(
    "E: custom gender/species SVG controls; mouse/arrows/Enter/Escape/outside/focus",
  );
  assert.equal(await page.locator("select").count(), 0);
  await page
    .getByLabel("Ім’я (необов’язково)", { exact: true })
    .fill("Тварина з власним фото та довгою назвою для перевірки адаптивності");
  await page
    .getByLabel("Додати фото тварини", { exact: true })
    .setInputFiles(png);
  await page.locator(".pet-photo-preview").waitFor();
  assert.ok(
    (await page.locator(".pet-photo-preview").getAttribute("src")).startsWith(
      "blob:",
    ),
  );
  await geometry("pet-form");
  await gender.click();
  await geometry("dropdown");
  await gender.press("Escape");
  await savePhoto("Додати тварину");
  const snapshot = await fixture.domainSnapshot();
  const pet = snapshot.pets.find((p) =>
    p.name?.startsWith("Тварина з власним"),
  );
  assert.ok(pet);
  const petId = pet.id;
  const photoBefore = await page
    .locator(".pet-preview img")
    .first()
    .getAttribute("src");
  assert.ok(photoBefore.includes("/pet-platform/pets/"));
  pass(
    "B: create with real upload; My Pets owns photo independently of Listing",
  );
  await go("/profile/breeder/animals");
  await card(petId).waitFor();
  assert.ok(
    (await card(petId).locator("img").getAttribute("src")).includes(
      "/pet-platform/pets/",
    ),
  );
  await card(petId).getByRole("checkbox").click();
  await page.waitForFunction(
    (id) => document.querySelector(`[data-pet-id="${id}"] input`).checked,
    petId,
  );
  await go("/sellers/" + fixture.full.user.id);
  await card(petId).waitFor();
  assert.ok(
    (await card(petId).locator("img").getAttribute("src")).includes(
      "/pet-platform/pets/",
    ),
  );
  assert.equal(await card(petId).locator("a").count(), 0);
  pass(
    "B: management and opted-in public animal use own photo without sale/listing",
  );
  await go("/pets/" + petId + "/edit");
  await page
    .getByLabel("Замінити фото тварини", { exact: true })
    .setInputFiles(png);
  await savePhoto("Зберегти зміни");
  const photoAfter = await page
    .locator(".pet-preview img")
    .first()
    .getAttribute("src");
  assert.notEqual(photoAfter, photoBefore);
  pass("owner replaces photo; new persisted asset differs");
  await go("/pets/" + petId + "/edit");
  await page
    .getByRole("button", { name: "Видалити фото тварини", exact: true })
    .click();
  const removal = page.waitForResponse(
    (r) =>
      r.url().includes("/profile-image") && r.request().method() === "DELETE",
  );
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  assert.equal((await removal).status(), 200);
  await page.waitForURL("**/pets");
  await go("/sellers/" + fixture.full.user.id);
  await card(petId).waitFor();
  assert.equal(await card(petId).locator("img").count(), 0);
  pass(
    "owner removes only profile photo; no-listing animal falls back to placeholder",
  );
  await go("/profile/breeder/animals");
  await card(fixture.full.listings[0].petId).getByRole("checkbox").click();
  await page.waitForFunction(
    (id) => document.querySelector(`[data-pet-id="${id}"] input`).checked,
    fixture.full.listings[0].petId,
  );
  await go("/sellers/" + fixture.full.user.id);
  await card(fixture.full.listings[0].petId).waitFor();
  assert.ok(
    (
      await card(fixture.full.listings[0].petId)
        .locator("img")
        .getAttribute("src")
    ).includes("sample.jpg"),
  );
  pass("C: no own photo uses ACTIVE Listing cover");
  await go("/profile/breeder/animals");
  const historicalId = fixture.full.listings[1].petId;
  await card(historicalId).getByRole("checkbox").click();
  await page.waitForFunction(
    (id) => document.querySelector(`[data-pet-id="${id}"] input`).checked,
    historicalId,
  );
  await go("/sellers/" + fixture.full.user.id);
  await card(historicalId).waitFor();
  assert.equal(await card(historicalId).locator("img,a").count(), 0);
  pass("D: SOLD historical Listing image stays out of public animal card");
  await go("/account");
  await page
    .getByRole("button", { name: "Редагувати особисті дані", exact: true })
    .click();
  await page.getByLabel("Ім’я", { exact: true }).fill("  Марія  ");
  await page.getByLabel("Прізвище", { exact: true }).fill("  Українська  ");
  await geometry("account-edit");
  await page.route("**/account/profile", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UNAVAILABLE" } }),
    }),
  );
  await page
    .getByRole("button", { name: "Зберегти особисті дані", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByLabel("Ім’я", { exact: true }).inputValue(),
    "  Марія  ",
  );
  assert.equal(
    await page.getByLabel("Прізвище", { exact: true }).inputValue(),
    "  Українська  ",
  );
  await page.unroute("**/account/profile");
  pass("failed identity mutation preserves both fields");
  await page
    .getByRole("button", { name: "Зберегти особисті дані", exact: true })
    .click();
  await page.getByText("Особисті дані збережено.", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Марія Українська", { exact: true }).waitFor();
  await go("/sellers/" + fixture.full.user.id);
  await page.getByText(/Контактна особа: Марія Українська/).waitFor();
  await page
    .getByRole("heading", { name: "Royal Malinois", exact: true })
    .waitFor();
  pass(
    "F: trimmed full names persist across refresh; breeder kennel primary/contact secondary",
  );
  const sellerContext = await browser.newContext(),
    sellerPage = await sellerContext.newPage();
  await login(fixture.seller, sellerPage);
  await sellerPage
    .getByRole("button", { name: "Редагувати особисті дані", exact: true })
    .click();
  await sellerPage.getByLabel("Ім’я", { exact: true }).fill("Тарас");
  await sellerPage.getByLabel("Прізвище", { exact: true }).fill("Шевченко");
  await sellerPage
    .getByRole("button", { name: "Зберегти особисті дані", exact: true })
    .click();
  await sellerPage
    .getByText("Особисті дані збережено.", { exact: true })
    .waitFor();
  await sellerPage.goto(base + "/sellers/" + fixture.seller.user.id);
  await sellerPage
    .getByRole("heading", { name: "Тарас Шевченко", exact: true })
    .waitFor();
  await sellerPage.goto(base + "/listings/" + fixture.seller.listings[0].id);
  await sellerPage
    .getByText("Тарас Шевченко", { exact: true })
    .first()
    .waitFor();
  pass("normal seller and Listing fallback identity update without relogin");
  await sellerPage.goto(base + "/account");
  await sellerPage
    .getByRole("link", { name: "Редагувати публічний профіль", exact: true })
    .click();
  await sellerPage.waitForURL("**/profile");
  await sellerPage.goto(base + "/account");
  await sellerPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await sellerPage.waitForURL("**/login");
  pass("profile and logout actions remain functional");
  await sellerContext.close();
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase7e1-browser.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/phase7e1-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  if (fixture) await fixture.cleanup();
}
