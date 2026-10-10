import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { accountTypeFixtures } from "./helpers/account-type-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
    : {}),
});
const fixture = await accountTypeFixtures(),
  base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1",
  checks = [],
  errors = [],
  contexts = [];
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function newPage() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { page, context };
}
async function navigate(page, url) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}
const typePanel = (page) => page.locator(".account-type-settings");
async function account(page, label) {
  await page.waitForURL("**/account");
  await typePanel(page).getByText(label, { exact: true }).waitFor();
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
async function geometry(page, name) {
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
    if (name === "register") {
      assert.equal(await page.getByRole("radio").count(), 2);
      const boxes = await page
        .locator(".account-type-option")
        .evaluateAll((nodes) =>
          nodes.map((n) => ({
            x: n.getBoundingClientRect().x,
            y: n.getBoundingClientRect().y,
            width: n.getBoundingClientRect().width,
          })),
        );
      assert.equal(boxes[0].y === boxes[1].y, width >= 768);
      assert.ok(boxes.every((b) => b.width >= 120));
    }
    await page.screenshot({
      path: "test-results/phase7a-" + name + "-" + width + ".png",
      fullPage: true,
    });
  }
  pass(
    name +
      ": 320/375/430/768/1024/1440px readable cards/actions and no overflow",
  );
}
async function register(type) {
  const { page, context } = await newPage();
  await navigate(page, base + "/register");
  await page.getByRole("radio").first().waitFor();
  assert.equal(await page.locator('input[value="SELLER"]').isChecked(), true);
  if (type === "SELLER") await geometry(page, "register");
  const seller = page.locator('input[value="SELLER"]'),
    breeder = page.locator('input[value="BREEDER"]');
  await seller.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await breeder.isChecked(), true);
  assert.equal(
    await breeder.evaluate((n) => n === document.activeElement),
    true,
  );
  assert.notEqual(
    await page
      .locator(".account-type-option")
      .last()
      .evaluate((n) => getComputedStyle(n).outlineStyle),
    "none",
  );
  await page.keyboard.press("ArrowLeft");
  assert.equal(await seller.isChecked(), true);
  if (type === "BREEDER") await page.keyboard.press("ArrowRight");
  pass(
    type + ": native radios support arrows, checked state and visible focus",
  );
  await page.getByLabel("Ім’я", { exact: true }).fill("Олександр");
  await page.getByLabel("Прізвище", { exact: true }).fill("Єпік");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(
      "onboarding-" +
        type.toLowerCase() +
        "-" +
        fixture.marker +
        "@example.invalid",
    );
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page
    .getByLabel("Підтвердження пароля", { exact: true })
    .fill(fixture.password);
  const response = page.waitForResponse(
    (r) =>
      r.url() === api + "/auth/register" && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Створити акаунт", exact: true })
    .click();
  const result = await response;
  assert.equal(result.status(), 201);
  const body = (await result.json()).data;
  await fixture.track(body.user);
  assert.equal(body.user.accountType, type);
  assert.equal(body.user.role, "USER");
  assert.equal(body.user.verificationStatus, "UNVERIFIED");
  assert.deepEqual(Object.keys(result.request().postDataJSON()).sort(), [
    "accountType",
    "email",
    "firstName",
    "lastName",
    "password",
  ]);
  await account(page, type === "SELLER" ? "Власник тварини" : "Заводчик");
  assert.equal(
    await page.getByRole("link", { name: /Адмін|Модера/ }).count(),
    0,
  );
  await page.reload();
  await account(page, type === "SELLER" ? "Власник тварини" : "Заводчик");
  pass(
    type +
      ": real registration payload, authenticated account and refresh without elevated role/navigation",
  );
  await geometry(page, "account-" + type.toLowerCase());
  await navigate(page, base + "/sellers/" + body.user.id);
  await page
    .getByRole("heading", { name: "Олександр Єпік", exact: true })
    .waitFor();
  assert.equal(
    await page.getByText(body.user.email, { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Приватний продавець", { exact: true }).count(),
    0,
  );
  pass(
    type + ": public seller retains full personal identity and email privacy",
  );
  await navigate(page, base + "/profile");
  await page
    .getByRole("heading", { name: "Публічний профіль продавця" })
    .waitFor();
  for (const label of ["Телефон", "Telegram", "Viber", "WhatsApp"]) {
    const input = page.getByLabel(label, { exact: false });
    assert.equal(await input.getAttribute("required"), null);
    assert.equal(await input.inputValue(), "");
  }
  pass(type + ": all four contacts remain optional");
  if (type === "SELLER") {
    await navigate(page, base + "/pets/new");
    await page
      .getByRole("heading", { name: "Додати тварину", exact: true })
      .waitFor();
    await page
      .locator('#speciesId option[value]:not([value=""])')
      .first()
      .waitFor({ state: "attached" });
    const speciesId = await page
      .locator('#speciesId option[value]:not([value=""])')
      .first()
      .getAttribute("value");
    await page.locator("#speciesId").selectOption(speciesId);
    await page
      .getByLabel("Ім’я (необов’язково)", { exact: true })
      .fill("Тестовий улюбленець");
    const saved = page.waitForResponse(
      (r) => r.url() === api + "/pets" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Додати тварину", exact: true })
      .click();
    assert.equal((await saved).status(), 201);
    await page.waitForURL("**/pets");
    await page
      .getByText("Тестовий улюбленець", { exact: true })
      .first()
      .waitFor();
    await navigate(page, base + "/listings/new");
    await page
      .getByRole("heading", { name: "Створити оголошення", exact: true })
      .waitFor();
    pass(
      "New SELLER creates/views a Pet and can open existing listing creation",
    );
  }
  return { page, context, user: body.user };
}
await mkdir("test-results", { recursive: true });
try {
  await register("SELLER");
  await register("BREEDER");
  const existing = await fixture.existing(),
    { page, context } = await newPage();
  await navigate(page, base + "/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(existing.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await account(page, "Власник тварини");
  const second = await context.newPage();
  second.on("pageerror", (error) => errors.push(error.message));
  await navigate(second, base + "/account");
  await account(second, "Власник тварини");
  const failure = async (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "PRIVATE_DIAGNOSTIC" }),
    });
  await page.route("**/api/v1/account/type", failure);
  await typePanel(page).getByRole("button").click();
  await typePanel(page).getByRole("alert").waitFor();
  assert.equal(
    await typePanel(page)
      .getByText("Власник тварини", { exact: true })
      .isVisible(),
    true,
  );
  assert.ok(
    !(await typePanel(page).innerText()).includes("PRIVATE_DIAGNOSTIC"),
  );
  assert.deepEqual(await fixture.domain(existing.user.id), existing.snapshot);
  await page.unroute("**/api/v1/account/type", failure);
  pass(
    "Failed switch preserves type/data, safe associated error and enabled retry",
  );
  for (const [type, label] of [
    ["BREEDER", "Заводчик"],
    ["SELLER", "Власник тварини"],
  ]) {
    const response = page.waitForResponse(
      (r) =>
        r.url() === api + "/account/type" && r.request().method() === "PATCH",
    );
    await typePanel(page).getByRole("button").click();
    const result = await response;
    assert.equal(result.status(), 200);
    const updated = (await result.json()).data;
    assert.equal(updated.accountType, type);
    assert.equal(updated.role, "USER");
    await account(page, label);
    await account(second, label);
    assert.deepEqual(await fixture.domain(existing.user.id), existing.snapshot);
    await page.reload();
    await account(page, label);
    pass(
      "Existing user switches to " +
        type +
        ": same account, cache/cross-tab/refresh update; Pets/Listings/Profile/all contacts unchanged",
    );
  }
  await navigate(page, base + "/sellers/" + existing.user.id);
  await page
    .getByRole("heading", { name: "Олександр Єпік", exact: true })
    .waitFor();
  await page.locator(".listing-card").first().waitFor();
  assert.equal(await page.locator(".listing-card").count(), 1);
  assert.equal(
    await page.locator(".seller-contacts a, .seller-contacts button").count(),
    4,
  );
  assert.equal(
    await page.getByText(existing.user.email, { exact: true }).count(),
    0,
  );
  await navigate(page, base + "/listings/" + existing.listing.id);
  await page
    .getByRole("link", { name: "Переглянути профіль", exact: true })
    .waitFor();
  pass(
    "Public seller ACTIVE listings and detail seller card retain identity/contacts",
  );
  await navigate(page, base + "/profile");
  await page
    .getByRole("heading", { name: "Публічний профіль продавця" })
    .waitFor();
  await page.getByLabel("Telegram", { exact: false }).fill("@updated_fixture");
  const profileSave = page.waitForResponse(
    (r) => r.url() === api + "/profile" && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Зберегти профіль", exact: true })
    .click();
  assert.equal((await profileSave).status(), 200);
  await page
    .getByText("Публічний профіль збережено.", { exact: true })
    .waitFor();
  const domain = await fixture.domain(existing.user.id);
  assert.equal(domain.profile.telegram, "updated_fixture");
  for (const field of ["phone", "viber", "whatsapp"])
    assert.equal(domain.profile[field], existing.snapshot.profile[field]);
  pass(
    "Existing public-contact editor saves after type switches; independent contacts remain",
  );
  await navigate(page, base + "/account");
  await account(page, "Власник тварини");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await second
    .getByRole("heading", { name: "Увійти до акаунта", exact: true })
    .waitFor();
  pass("Cross-tab logout still clears authenticated account and redirects");
  assert.deepEqual(errors, []);
  pass("No browser runtime/hydration errors");
  await writeFile(
    "test-results/phase7a-browser.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await fixture.cleanup();
  console.log("All 15 original database fingerprints restored");
}
