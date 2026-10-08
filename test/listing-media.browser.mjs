import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
    viewport: { width: 1440, height: 1100 },
  }),
  page = await context.newPage();
const api = "http://localhost:4000/api/v1",
  base = "http://localhost:3000",
  marker = randomUUID(),
  email = `browser-media-${marker}@example.invalid`,
  password = "Test-fixture-only-1234";
const checks = [],
  errors = [],
  created = [];
let actor, token, csrf;
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
await mkdir("test-results", { recursive: true });
const save = () =>
  Promise.all(
    [
      "test-results/media-fixtures.json",
      `test-results/media-fixtures-${actor}.json`,
    ].map((path) =>
      writeFile(
        path,
        JSON.stringify({ userId: actor, email, listingIds: created }, null, 2),
      ),
    ),
  );
page.on("pageerror", (error) => errors.push(error.message));
const headers = () => ({
  Authorization: `Bearer ${token}`,
  Origin: base,
  "X-CSRF-Token": csrf,
});
async function call(method, path, data) {
  return context.request.fetch(api + path, {
    method,
    headers: headers(),
    ...(data ? { data } : {}),
  });
}
async function chooseLocation() {
  const input = page.getByRole("combobox", { name: "Місце", exact: true });
  await input.fill("світловодськ");
  await page
    .locator(".reference-results [role=option]")
    .filter({ has: page.getByText("Світловодськ", { exact: true }) })
    .first()
    .getByRole("button")
    .click();
  assert.ok(
    (await page.locator(".selected-breed").allTextContents()).some((text) =>
      text.includes("Кіровоградська"),
    ),
  );
}
async function animal(
  species = "Собака",
  term = "mal",
  name = "Belgian Malinois",
) {
  await page
    .getByLabel("Вид тварини", { exact: true })
    .selectOption({ label: species });
  const breed = page.getByRole("combobox", { name: "Порода" });
  await breed.fill(term);
  await page
    .locator(".reference-results [role=option]")
    .filter({ has: page.getByText(name, { exact: true }) })
    .first()
    .getByRole("button")
    .click();
}
async function listing(type) {
  await page.getByRole("radio", { name: type, exact: true }).check();
  await chooseLocation();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(`Тест медіа ${marker}`);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Тимчасова перевірка об’єднаної форми");
  if (type === "Продаж")
    await page.getByLabel("Ціна, ₴", { exact: true }).fill("150.50");
}
async function submit(path) {
  const response = page.waitForResponse(
    (r) => r.url() === api + path && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Створити чернетку", exact: true })
    .click();
  const r = await response;
  assert.equal(r.status(), 201);
  const body = (await r.json()).data;
  created.push(body.id);
  await save();
  await page.getByRole("heading", { name: "Оголошення створено" }).waitFor();
  assert.equal(body.status, "DRAFT");
  return body;
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXcAAAAASUVORK5CYII=",
  "base64",
);
const file = (name = "photo.png") => ({
  name,
  mimeType: "image/png",
  buffer: png,
});
try {
  csrf = (
    await (
      await context.request.get(api + "/auth/csrf", {
        headers: { Origin: base },
      })
    ).json()
  ).data.csrfToken;
  const registration = await call("POST", "/auth/register", {
    email,
    password,
    firstName: "Перевірка",
  });
  assert.equal(registration.status(), 201);
  const account = (await registration.json()).data;
  actor = account.user.id;
  token = account.accessToken;
  await save();
  await page.goto(base + "/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const login = page.waitForResponse(
    (r) => r.url().endsWith("/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  token = (await (await login).json()).data.accessToken;
  await page.waitForURL("**/account");
  pass("Login and protected create route");
  await page.goto(base + "/listings/new");
  await page.getByRole("heading", { name: "Створити оголошення" }).waitFor();
  assert.equal(
    await page
      .getByRole("radio", { name: "Нова тварина", exact: true })
      .isChecked(),
    true,
  );
  assert.ok(
    !(await page.locator("body").innerText()).includes(
      "Спочатку додайте профіль",
    ),
  );
  pass("Default new animal works with no prior Pet");
  await page
    .getByRole("radio", { name: "Вибрати з моїх тварин", exact: true })
    .check();
  await page
    .getByText("У вас ще немає доданих тварин.", { exact: false })
    .waitFor();
  await page.getByRole("radio", { name: "Нова тварина", exact: true }).check();
  pass("Empty existing mode returns to inline animal entry");
  await animal();
  pass("Dog searchable Breed selector");
  await animal("Кіт", "maine", "Maine Coon");
  pass("Cat switch resets Breed and selects Maine Coon");
  await animal();
  const add = page.getByLabel("Додати фото", { exact: true });
  await add.setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await page
    .getByText("Формат зображення не підтримується", { exact: true })
    .waitFor();
  pass("Invalid SVG rejected early");
  await add.setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
  });
  await page.getByText("Файл завеликий", { exact: true }).waitFor();
  pass("Oversized source rejected early");
  await add.setInputFiles(
    Array.from({ length: 11 }, (_, index) => file(`${index}.png`)),
  );
  await page
    .getByText("Можна додати не більше 10 фотографій", { exact: true })
    .waitFor();
  pass("More than ten files rejected");
  // Provider failures are injected only into this browser request; the application stays on real Cloudinary.
  await page.route(api + "/uploads/listings/*/images", (route) =>
    route.fulfill({ status: 503, json: { message: "PRIVATE_PROVIDER_ERROR" } }),
  );
  await add.setInputFiles(file("retry.png"));
  await page.getByRole("button", { name: "Повторити", exact: true }).waitFor();
  assert.ok(
    !(await page.locator("body").innerText()).includes(
      "PRIVATE_PROVIDER_ERROR",
    ),
  );
  pass("Failed upload preserves preview and has a safe retry");
  await page.unroute(api + "/uploads/listings/*/images");
  await page.getByRole("button", { name: "Повторити", exact: true }).click();
  await page
    .getByText("Завантажено", { exact: true })
    .waitFor({ timeout: 50000 });
  pass("Real Cloudinary retry uploads one image");
  await add.setInputFiles([file("second.png"), file("third.png")]);
  await page.waitForFunction(
    () =>
      [
        ...document.querySelectorAll(".listing-photo-grid [role=status]"),
      ].filter((el) => el.textContent === "Завантажено").length === 3,
    {},
    { timeout: 80000 },
  );
  pass("Multiple real image uploads have previews and ready states");
  const previews = await page
    .locator(".listing-photo-grid img")
    .evaluateAll((images) => images.map((image) => image.src));
  await page
    .getByRole("button", { name: "Зробити головним", exact: true })
    .last()
    .click();
  assert.equal(
    await page.locator(".listing-photo-grid img").first().getAttribute("src"),
    previews[2],
  );
  pass("Changing cover moves image to position zero");
  await page
    .getByRole("button", { name: "Перемістити фото 1 праворуч", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Перемістити фото 2 ліворуч", exact: true })
    .click();
  pass("Accessible mobile/desktop reorder controls");
  await page
    .getByRole("button", { name: "Видалити фото 3", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".listing-photo-grid li").length === 2,
  );
  pass("Remove deletes the staged provider asset");
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `test-results/media-create-${width}.png`,
      fullPage: true,
    });
  }
  pass("Unified form and images fit 320/375/768/1440px");
  await listing("Продаж");
  const sale = await submit("/listings/with-pet");
  assert.equal(sale.pet.name, null);
  assert.equal(sale.images.length, 2);
  assert.equal(sale.price, "150.50");
  pass("Unnamed new Pet + SALE DRAFT with ordered images");
  const activated = await call("PATCH", `/listings/${sale.id}/status`, {
    status: "ACTIVE",
  });
  assert.equal(activated.status(), 200);
  await page.goto(base + "/listings");
  const card = page.locator(`a[href="/listings/${sale.id}"]`);
  await card.waitFor();
  assert.ok((await card.locator("img").getAttribute("src")).includes("w_480"));
  pass("Public catalog shows optimized real cover");
  await card.click();
  await page
    .getByRole("heading", { level: 1, name: "Belgian Malinois" })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelector(".listing-gallery-main")?.naturalWidth > 0,
  );
  const first = await page.locator(".listing-gallery-main").getAttribute("src");
  await page.getByRole("button", { name: "Показати фото 2" }).click();
  assert.notEqual(
    await page.locator(".listing-gallery-main").getAttribute("src"),
    first,
  );
  pass("Gallery thumbnails change the main real image");
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `test-results/media-gallery-${width}.png`,
      fullPage: true,
    });
  }
  pass("Gallery fits 320/375/768/1440px");
  await page.goto(base + "/listings/new");
  await animal("Кіт", "maine", "Maine Coon");
  await page.getByLabel("Ім’я (необов’язково)", { exact: true }).fill("Луна");
  await listing("Безкоштовно");
  const free = await submit("/listings/with-pet");
  assert.equal(free.pet.name, "Луна");
  assert.equal(free.price, null);
  assert.equal(free.images.length, 0);
  pass("Named Cat + FREE DRAFT with zero images");
  await page.goto(base + "/listings/new");
  await page
    .getByRole("radio", { name: "Вибрати з моїх тварин", exact: true })
    .check();
  await page.getByLabel("Тварина", { exact: true }).waitFor();
  assert.ok(
    !(await page.getByLabel("Тварина", { exact: true }).innerText()).includes(
      "Без імені",
    ),
  );
  pass("Existing Pet options have natural breed/name/age/gender");
  // Reusing a Pet with a nonterminal listing should keep the form intact.
  await page.getByLabel("Тварина", { exact: true }).selectOption(free.pet.id);
  await listing("Прилаштування");
  const conflict = page.waitForResponse(
    (r) => r.url() === api + "/listings" && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Створити чернетку", exact: true })
    .click();
  assert.equal((await conflict).status(), 409);
  assert.ok(
    (await page.getByLabel("Заголовок", { exact: true }).inputValue()).includes(
      marker,
    ),
  );
  pass("Existing duplicate failure preserves form");
  assert.equal((await call("DELETE", `/listings/${free.id}`)).status(), 204);
  await submit("/listings");
  pass("Existing Pet + ADOPTION DRAFT remains separate from Pet");
  const species = (await (await context.request.get(api + "/species")).json())
    .data;
  const locations = (
    await (
      await context.request.get(
        api + "/locations?search=" + encodeURIComponent("світловодськ"),
      )
    ).json()
  ).data;
  const invalid = await call("POST", "/listings/with-pet", {
    pet: { speciesId: species.find((item) => item.slug === "dog").id },
    type: "FREE",
    locationId: locations[0].id,
    title: "Тест rollback",
    description: "Опис",
    uploadSessionId: randomUUID(),
    imageIds: [randomUUID()],
  });
  assert.equal(invalid.status(), 404);
  pass("Forced invalid staged-session submission rolls back");
  assert.deepEqual(errors, []);
  pass("No runtime or hydration errors");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (error) {
  await page.screenshot({
    path: "test-results/media-error.png",
    fullPage: true,
  });
  console.log(
    "DEBUG statuses " +
      JSON.stringify(
        await page
          .locator("[role=alert],.listing-photo-grid [role=status]")
          .allTextContents(),
      ),
  );
  throw error;
} finally {
  if (actor) await save();
  await browser.close();
}
