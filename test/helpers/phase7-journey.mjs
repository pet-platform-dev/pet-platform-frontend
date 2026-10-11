import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { selectFormOption } from "./select-form-option.mjs";
const sharp = createRequire(import.meta.url)("sharp");
export const base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
export const widths = [320, 375, 430, 768, 1024, 1280, 1440];
export async function image(name = "photo.png") {
  return {
    name,
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 320, height: 240, channels: 3, background: "#71876f" },
    })
      .png()
      .toBuffer(),
  };
}
export async function go(page, path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
}
export async function geometry(page, label, pass) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${label} ${width}: overflow`,
    );
    for (const el of await page
      .locator("main .button, main [role=combobox]")
      .all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      assert.ok(
        box && box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 44,
        `${label} ${width}: action bounds`,
      );
    }
    await page.screenshot({
      path: `test-results/phase7f-${label}-${width}.png`,
      fullPage: true,
    });
  }
  pass(`${label}: all seven widths, no overflow, accessible action sizes`);
  await page.setViewportSize({ width: 1440, height: 1000 });
}
export async function register(page, fixture, accountType) {
  await go(page, "/register");
  const sellerRadio = page.getByRole("radio").first();
  assert.equal(await sellerRadio.isChecked(), true);
  await sellerRadio.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("radio").last().isChecked(), true);
  if (accountType === "SELLER") await page.keyboard.press("ArrowLeft");
  await page.getByLabel("Ім’я", { exact: true }).fill("Олександр");
  await page.getByLabel("Прізвище", { exact: true }).fill("Єпік");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(`phase7f-${accountType}-${fixture.marker}@example.invalid`);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page
    .getByLabel("Підтвердження пароля", { exact: true })
    .fill(fixture.password);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/auth/register") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Створити акаунт", exact: true })
    .click();
  const result = await response;
  assert.equal(result.status(), 201);
  const data = (await result.json()).data;
  fixture.trackUser(data.user);
  await page.waitForURL("**/account");
  return data;
}
export async function call(context, actor, method, path, data) {
  const csrf = (
    await (
      await context.request.get(api + "/auth/csrf", {
        headers: { Origin: base },
      })
    ).json()
  ).data.csrfToken;
  return context.request.fetch(api + path, {
    method,
    ...(data === undefined ? {} : { data }),
    headers: {
      Origin: base,
      "X-CSRF-Token": csrf,
      Authorization: "Bearer " + actor.accessToken,
    },
  });
}
export async function createPet(page, fixture, breeder = false) {
  await go(
    page,
    breeder ? "/pets/new?returnTo=%2Fprofile%2Fbreeder%2Fanimals" : "/pets/new",
  );
  await page
    .getByRole("heading", { name: "Додати тварину", exact: true })
    .waitFor();
  await page
    .getByLabel("Ім’я", { exact: false })
    .fill("Тор — тварина з довгою українською назвою");
  await selectFormOption(page, "Вид тварини", fixture.breeds[0].speciesId);
  await page
    .getByRole("combobox", { name: "Порода" })
    .fill(fixture.breeds[0].nameUk);
  await page
    .getByRole("option")
    .filter({ hasText: fixture.breeds[0].nameUk })
    .first()
    .click();
  await selectFormOption(page, "Стать", "MALE");
  await page
    .getByLabel("Про тварину", { exact: false })
    .fill("Активна тварина, любить прогулянки та ігри.");
  await page.locator("#pet-photo-file").setInputFiles(await image());
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/pets") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Додати тварину", exact: true })
    .click();
  const result = await response;
  assert.equal(result.status(), 201);
  const pet = (await result.json()).data;
  await page.waitForURL(breeder ? "**/profile/breeder/animals" : "**/pets");
  await page.waitForLoadState("networkidle");
  return pet;
}
export async function createListing(page, fixture, petId) {
  await go(page, "/listings/new?petId=" + petId);
  assert.equal(
    await page
      .getByRole("radio", { name: "Вибрати з моїх тварин" })
      .isChecked(),
    true,
  );
  await page.getByRole("radio", { name: "Безкоштовно", exact: true }).check();
  await page
    .getByRole("combobox", { name: "Місце", exact: true })
    .fill(fixture.location.city);
  await page
    .getByRole("option")
    .filter({ hasText: fixture.location.city })
    .first()
    .click();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill("Тварина шукає відповідальну родину");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Тварина для відповідальної родини. Знайомство за домовленістю.");
  await page
    .getByLabel("Додати фото", { exact: true })
    .setInputFiles(await image("listing.png"));
  await page.waitForFunction(
    () => !document.querySelector(".listing-upload-pending"),
  );
  await page
    .getByRole("button", { name: "Опублікувати", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Опублікувати",
      )?.disabled,
  );
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/listings") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 201);
  const listing = (await result.json()).data;
  await page
    .getByRole("heading", { name: /Оголошення (створено|опубліковано)/ })
    .waitFor();
  return listing;
}
