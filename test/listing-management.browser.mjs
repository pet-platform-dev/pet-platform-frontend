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
const created = [],
  checks = [],
  errors = [];
let actor, token, csrf, location, dog;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXcAAAAASUVORK5CYII=",
  "base64",
);
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results", { recursive: true });
const manifest = () =>
  writeFile(
    `test-results/management-fixtures-${actor}.json`,
    JSON.stringify({ userId: actor, email, listingIds: created }, null, 2),
  );
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
async function data(response, code = 200) {
  assert.equal(response.status(), code, await response.text());
  return (await response.json()).data;
}
async function detail(id) {
  return data(await call("GET", `/listings/${id}`));
}
async function addReady() {
  const session = (
    await data(await call("POST", "/uploads/listings/session"), 201)
  ).uploadSessionId;
  const response = await context.request.post(
    `${api}/uploads/listings/${session}/images`,
    {
      headers: headers(),
      multipart: {
        file: { name: "fixture.png", mimeType: "image/png", buffer: png },
      },
    },
  );
  return {
    uploadSessionId: session,
    imageIds: [(await data(response, 201)).id],
  };
}
async function fixture(type = "FREE", photos = false) {
  const listing = await data(
    await call("POST", "/listings/with-pet", {
      pet: { speciesId: dog.id },
      locationId: location.id,
      type,
      title: `Тест медіа ${marker}`,
      description: "Тимчасова перевірка керування оголошенням",
      ...(type === "SALE" ? { price: "125.50" } : {}),
      ...(photos ? await addReady() : {}),
    }),
    201,
  );
  created.push(listing.id);
  await manifest();
  return listing;
}
async function openEditor(id) {
  await page.goto(`${base}/listings/${id}/edit`);
  await page
    .getByRole("heading", { name: "Редагувати оголошення", exact: true })
    .waitFor();
}
async function save() {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      /\/listings\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await data(await response);
  await page.getByText("Зміни збережено.", { exact: true }).waitFor();
}
async function uploadUI(count = 1) {
  await page.getByLabel("Додати фото", { exact: true }).setInputFiles(
    Array.from({ length: count }, (_, i) => ({
      name: `fixture-${i}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".listing-photo-grid [role=status]")].every(
      (node) => node.textContent === "Завантажено",
    ),
  );
}
async function publish(id) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/listings/${id}/status`) &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await data(await response);
  await page.getByText("Оголошення опубліковано.", { exact: true }).waitFor();
}
async function confirmed(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.waitFor();
  assert.ok(
    await dialog
      .getByText("Оголошення більше не відображатиметься", { exact: false })
      .isVisible(),
  );
  assert.ok(
    await page.evaluate(() =>
      document.activeElement?.textContent?.includes("Скасувати"),
    ),
  );
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith("/status"),
  );
  await dialog
    .getByRole("button", { name: "Підтвердити", exact: true })
    .click();
  await data(await response);
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
}
async function fillNew(type = "Безкоштовно") {
  await page.goto(base + "/listings/new");
  await page.getByRole("heading", { name: "Створити оголошення" }).waitFor();
  await page
    .getByLabel("Вид тварини", { exact: true })
    .selectOption({ label: "Собака" });
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
    .fill("Тимчасова перевірка нової форми");
  if (type === "Продаж")
    await page.getByLabel("Ціна, ₴", { exact: true }).fill("25.50");
}
async function createUI(publish = false) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/listings/with-pet"),
  );
  await page
    .getByRole("button", {
      name: publish ? "Опублікувати" : "Зберегти чернетку",
      exact: true,
    })
    .click();
  const listing = await data(await response, 201);
  created.push(listing.id);
  await manifest();
  await page.getByRole("heading", { name: "Оголошення створено" }).waitFor();
  return listing;
}
try {
  await page.goto(base + "/my-listings");
  await page.waitForURL("**/login");
  pass("Logged-out My Listings redirects to login");
  await page.goto(`${base}/listings/${randomUUID()}/edit`);
  await page.waitForURL("**/login");
  pass("Logged-out editor redirects to login");
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
      data: { email, password, firstName: "Тест" },
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
  await page.getByLabel("Електронна адреса", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  pass("Existing authentication login works");
  await page.getByRole("link", { name: "Мої оголошення", exact: true }).click();
  await page
    .getByRole("heading", { name: "У вас ще немає оголошень" })
    .waitFor();
  pass("Authenticated navigation and empty dashboard");
  const sale = await fixture("SALE");
  await page.goto(base + "/my-listings");
  await page.locator(".owner-listing-card").waitFor();
  pass("Owner draft card shows Ukrainian status and edit");
  await page.getByRole("button", { name: "Активні", exact: true }).click();
  await page
    .getByText("У цій категорії поки немає оголошень", { exact: true })
    .waitFor();
  pass("Status filtering and filtered empty state");
  await openEditor(sale.id);
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill(`Тест медіа ${marker} оновлено`);
  await save();
  pass("Draft title save confirmed");
  await page.reload();
  assert.equal(
    await page.getByLabel("Заголовок", { exact: true }).inputValue(),
    `Тест медіа ${marker} оновлено`,
  );
  pass("Draft edit persists on refresh");
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page
    .getByText("Додайте щонайменше одну фотографію перед публікацією.", {
      exact: true,
    })
    .waitFor();
  assert.equal((await detail(sale.id)).status, "DRAFT");
  pass("Zero-image publication is blocked with explanation");
  await uploadUI(2);
  assert.equal(await page.locator(".listing-photo-grid li").count(), 2);
  pass("Real Cloudinary photos added in editor");
  await page
    .getByRole("button", { name: "Зробити головним", exact: true })
    .click();
  await save();
  const before = (await detail(sale.id)).images[0].id;
  pass("Reorder persists cover and image IDs");
  await publish(sale.id);
  assert.equal((await detail(sale.id)).status, "ACTIVE");
  pass("Draft publish confirmed ACTIVE");
  await page.goto(base + "/listings");
  await page.locator(`a[href="/listings/${sale.id}"]`).waitFor();
  assert.ok(
    await page.locator(`a[href="/listings/${sale.id}"] img`).isVisible(),
  );
  pass("Public catalog contains published cover");
  await page.goto(`${base}/listings/${sale.id}`);
  await page.locator(".listing-gallery").waitFor();
  pass("Public detail renders gallery");
  await openEditor(sale.id);
  assert.ok(
    await page
      .getByRole("radio", { name: "Безкоштовно", exact: true })
      .isDisabled(),
  );
  pass("ACTIVE type is immutable in editor");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Оновлений опис активного оголошення");
  await save();
  await page.goto(`${base}/listings/${sale.id}`);
  await page
    .getByText("Оновлений опис активного оголошення", { exact: true })
    .waitFor();
  pass("ACTIVE description save updates public detail");
  await openEditor(sale.id);
  await page
    .getByRole("button", { name: "Видалити фото 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Видалити фото 1", exact: true })
    .click();
  await page
    .getByText("Активне оголошення повинно мати щонайменше одну фотографію", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".listing-photo-grid li").count(), 1);
  await save();
  pass("ACTIVE last-photo guard keeps one ready image");
  assert.equal(
    (await call("PATCH", `/listings/${sale.id}`, { images: [] })).status(),
    400,
  );
  assert.equal((await detail(sale.id)).images[0].id, before);
  pass("Backend final-photo invariant and retained cover");
  await confirmed("Позначити як продане");
  assert.equal((await detail(sale.id)).status, "SOLD");
  pass("SALE completion requires accessible confirmation");
  assert.equal(
    (await context.request.get(`${api}/listings/${sale.id}`)).status(),
    404,
  );
  await page.goto(base + "/my-listings");
  await page.getByRole("button", { name: "Завершені", exact: true }).click();
  await page.getByText("Продано", { exact: true }).waitFor();
  pass("Completed listing is private and in completed group");
  await page.goto(`${base}/listings/${sale.id}/edit`);
  await page
    .getByText("Завершені та архівні оголошення не можна редагувати.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator("form").count(), 0);
  pass("Completed editor is read-only");
  for (const [type, label, status] of [
    ["FREE", "Позначити як передане", "TRANSFERRED"],
    ["ADOPTION", "Позначити як прилаштоване", "ADOPTED"],
  ]) {
    const item = await fixture(type, true);
    await data(
      await call("PATCH", `/listings/${item.id}/status`, { status: "ACTIVE" }),
    );
    await openEditor(item.id);
    await confirmed(label);
    assert.equal((await detail(item.id)).status, status);
    assert.equal(
      (await context.request.get(`${api}/listings/${item.id}`)).status(),
      404,
    );
    pass(`${type} completes as ${status}`);
  }
  for (const active of [false, true]) {
    const item = await fixture("FREE", active);
    if (active)
      await data(
        await call("PATCH", `/listings/${item.id}/status`, {
          status: "ACTIVE",
        }),
      );
    await openEditor(item.id);
    await confirmed("В архів");
    assert.equal((await detail(item.id)).status, "ARCHIVED");
    pass(`${active ? "ACTIVE" : "DRAFT"} archive preserves history`);
  }
  await fillNew();
  const draft = await createUI();
  await page
    .getByText("Воно збережене як чернетка.", { exact: true })
    .waitFor();
  assert.equal((await detail(draft.id)).status, "DRAFT");
  pass("New form saves draft without photos");
  await fillNew("Продаж");
  await uploadUI();
  const published = await createUI(true);
  await page.getByText("Оголошення опубліковано.", { exact: true }).waitFor();
  assert.equal((await detail(published.id)).status, "ACTIVE");
  pass("New form publishes only after server transition");
  await fillNew();
  await uploadUI();
  await page.route("**/api/v1/listings/*/status", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "offline" }),
    }),
  );
  const failed = await createUI(true);
  await page
    .getByText("Чернетку створено, але опублікувати не вдалося.", {
      exact: true,
    })
    .waitFor();
  assert.equal((await detail(failed.id)).status, "DRAFT");
  assert.ok(
    await page
      .getByRole("link", { name: "Відкрити оголошення", exact: true })
      .isVisible(),
  );
  await page.unroute("**/api/v1/listings/*/status");
  pass("Failed immediate publish retains accessible draft");
  const publicRows = await data(
    await context.request.get(api + "/listings?limit=100"),
  );
  const foreign = publicRows.find((item) => item.seller.id !== actor);
  assert.ok(foreign);
  await page.goto(`${base}/listings/${foreign.id}/edit`);
  await page.getByRole("heading", { name: "Оголошення не знайдено" }).waitFor();
  assert.equal(
    (
      await call("PATCH", `/listings/${foreign.id}`, { title: "Чужа зміна" })
    ).status(),
    404,
  );
  assert.equal(
    (
      await call("PATCH", `/listings/${foreign.id}/status`, {
        status: "ARCHIVED",
      })
    ).status(),
    404,
  );
  pass("Foreign ACTIVE editor and mutations concealed");
  await page.goto(base + "/my-listings");
  await page
    .getByRole("heading", { name: "Мої оголошення", exact: true })
    .waitFor();
  await page.locator(".owner-listing-card").first().waitFor();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("button", { name: "Усі", exact: true }).focus();
    assert.ok(
      await page
        .getByRole("button", { name: "Усі", exact: true })
        .evaluate((node) => node === document.activeElement),
    );
    await page.screenshot({
      path: `test-results/management-list-${width}.png`,
      fullPage: true,
    });
    pass(`Owner list ${width}px no overflow and keyboard focus`);
  }
  await openEditor(published.id);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `test-results/management-edit-${width}.png`,
      fullPage: true,
    });
    pass(`Editor ${width}px no overflow`);
  }
  const demo = await browser.newContext(),
    demoPage = await demo.newPage();
  await demoPage.goto(base + "/login");
  await demoPage
    .getByLabel("Електронна адреса", { exact: true })
    .fill("demo.owner1@example.test");
  await demoPage.getByLabel("Пароль", { exact: true }).fill("DemoPass123!");
  await demoPage.getByRole("button", { name: "Увійти", exact: true }).click();
  await demoPage.waitForURL("**/account");
  await demoPage.goto(base + "/my-listings");
  await demoPage.locator(".owner-listing-card").first().waitFor();
  await demo.close();
  pass("Existing demo account lists history without modification");
  assert.deepEqual(errors, []);
  pass("No runtime or hydration errors");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (error) {
  await page.screenshot({
    path: "test-results/management-error.png",
    fullPage: true,
  });
  console.log(
    "DEBUG " +
      JSON.stringify(await page.locator("[role=alert]").allTextContents()),
  );
  throw error;
} finally {
  if (actor) await manifest();
  await browser.close();
}
