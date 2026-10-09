import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const { expect } = await import(
  process.env.PLAYWRIGHT_EXPECT_MODULE_URL ?? "@playwright/test"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
context.setDefaultTimeout(30000);
const page = await context.newPage(),
  base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
const marker = randomUUID(),
  email = `browser-media-${marker}@example.invalid`,
  password = "Test-fixture-only-1234";
const checks = [],
  errors = [],
  created = [],
  requests = [];
let actor, token, csrf, location, dog;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXcAAAAASUVORK5CYII=",
  "base64",
);
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
await mkdir("test-results", { recursive: true });
const manifest = () =>
  writeFile(
    `test-results/polish-fixtures-${actor}.json`,
    JSON.stringify({ userId: actor, email, listingIds: created }, null, 2),
  );
const headers = () => ({
  Origin: base,
  "X-CSRF-Token": csrf,
  Authorization: `Bearer ${token}`,
});
async function data(response, status = 200) {
  assert.equal(
    response.status(),
    status,
    `Unexpected HTTP status ${response.status()}`,
  );
  return (await response.json()).data;
}
async function call(method, path, body) {
  return context.request.fetch(api + path, {
    method,
    headers: headers(),
    ...(body ? { data: body } : {}),
  });
}
async function login() {
  await page.getByLabel("Електронна адреса", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/auth/login") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  token = (await data(await response)).accessToken;
  await page.waitForURL("**/account");
}
async function newPage() {
  await page
    .locator("header")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Мої оголошення", exact: true })
    .waitFor();
  await page
    .locator("main")
    .getByRole("link", { name: "Створити оголошення", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Створити оголошення", exact: true })
    .waitFor();
}
async function fill(type = "Продаж") {
  await page.getByLabel("Вид тварини", { exact: true }).selectOption(dog.id);
  await page.getByRole("radio", { name: type, exact: true }).check();
  await page
    .getByRole("combobox", { name: "Місце", exact: true })
    .fill("світловодськ");
  await page
    .locator(".reference-results [role=option]")
    .filter({ has: page.getByText("Світловодськ", { exact: true }) })
    .first()
    .getByRole("button")
    .click();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(`Тест медіа ${marker}`);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Опис тварини для наскрізної перевірки");
  if (type === "Продаж")
    await page.getByLabel("Ціна, ₴", { exact: true }).fill("25000.50");
}
async function upload(count = 1) {
  await page.getByLabel("Додати фото", { exact: true }).setInputFiles(
    Array.from({ length: count }, (_, i) => ({
      name: `polish-${i}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect(page.locator(".listing-photo-grid li")).toHaveCount(count);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".listing-photo-grid [role=status]")].every(
        (node) => node.textContent === "Завантажено",
      ),
    undefined,
    { timeout: 180000 },
  );
}
async function create(publish) {
  const before = requests.filter(
    (r) =>
      r.method === "POST" &&
      /\/listings(?:\/with-pet)?$/.test(new URL(r.url).pathname),
  ).length;
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      /\/listings(?:\/with-pet)?$/.test(new URL(r.url()).pathname),
  );
  await page
    .getByRole("button", {
      name: publish ? "Опублікувати" : "Зберегти чернетку",
      exact: true,
    })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  const listing = await data(await response, 201);
  created.push(listing.id);
  await manifest();
  await page
    .getByRole("heading", { name: "Оголошення створено", exact: true })
    .waitFor();
  assert.equal(
    requests.filter(
      (r) =>
        r.method === "POST" &&
        /\/listings(?:\/with-pet)?$/.test(new URL(r.url).pathname),
    ).length - before,
    1,
    "Repeated create/publish must submit once",
  );
  return data(await call("GET", `/listings/${listing.id}`));
}
async function save(id) {
  const before = requests.filter(
    (r) => r.url.endsWith(`/listings/${id}`) && r.method === "PATCH",
  ).length;
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/listings/${id}`) && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await data(await response);
  await page.getByText("Зміни збережено.", { exact: true }).waitFor();
  assert.equal(
    requests.filter(
      (r) => r.url.endsWith(`/listings/${id}`) && r.method === "PATCH",
    ).length - before,
    1,
    "Repeated save must submit once",
  );
}
async function complete(label) {
  const before = requests.filter(
    (r) => r.url.endsWith("/status") && r.method === "PATCH",
  ).length;
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.waitFor();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/status") && r.request().method() === "PATCH",
  );
  await dialog
    .getByRole("button", { name: "Підтвердити", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await data(await response);
  await expect(dialog).toHaveCount(0);
  assert.equal(
    requests.filter((r) => r.url.endsWith("/status") && r.method === "PATCH")
      .length - before,
    1,
    "Repeated completion/archive must submit once",
  );
}
page.on("pageerror", (error) => errors.push(error.message));
context.on("request", (request) => {
  if (request.url().startsWith(api))
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
    });
});
try {
  csrf = (
    await data(
      await context.request.get(api + "/auth/csrf", {
        headers: { Origin: base },
      }),
    )
  ).csrfToken;
  const registered = await data(
    await context.request.post(api + "/auth/register", {
      headers: { Origin: base, "X-CSRF-Token": csrf },
      data: { email, password, firstName: "Тест".repeat(20) },
    }),
    201,
  );
  actor = registered.user.id;
  token = registered.accessToken;
  await manifest();
  dog = (await data(await context.request.get(api + "/species"))).find(
    (item) => item.slug === "dog",
  );
  location = (
    await data(
      await context.request.get(
        api + "/locations?search=" + encodeURIComponent("світловодськ"),
      ),
    )
  )[0];
  await page.goto(base + "/login");
  await login();
  await newPage();
  await fill();
  const breedInput = page.getByRole("combobox", {
    name: /Порода/,
  });
  await breedInput.fill("malinois");
  await page
    .locator(".reference-results [role=option]")
    .first()
    .getByRole("button")
    .click();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(
      `Тест медіа ${marker} ${"Довгий заголовок ".repeat(10)}`.slice(0, 160),
    );
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Детальний опис українською. ".repeat(150));
  await upload(10);
  await page
    .getByRole("button", { name: "Зробити головним", exact: true })
    .last()
    .click();
  const sale = await create(true);
  assert.equal(sale.status, "ACTIVE");
  assert.equal(sale.price, "25000.50");
  assert.equal(sale.images.length, 10);
  assert.equal(sale.pet.name, null);
  assert.ok(sale.pet.breed);
  pass(
    "A: new unnamed Dog SALE publishes ten real Cloudinary photos with reordered cover and exact price",
  );
  await page
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Активні", exact: true }).click();
  await expect(
    page.locator(`a[href='/listings/${sale.id}/edit']`),
  ).toBeVisible();
  await page.locator(`a[href='/listings/${sale.id}/edit']`).click();
  for (const [route, name] of [
    ["/listings", "catalog"],
    [`/listings/${sale.id}`, "detail"],
    ["/listings/new", "create"],
    ["/my-listings", "management"],
    [`/listings/${sale.id}/edit`, "edit"],
  ]) {
    await page.goto(base + route);
    await page.locator("main h1").waitFor();
    if (name === "catalog")
      await page.locator(".listing-card").first().waitFor();
    if (name === "edit")
      await page.getByLabel("Заголовок", { exact: true }).waitFor();
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name} overflow at ${width}`,
      );
      await page.screenshot({
        path: `test-results/polish-${name}-${width}.png`,
        fullPage: true,
      });
      pass(`${name} ${width}px: no horizontal overflow`);
    }
  }
  await page.goto(base + `/listings/${sale.id}`);
  assert.equal(await page.locator("main h1").count(), 1);
  assert.equal(
    await page.locator(".listing-gallery-thumbnails button").count(),
    10,
  );
  await page
    .getByRole("button", { name: "Показати фото 10", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Показати фото 10", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  assert.ok(!(await page.locator("main").innerText()).includes("Без імені"));
  pass(
    "A: gallery ten-image keyboard selection, breed h1, unnamed presentation and long text remain usable",
  );
  await page.goto(base + `/listings/${sale.id}/edit`);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Змінений опис після публікації");
  await page
    .getByRole("button", { name: "Зробити головним", exact: true })
    .first()
    .click();
  await save(sale.id);
  const edited = await data(await call("GET", `/listings/${sale.id}`));
  assert.notEqual(edited.images[0].id, sale.images[0].id);
  await page
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .last()
    .click();
  await page.locator(`a[href='/listings/${sale.id}']`).click();
  await page
    .getByText("Змінений опис після публікації", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".listing-gallery-main").getAttribute("src"),
    edited.images[0].url,
  );
  pass(
    "A: ACTIVE content and cover edits update public detail through client navigation",
  );
  await page.goto(base + "/listings");
  const card = page.locator(`.listing-card a[href='/listings/${sale.id}']`);
  await card.waitFor();
  assert.equal(
    await card.locator("img").getAttribute("src"),
    edited.images[0].thumbnailUrl,
  );
  assert.ok((await card.innerText()).includes("25 000,5"));
  pass("A: catalog displays updated optimized cover and uk-UA price");
  await page.goto(base + `/listings/${sale.id}/edit`);
  await complete("Позначити як продано");
  const sold = await data(await call("GET", `/listings/${sale.id}`));
  assert.equal(sold.status, "SOLD");
  assert.equal(
    (await context.request.get(api + `/listings/${sale.id}`)).status(),
    404,
  );
  await page.goto(base + "/listings");
  await page.locator(".listing-card").first().waitFor();
  assert.equal(await page.locator(`a[href='/listings/${sale.id}']`).count(), 0);
  pass(
    "A: SOLD disappears from public catalog/detail and remains owner history",
  );
  await page
    .locator("header")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page.getByRole("button", { name: "Завершені", exact: true }).click();
  await page.getByText("Продано", { exact: true }).waitFor();
  await newPage();
  await fill("Безкоштовно");
  await page
    .getByRole("radio", { name: "Вибрати з моїх тварин", exact: true })
    .check();
  await page.getByLabel("Тварина", { exact: true }).selectOption(sale.pet.id);
  const recoveryTitle = `Тест медіа ${marker} відновлення`;
  await page.getByLabel("Заголовок", { exact: true }).fill(recoveryTitle);
  await call("POST", "/auth/logout");
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL("**/login");
  await login();
  await newPage();
  await expect(page.getByLabel("Заголовок", { exact: true })).toHaveValue(
    recoveryTitle,
  );
  await expect(page.getByLabel("Тварина", { exact: true })).toHaveValue(
    sale.pet.id,
  );
  await page
    .getByText("Відновлено незбережений текст у цій вкладці.", { exact: false })
    .waitFor();
  pass(
    "Expired create mutation redirects safely; same-user SPA login restores text, selected existing Pet and Location",
  );
  const free = await create(false);
  assert.equal(free.pet.id, sale.pet.id);
  assert.equal(free.status, "DRAFT");
  assert.equal(free.price, null);
  await page
    .getByRole("link", { name: "Відкрити оголошення", exact: true })
    .click();
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Відновлений незбережений опис редактора");
  await call("POST", "/auth/logout");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.waitForURL("**/login");
  await login();
  await page
    .locator("header")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page.locator(`a[href='/listings/${free.id}/edit']`).click();
  await expect(page.getByLabel("Опис", { exact: true })).toHaveValue(
    "Відновлений незбережений опис редактора",
  );
  pass(
    "Expired editor mutation preserves unsaved text for same-user reauthentication without exposing private queries",
  );
  await upload();
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page.getByText("Оголошення опубліковано.", { exact: true }).waitFor();
  await complete("Позначити як передано");
  assert.equal(
    (await data(await call("GET", `/listings/${free.id}`))).status,
    "TRANSFERRED",
  );
  pass(
    "B: existing Pet FREE draft → add real photo → publish → TRANSFERRED without zero price",
  );
  await newPage();
  await fill("Прилаштування");
  await page.getByLabel("Колір (необов’язково)", { exact: true }).fill("Рудий");
  let uploadStarted, releaseUpload;
  const uploadReady = new Promise((resolve) => {
      uploadStarted = resolve;
    }),
    blockedUpload = new Promise((resolve) => {
      releaseUpload = resolve;
    });
  await page.route(api + "/uploads/listings/*/images", async (route) => {
    uploadStarted();
    await blockedUpload;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Session expired" }),
    });
  });
  await page
    .getByLabel("Додати фото", { exact: true })
    .setInputFiles({ name: "expired.png", mimeType: "image/png", buffer: png });
  await uploadReady;
  await call("POST", "/auth/logout");
  releaseUpload();
  await page.waitForURL("**/login");
  await page.unroute(api + "/uploads/listings/*/images");
  await login();
  await newPage();
  await expect(page.getByLabel("Вид тварини", { exact: true })).toHaveValue(
    dog.id,
  );
  await expect(
    page.getByLabel("Колір (необов’язково)", { exact: true }),
  ).toHaveValue("Рудий");
  await expect(page.locator(".listing-photo-grid li")).toHaveCount(0);
  pass(
    "Expiry during upload cancels staging, restores animal/text selections after login and explicitly requires photos again",
  );
  await upload();
  const adoption = await create(true);
  assert.equal(adoption.pet.name, null);
  await page
    .getByRole("link", { name: "Відкрити оголошення", exact: true })
    .click();
  await complete("Позначити як прилаштовано");
  assert.equal(
    (await data(await call("GET", `/listings/${adoption.id}`))).status,
    "ADOPTED",
  );
  pass(
    "C: unnamed new Pet ADOPTION publishes and completes as ADOPTED without fake name or price",
  );
  await newPage();
  await fill("Продаж");
  await page.getByLabel("Ціна, ₴", { exact: true }).fill("");
  const draft = await create(false);
  await page
    .getByRole("link", { name: "Відкрити оголошення", exact: true })
    .click();
  await complete("В архів");
  assert.equal(
    (await data(await call("GET", `/listings/${draft.id}`))).status,
    "ARCHIVED",
  );
  assert.equal(
    (await context.request.get(api + `/listings/${draft.id}`)).status(),
    404,
  );
  assert.equal(
    (await data(await call("GET", `/listings/${draft.id}`))).price,
    null,
  );
  pass(
    "D: unpriced SALE draft archive retains seller history and is never public",
  );
  const imageListing = await data(
    await call("POST", "/listings/with-pet", {
      pet: { speciesId: dog.id },
      type: "FREE",
      locationId: location.id,
      title: `Тест медіа ${marker} fallback`,
      description: "Перевірка недоступного фото",
    }),
    201,
  );
  created.push(imageListing.id);
  await manifest();
  await page.goto(base + `/listings/${imageListing.id}/edit`);
  await upload();
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page.getByText("Оголошення опубліковано.", { exact: true }).waitFor();
  await page.route("https://res.cloudinary.com/**", (route) => route.abort());
  await page.goto(base + "/listings");
  await page
    .locator(`a[href='/listings/${imageListing.id}'] .listing-visual`)
    .waitFor();
  await page.goto(base + `/listings/${imageListing.id}`);
  await page.locator(".listing-gallery .listing-visual").waitFor();
  await page.goto(base + "/my-listings");
  await page
    .locator(
      `.owner-listing-card:has(a[href='/listings/${imageListing.id}/edit'])`,
    )
    .scrollIntoViewIfNeeded();
  await page
    .locator(
      `.owner-listing-card:has(a[href='/listings/${imageListing.id}/edit']) .listing-visual`,
    )
    .waitFor();
  await page.unroute("https://res.cloudinary.com/**");
  pass(
    "Broken provider images fall back on catalog, detail and owner cards without crashing",
  );
  const delivered = await data(
    await call("GET", `/listings/${imageListing.id}`),
  );
  const longBreed = "ДовгаУкраїнськаНазваПороди".repeat(6);
  const longRow = {
    ...delivered,
    type: "SALE",
    price: "9999999999.99",
    title: "Довгий заголовок ".repeat(10).slice(0, 160),
    description: "Довгий опис українською. ".repeat(200),
    pet: {
      ...delivered.pet,
      name: "Необов’язковеІм’я".repeat(8),
      breed: {
        id: randomUUID(),
        name: longBreed,
        nameUk: null,
        slug: "long-breed",
      },
    },
    location: {
      ...delivered.location,
      city: "ДовгаУкраїнськаНазваСела".repeat(6),
      region: "ДовгаУкраїнськаНазваОбласті".repeat(6),
    },
    seller: { ...delivered.seller, firstName: "ДовгеІм’яПродавця".repeat(6) },
  };
  // Browser-only delivery fixtures: no reference/demo records are rewritten.
  await page.route(api + "/listings?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [longRow],
        meta: { page: 1, limit: 24, pages: 1, total: 1 },
      }),
    }),
  );
  await page.goto(base + "/listings");
  await expect(page.locator(".listing-card h2")).toHaveText(longBreed);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Long catalog overflow ${width}`,
    );
  }
  await page.unroute(api + "/listings?*");
  await page.goto(base + `/listings/${imageListing.id}`);
  await page.waitForLoadState("networkidle");
  await page.route(api + `/listings/${imageListing.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: longRow }),
    }),
  );
  await page.clock.install({ time: Date.now() });
  await page.clock.fastForward(31000);
  await page.clock.resume();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.locator("main h1")).toHaveText(longBreed);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Long detail overflow ${width}`,
    );
  }
  await page.clock.setSystemTime(Date.now());
  await page.unroute(api + `/listings/${imageListing.id}`);
  pass(
    "Long breed/settlement/seller/description/name and maximum Decimal price fit catalog/detail at all five widths",
  );
  await page.goto(base + "/listings/not-a-uuid");
  await page
    .getByRole("heading", { name: "Оголошення не знайдено", exact: true })
    .waitFor();
  await page.goto(base + `/listings/${randomUUID()}`);
  await page
    .getByRole("heading", { name: "Оголошення не знайдено", exact: true })
    .waitFor();
  await page.goto(base + "/listings/not-a-uuid/edit");
  await page
    .getByRole("heading", { name: "Оголошення не знайдено", exact: true })
    .waitFor();
  pass(
    "Invalid and nonexistent public/editor URLs use coherent unavailable states",
  );
  await page.goto(base + "/listings?page=2&sort=oldest");
  await page.locator(".listing-card").first().waitFor();
  await page.reload();
  await expect(page.getByLabel("Сортування", { exact: true })).toHaveValue(
    "oldest",
  );
  await page.getByLabel("Сортування", { exact: true }).selectOption("newest");
  await page.waitForURL(
    (url) =>
      url.pathname === "/listings" && url.searchParams.get("sort") === "newest",
  );
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  assert.ok(page.url().includes("page=2"));
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("sort") === "newest");
  assert.ok(page.url().includes("sort=newest"));
  pass("Catalog page/sort survives direct URL, refresh, back and forward");
  const privateTab = await context.newPage();
  privateTab.on("pageerror", (error) => errors.push(error.message));
  await privateTab.goto(base + "/my-listings");
  await privateTab.locator(".owner-listing-card").first().waitFor();
  const publicTab = await context.newPage();
  publicTab.on("pageerror", (error) => errors.push(error.message));
  let release, started;
  const held = new Promise((resolve) => {
      release = resolve;
    }),
    ready = new Promise((resolve) => {
      started = resolve;
    });
  await publicTab.route(api + "/listings?*", async (route) => {
    started();
    await held;
    await route.continue();
  });
  const detailTab = await context.newPage();
  detailTab.on("pageerror", (error) => errors.push(error.message));
  await detailTab.goto(base + `/listings/${imageListing.id}`);
  await detailTab.locator("main h1").waitFor();
  await detailTab.waitForLoadState("networkidle");
  let detailStarted, releaseDetail;
  const detailReady = new Promise((resolve) => {
      detailStarted = resolve;
    }),
    detailHeld = new Promise((resolve) => {
      releaseDetail = resolve;
    });
  await detailTab.route(api + `/listings/${imageListing.id}`, async (route) => {
    detailStarted();
    await detailHeld;
    await route.continue();
  });
  await detailTab.clock.install({ time: Date.now() });
  await detailTab.clock.fastForward(31000);
  await detailTab.clock.resume();
  await detailTab.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await detailReady;
  // Clock is context-wide: start the held catalog only after advancing the detail clock.
  await publicTab.goto(base + "/listings");
  await ready;
  await page.goto(base + "/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await privateTab.waitForURL("**/login");
  assert.equal(await privateTab.locator(".owner-listing-card").count(), 0);
  const detailFinished = detailTab.waitForResponse(
    (response) =>
      response.url() === api + `/listings/${imageListing.id}` &&
      response.request().method() === "GET",
  );
  release();
  releaseDetail();
  await data(await detailFinished);
  await publicTab.locator(".listing-card").first().waitFor();
  await expect(detailTab.locator("main h1")).not.toHaveText(
    "Оголошення не знайдено",
  );
  await expect(detailTab.locator("main h1")).not.toHaveText(
    "Не вдалося завантажити оголошення",
  );
  pass(
    "Cross-tab real logout hides loaded private listings while in-flight public catalog and detail remain usable",
  );
  await login();
  await newPage();
  await fill("Безкоштовно");
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(`Тест медіа ${marker} private recovery`);
  await call("POST", "/auth/logout");
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL("**/login");
  const otherEmail = `browser-media-${randomUUID()}@example.invalid`;
  const other = await data(
    await context.request.post(api + "/auth/register", {
      headers: { Origin: base, "X-CSRF-Token": csrf },
      data: { email: otherEmail, password, firstName: "Інший" },
    }),
    201,
  );
  await writeFile(
    `test-results/polish-fixtures-${other.user.id}.json`,
    JSON.stringify(
      { userId: other.user.id, email: otherEmail, listingIds: [] },
      null,
      2,
    ),
  );
  await page.getByLabel("Електронна адреса", { exact: true }).fill(otherEmail);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await newPage();
  await expect(page.getByLabel("Заголовок", { exact: true })).toHaveValue("");
  await page
    .locator("header")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "У вас ще немає оголошень", exact: true })
    .waitFor();
  pass(
    "Same-tab account switching never restores another seller's form or cached private listings",
  );
  const publicReads = requests.filter(
    (r) =>
      r.method === "GET" &&
      (/\/listings\?/.test(r.url) ||
        (/\/listings\/[0-9a-f-]+$/.test(r.url) && !r.headers.authorization)),
  );
  assert.ok(publicReads.length > 0);
  assert.ok(
    publicReads.every(
      (r) => !r.headers.authorization && !r.headers["x-csrf-token"],
    ),
  );
  assert.ok(requests.length < 350, "Runaway API requests");
  assert.deepEqual(errors, []);
  pass(
    "No runtime/hydration errors, runaway requests, or auth/CSRF headers on public GETs",
  );
} finally {
  if (actor) await manifest();
  await writeFile(
    "test-results/polish-summary.json",
    JSON.stringify(
      {
        checks,
        count: checks.length,
        apiRequests: requests.length,
        runtimeErrors: errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    passed: checks.length,
    fixtureManifest: `test-results/polish-fixtures-${actor}.json`,
  }),
);
