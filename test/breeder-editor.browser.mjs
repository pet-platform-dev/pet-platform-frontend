import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "msedge",
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const base = "http://localhost:3000",
  checks = [],
  errors = [],
  writes = [];
let fixture;
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (
    request.url().endsWith("/breeders/me") &&
    ["POST", "PATCH", "DELETE"].includes(request.method())
  )
    writes.push({ method: request.method(), body: request.postDataJSON() });
});
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function go(path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
}
async function login(actor) {
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
}
async function heading(name) {
  await page.getByRole("heading", { name, exact: true }).waitFor();
}
async function geometry(label) {
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " " + width + " page overflow",
    );
    for (const element of await page
      .locator("main input,main textarea,main .button,.reference-chips li")
      .all()) {
      if (!(await element.isVisible())) continue;
      const box = await element.boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width + 1,
        label + " " + width + " field/button/chip bounds",
      );
    }
    await page.screenshot({
      path: "test-results/phase7c1-" + label + "-" + width + ".png",
      fullPage: true,
    });
    pass(label + " " + width + " responsive");
  }
}
async function selectBreed(breed, keyboard = false) {
  const label = breed.nameUk?.trim() || breed.name,
    input = page.getByRole("combobox", { name: /Породи/ });
  await input.fill(breed.name);
  const option = page.getByRole("option").filter({ hasText: label }).first();
  await option.waitFor();
  if (keyboard) {
    await input.press("ArrowDown");
    await input.press("Enter");
  } else await option.click();
  await page
    .getByRole("button", { name: "Видалити: " + label, exact: true })
    .waitFor();
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures({ onboarding: true });
  const before = await fixture.domainSnapshot();
  await go("/profile/breeder");
  await page.waitForURL("**/login");
  pass("logged-out editor follows existing login flow");
  await login(fixture.full);
  await page
    .getByRole("link", { name: "Налаштувати профіль заводчика", exact: true })
    .waitFor();
  pass("new BREEDER account shows setup CTA");
  await page
    .getByRole("link", { name: "Налаштувати профіль заводчика", exact: true })
    .click();
  await heading("Налаштувати профіль заводчика");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.getByText("Вкажіть назву розплідника", { exact: true }).waitFor();
  assert.equal(writes.length, 0);
  pass("required kennel validation blocks request");
  await page.locator("#breeder-kennelName").fill("Новий розплідник 🐾");
  await page
    .locator("#breeder-description")
    .fill("З турботою про собак і котів.");
  await page.locator("#breeder-startedYear").fill("1899");
  await page.locator("#breeder-website").fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page
    .getByText("Рік початку роботи має бути не раніше 1900", { exact: true })
    .waitFor();
  await page
    .getByText("Вкажіть безпечну адресу сайту http або https без даних входу", {
      exact: true,
    })
    .waitFor();
  pass("year and unsafe website associated validation; fields retained");
  await page.locator("#breeder-startedYear").fill("2019");
  await page.locator("#breeder-website").fill("https://example.com");
  const location = page.getByRole("combobox", { name: /Місто або село/ });
  await location.fill("сві");
  await page.getByRole("option").first().waitFor();
  await location.fill("Світловодськ");
  await page
    .locator('[role=option][id$="' + fixture.location.id + '"]')
    .click();
  pass("settlement search and hierarchy display reused");
  await selectBreed(fixture.breeds[0], true);
  await selectBreed(fixture.breeds[1]);
  assert.equal(await page.locator(".reference-chips li").count(), 2);
  pass("dog and cat selection without species, keyboard and removable chips");
  assert.equal(
    await page
      .locator(
        'main input[name="phone"],main input[name="telegram"],main input[name="viber"],main input[name="whatsapp"]',
      )
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Редагувати контакти", exact: true })
      .getAttribute("href"),
    "/profile",
  );
  pass("contacts remain separate");
  const breedInput = page.getByRole("combobox", { name: /Породи/ });
  await breedInput.press("ArrowDown");
  await page.getByRole("listbox").waitFor();
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await page.getByRole("listbox").boundingBox();
    assert.ok(
      bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
      "breed dropdown " + width,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await breedInput.press("Escape");
  pass("open shared breed dropdown fits all six widths");
  await geometry("create");
  await context.route("**/api/v1/breeders/me", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "PRIVATE_PRISMA_SQL" }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Не вдалося зберегти профіль" })
    .waitFor();
  assert.equal(
    await page.locator("#breeder-kennelName").inputValue(),
    "Новий розплідник 🐾",
  );
  assert.equal(await page.locator(".reference-chips li").count(), 2);
  assert.ok(
    !(await page.locator("main").innerText()).includes("PRIVATE_PRISMA_SQL"),
  );
  pass("failed create preserves all input and selected references; safe error");
  await context.unroute("**/api/v1/breeders/me");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.waitForURL("**/sellers/" + fixture.full.user.id);
  await heading("Новий розплідник 🐾");
  await page
    .getByText("Профіль заводчика створено.", { exact: true })
    .waitFor();
  for (const value of [
    "З турботою про собак і котів.",
    "Працює з 2019 року",
    "Кіровоградська область",
  ])
    assert.ok((await page.locator("main").innerText()).includes(value));
  assert.equal(
    await page
      .getByRole("link", { name: /Вебсайт розплідника/ })
      .getAttribute("href"),
    "https://example.com/",
  );
  assert.equal(await page.locator(".breeder-breed-list li").count(), 2);
  await page.locator(".listing-card").first().waitFor();
  assert.equal(await page.locator(".listing-card").count(), 24);
  pass(
    "POST success feedback and navigation; all kennel fields, contacts and ACTIVE listing pagination",
  );
  await geometry("public");
  // Warm listing detail cache before editing to exercise focused invalidation across SPA navigation.
  await page.locator(".listing-card-link").first().click();
  await page
    .locator(".listing-seller-name")
    .getByText("Новий розплідник 🐾", { exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Переглянути профіль", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Мій профіль", exact: true })
    .first()
    .click();
  await page.waitForURL("**/account");
  await page
    .getByRole("link", { name: "Редагувати профіль заводчика", exact: true })
    .waitFor();
  pass("existing profile account edit/public CTA");
  await page
    .getByRole("link", { name: "Редагувати профіль заводчика", exact: true })
    .click();
  await heading("Редагувати профіль заводчика");
  assert.equal(
    await page.locator("#breeder-kennelName").inputValue(),
    "Новий розплідник 🐾",
  );
  assert.equal(await page.locator("#breeder-startedYear").inputValue(), "2019");
  assert.equal(await page.locator(".reference-chips li").count(), 2);
  pass("GET existing profile prefills form");
  const catLabel = fixture.breeds[1].nameUk?.trim() || fixture.breeds[1].name;
  await page
    .getByRole("button", { name: "Видалити: " + catLabel, exact: true })
    .click();
  await page.locator("#breeder-kennelName").fill("Оновлений розплідник");
  await geometry("edit");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.getByText("Зміни збережено.", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/profile/breeder");
  pass("PATCH preserves session, saves updated name and breed selection");
  await page
    .getByRole("link", { name: "Переглянути публічний профіль", exact: true })
    .click();
  await heading("Оновлений розплідник");
  assert.equal(await page.locator(".breeder-breed-list li").count(), 1);
  await page.locator(".listing-card-link").first().click();
  await page
    .locator(".listing-seller-name")
    .getByText("Оновлений розплідник", { exact: true })
    .waitFor();
  pass(
    "same-session public and previously visited listing detail refresh identity",
  );
  await page
    .getByRole("link", { name: "Мій профіль", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Редагувати профіль заводчика", exact: true })
    .click();
  await heading("Редагувати профіль заводчика");
  const trigger = page.getByRole("button", {
    name: "Видалити профіль заводчика",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Скасувати",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Видалити профіль",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Скасувати",
  );
  await page.getByRole("button", { name: "Скасувати", exact: true }).click();
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  pass("destructive dialog exact text, focus trap, cancellation/return");
  await trigger.click();
  await page
    .getByRole("button", { name: "Видалити профіль", exact: true })
    .click();
  await page.waitForURL("**/account");
  await page
    .getByRole("link", { name: "Налаштувати профіль заводчика", exact: true })
    .waitFor();
  assert.deepEqual(await fixture.domainSnapshot(), before);
  pass(
    "DELETE preserves BREEDER User, all Pets/Listings and unchanged contacts; setup CTA restored",
  );
  await go("/sellers/" + fixture.full.user.id);
  await heading("Олександр Єпік");
  assert.equal(
    await page.locator("[aria-labelledby=breeder-about]").count(),
    0,
  );
  await page.locator(".listing-card-link").first().click();
  await page
    .locator(".listing-seller-name")
    .getByText("Олександр Єпік", { exact: true })
    .waitFor();
  pass("deleted profile personal fallback on public page and listing detail");
  await page
    .getByRole("link", { name: "Мій профіль", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await login(fixture.seller);
  assert.equal(
    await page.getByRole("link", { name: /профіль заводчика/ }).count(),
    0,
  );
  await go("/profile/breeder");
  await page
    .getByText("Редактор доступний для акаунта заводчика.", { exact: true })
    .waitFor();
  assert.equal(await page.locator("main form").count(), 0);
  pass("SELLER account hides CTA and direct access is denied");
  for (const request of writes.filter((r) => r.body))
    assert.ok(
      Object.keys(request.body).every((key) =>
        [
          "kennelName",
          "description",
          "locationId",
          "breedIds",
          "startedYear",
          "website",
        ].includes(key),
      ),
    );
  assert.ok(writes.some((r) => r.method === "POST"));
  assert.ok(writes.some((r) => r.method === "PATCH"));
  assert.ok(writes.some((r) => r.method === "DELETE"));
  pass("strict six-field API payloads; existing owner endpoints");
  const posted = writes.find((r) => r.method === "POST" && r.body);
  assert.equal(posted.body.locationId, fixture.location.id);
  assert.deepEqual(
    [...posted.body.breedIds].sort(),
    fixture.breeds.map((b) => b.id).sort(),
  );
  pass("selected exact settlement UUID and both species persisted");
  assert.deepEqual(errors, []);
  pass("no browser runtime errors");
  await writeFile(
    "test-results/phase7c1-browser.json",
    JSON.stringify(
      {
        checks,
        widths: [320, 375, 430, 768, 1024, 1440],
        runtimeErrors: errors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  if (fixture) await fixture.cleanup();
}
