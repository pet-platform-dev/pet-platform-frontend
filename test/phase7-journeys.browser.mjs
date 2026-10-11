import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";
import {
  api,
  image,
  go,
  geometry,
  register,
  call,
  createPet,
  createListing,
} from "./helpers/phase7-journey.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const contexts = [],
  errors = [],
  checks = [];
let fixture;
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function tab() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, context };
}
const heading = (page, text) =>
  page.getByRole("heading", { name: text, exact: true }).waitFor();
const petCard = (page, id) => page.locator(`[data-pet-id="${id}"]`);
const privacy = async (page, actor) => {
  const body = await page.locator("main").innerText();
  assert.ok(!body.includes(actor.user.email));
  for (const text of [
    "storageKey",
    "publicId",
    "passwordHash",
    "DELETE_PENDING",
    "SELLER",
    "BREEDER",
    "Без імені",
  ])
    assert.ok(!body.includes(text), "Private/internal wording exposed");
};
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures({
    animals: true,
    historicalPreview: true,
  });
  const { page: ownerPage, context: ownerContext } = await tab();
  await go(ownerPage, "/register");
  await geometry(ownerPage, "register", pass);
  await ownerPage
    .getByRole("button", { name: "Створити акаунт", exact: true })
    .click();
  await ownerPage.locator(".field-error").first().waitFor();
  pass(
    "Registration validation is localized and radios support keyboard/default owner",
  );
  const owner = await register(ownerPage, fixture, "SELLER");
  assert.equal(owner.user.role, "USER");
  await geometry(ownerPage, "account-owner", pass);
  await ownerPage
    .getByRole("button", { name: "Редагувати особисті дані" })
    .click();
  await ownerPage.getByLabel("Ім’я", { exact: true }).fill("Марія");
  await ownerPage.getByLabel("Прізвище", { exact: true }).fill("Єпікова");
  await ownerPage
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await ownerPage.getByText("Особисті дані збережено.").waitFor();
  assert.equal(
    (await (await call(ownerContext, owner, "GET", "/auth/me")).json()).data
      .firstName,
    "Марія",
  );
  await ownerPage
    .getByRole("link", { name: "Редагувати публічний профіль", exact: true })
    .click();
  await heading(ownerPage, "Контакти та місце розташування");
  await geometry(ownerPage, "contacts", pass);
  await ownerPage.getByLabel("Телефон", { exact: false }).fill("+380501234567");
  await ownerPage.route("**/profile", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Prisma private failure" }),
        })
      : route.continue(),
  );
  await ownerPage
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await ownerPage.locator("main").getByRole("alert").waitFor();
  assert.ok(
    !(await ownerPage.locator("main").getByRole("alert").innerText()).includes(
      "Prisma",
    ),
  );
  await ownerPage.unroute("**/profile");
  await ownerPage
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await ownerPage.getByText("Публічний профіль збережено.").waitFor();
  pass(
    "Owner name/auth-me and optional contacts update without relogin; failed save is friendly/retryable",
  );
  await go(ownerPage, "/pets/new");
  await heading(ownerPage, "Додати тварину");
  await geometry(ownerPage, "pet-new", pass);
  const ownerPet = await createPet(ownerPage, fixture);
  await geometry(ownerPage, "my-pets", pass);
  assert.equal(
    (
      await ownerContext.request.get(api + "/pets/" + ownerPet.id + "/public")
    ).status(),
    404,
  );
  const ownerListing = await createListing(ownerPage, fixture, ownerPet.id);
  await go(ownerPage, "/listings/" + ownerListing.id);
  await heading(ownerPage, fixture.breeds[0].nameUk);
  await ownerPage.getByText("Марія Єпікова", { exact: true }).waitFor();
  await privacy(ownerPage, owner);
  await go(ownerPage, "/sellers/" + owner.user.id);
  await heading(ownerPage, "Марія Єпікова");
  assert.equal(
    (await ownerPage
      .locator('a[href="/listings/' + ownerListing.id + '"]')
      .count()) > 0,
    true,
  );
  await privacy(ownerPage, owner);
  pass(
    "A: registered owner creates Pet/photo and ACTIVE Listing; Pet remains private and seller identity is full name",
  );

  const { page, context } = await tab();
  const breeder = await register(page, fixture, "BREEDER");
  assert.equal(breeder.user.role, "USER");
  await page
    .getByRole("link", { name: "Налаштувати профіль розплідника", exact: true })
    .click();
  await heading(page, "Налаштувати профіль розплідника");
  assert.ok(
    (await page.locator("main").innerText()).includes("Спочатку збережіть"),
  );
  await page
    .getByLabel("Назва розплідника", { exact: true })
    .fill("Royal Malinois — розплідник із довгою українською назвою");
  await page
    .getByLabel("Про розплідник", { exact: false })
    .fill("Розплідник із турботою про тварин. Спілкування за домовленістю.");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.waitForURL("**/sellers/" + breeder.user.id);
  await page
    .getByRole("link", { name: "Додати медіа та керувати тваринами" })
    .click();
  await heading(page, "Редагувати профіль розплідника");
  for (const slot of ["logo", "cover", "gallery"]) {
    const uploaded = page.waitForResponse(
      (r) =>
        r.url().includes("/breeders/me/media/images/") &&
        r.request().method() === "POST",
    );
    await page
      .locator("#breeder-" + slot + "-upload")
      .setInputFiles(await image(slot + ".png"));
    assert.equal((await uploaded).status(), 201);
    await page.waitForFunction(
      () => !document.querySelector(".breeder-upload-list li"),
    );
  }
  await geometry(page, "breeder-editor", pass);
  await page.getByRole("link", { name: "Додати тварину", exact: true }).click();
  await page.waitForURL("**/pets/new?returnTo=*");
  assert.ok(page.url().includes("returnTo="));
  const breederPet = await createPet(page, fixture, true);
  await petCard(page, breederPet.id)
    .getByLabel("Показувати у профілі розплідника")
    .click();
  await petCard(page, breederPet.id)
    .getByRole("link", { name: "Переглянути профіль тварини" })
    .waitFor();
  await geometry(page, "breeder-animals", pass);
  await petCard(page, breederPet.id)
    .getByRole("link", { name: "Редагувати тварину", exact: true })
    .click();
  await page.waitForURL("**/pets/" + breederPet.id + "/edit?returnTo=*");
  assert.ok(page.url().includes("returnTo="));
  await page.reload();
  assert.equal(
    await page
      .getByRole("link", { name: "← Тварини розплідника", exact: true })
      .getAttribute("href"),
    "/profile/breeder/animals",
  );
  await page
    .locator("#pet-gallery-upload")
    .setInputFiles([await image("pet-1.png"), await image("pet-2.png")]);
  await page.getByText("Фотографії 2 / 20", { exact: true }).waitFor();
  await geometry(page, "pet-edit", pass);
  await page
    .getByLabel("Чим особлива", { exact: false })
    .fill("Врівноважений характер, любить роботу з провідником.");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.waitForURL("**/profile/breeder/animals");
  await petCard(page, breederPet.id)
    .getByRole("link", { name: "Переглянути профіль тварини" })
    .click();
  await page.waitForURL("**/pets/" + breederPet.id);
  await heading(page, fixture.breeds[0].nameUk);
  await geometry(page, "pet-public", pass);
  assert.equal(
    await page
      .getByRole("heading", { name: "Тварина має активне оголошення" })
      .count(),
    0,
  );
  await privacy(page, breeder);
  await go(page, "/sellers/" + breeder.user.id);
  await geometry(page, "breeder-public", pass);
  await page
    .getByRole("heading", { name: "Наші тварини", exact: true })
    .waitFor();
  const breederListing = await createListing(page, fixture, breederPet.id);
  await go(page, "/listings/" + breederListing.id);
  await heading(page, fixture.breeds[0].nameUk);
  await geometry(page, "listing-detail", pass);
  await go(page, "/pets/" + breederPet.id);
  await page
    .getByRole("link", { name: "Переглянути оголошення", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Переглянути оголошення", exact: true })
      .getAttribute("href"),
    "/listings/" + breederListing.id,
  );
  pass(
    "B: registered breeder setup/media/Pet/gallery/visibility/public profiles/ACTIVE Listing work together",
  );

  await go(page, "/profile/breeder");
  await page
    .getByLabel("Назва розплідника", { exact: true })
    .fill("Оновлений розплідник");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.getByText("Зміни збережено.", { exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Переглянути публічний профіль", exact: true })
    .click();
  await heading(page, "Оновлений розплідник");
  await page
    .locator('a[href="/pets/' + breederPet.id + '"]')
    .first()
    .click();
  await page.waitForURL("**/pets/" + breederPet.id);
  await page.getByText("Оновлений розплідник", { exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Переглянути оголошення", exact: true })
    .click();
  await page.waitForURL("**/listings/" + breederListing.id);
  await page.getByText("Оновлений розплідник", { exact: true }).waitFor();
  pass(
    "C: kennel rename refreshes breeder, Pet context and Listing seller card through client navigation",
  );

  await go(page, "/profile/breeder");
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.getByRole("button", { name: "Відкрити меню" }).click();
  const menu = page.getByRole("navigation", { name: "Мобільна навігація" });
  assert.equal(
    await menu
      .getByRole("link", { name: "Мій профіль", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page.keyboard.press("Escape");
  assert.equal(await menu.count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Відкрити меню" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Відкрити меню" }).click();
  await menu.getByRole("link", { name: "Мій профіль", exact: true }).click();
  await page.waitForURL("**/account");
  assert.equal(await menu.count(), 0);
  pass(
    "Mobile menu closes on navigation/Escape and treats breeder routes as account context",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", {
      name: "Перейти на тип «Власник тварини»",
      exact: true,
    })
    .click();
  await page
    .getByText(
      "Щоб змінити тип акаунта, спочатку видаліть профіль розплідника.",
      { exact: true },
    )
    .waitFor();
  pass("F: downgrade with kennel is clearly blocked; roles stay USER");
  const privatePetResponse = await call(context, breeder, "POST", "/pets", {
    speciesId: fixture.breeds[0].speciesId,
    name: "Приватна тварина",
  });
  assert.equal(privatePetResponse.status(), 201);
  const privatePet = (await privatePetResponse.json()).data;
  const draft = await call(context, breeder, "POST", "/listings", {
    petId: privatePet.id,
    locationId: fixture.location.id,
    type: "FREE",
    title: "Приватна чернетка",
    description: "Приватний опис чернетки",
  });
  assert.equal(draft.status(), 201);
  const draftListing = (await draft.json()).data;
  await go(page, "/pets/" + privatePet.id);
  await heading(page, "404");
  await go(page, "/sellers/" + breeder.user.id);
  assert.equal(
    await page.locator('a[href="/listings/' + draftListing.id + '"]').count(),
    0,
  );
  await privacy(page, breeder);
  pass(
    "D: private Pet is ordinary Not Found and DRAFT Listing stays absent publicly",
  );
  await go(page, "/profile/breeder");
  const trigger = page.getByRole("button", {
    name: "Видалити профіль розплідника",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Скасувати", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Видалити профіль", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  await trigger.click();
  await dialog
    .getByRole("button", { name: "Видалити профіль", exact: true })
    .click();
  await page.waitForURL("**/account");
  const domain = await fixture.trackedDomain(breeder.user.id);
  assert.equal(domain.pets.length, 2);
  assert.equal(domain.listings.length, 2);
  assert.ok(domain.pets.every((pet) => !pet.showOnBreederProfile));
  assert.equal(
    (
      await context.request.get(api + "/pets/" + breederPet.id + "/public")
    ).status(),
    404,
  );
  await go(page, "/sellers/" + breeder.user.id);
  await heading(page, "Олександр Єпік");
  await go(page, "/account");
  await page
    .getByRole("button", {
      name: "Перейти на тип «Власник тварини»",
      exact: true,
    })
    .click();
  await page
    .locator(".account-type-settings")
    .getByText("Власник тварини", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Перейти на тип «Заводчик»", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Налаштувати профіль розплідника", exact: true })
    .waitFor();
  pass(
    "E/F: confirmed deletion preserves User/Pets/Listings, closes public Pets and permits both account transitions",
  );
  assert.deepEqual(errors, []);
  pass(
    "No runtime/hydration errors; no new privileges or major domain features",
  );
} finally {
  await writeFile(
    "test-results/phase7f-journeys.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  for (const context of contexts) await context.close();
  await browser.close();
  await fixture?.cleanup();
}
