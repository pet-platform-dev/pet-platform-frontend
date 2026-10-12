import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const checks = [],
  errors = [];
let f;
page.on("pageerror", (e) => errors.push(e.message));
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
async function go(path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
async function login(actor) {
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.locator(".dashboard-grid").waitFor();
}
async function widths(label) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow " + width,
    );
    for (const el of await page
      .locator(
        "main .button,main .dashboard-text-link,main input:not([type=radio]),main textarea,main [role=combobox]",
      )
      .all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      assert.ok(
        box.x >= -1 && box.x + box.width <= width + 1,
        label + " bounds " + width,
      );
      if (
        await el.evaluate((el) =>
          el.matches(".button,.dashboard-text-link,[role=combobox]"),
        )
      )
        assert.ok(box.height >= 44, label + " target " + width);
    }
    if (label.startsWith("account") && width >= 1024) {
      const box = await page.locator(".account-dashboard").boundingBox();
      assert.ok(box.width > 850, "desktop account uses shared full width");
      const cols = await page
        .locator(".dashboard-grid")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
      assert.equal(cols, 2);
    }
    assert.equal(await page.locator("main h1").count(), 1, "single h1");
    await page.screenshot({
      path: `test-results/phase9b1-${label}-${width}.png`,
      fullPage: true,
    });
    pass(label + " " + width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function mobileNavigation() {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  const nav = page.getByRole("navigation", {
    name: "Мобільна навігація",
    exact: true,
  });
  const link = nav.getByRole("link", { name: "В’язка", exact: true });
  assert.equal(await link.getAttribute("href"), "/mating");
  await link.focus();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Мобільна навігація", exact: true })
    .getByRole("link", { name: "В’язка", exact: true })
    .click();
  pass("mobile mating entry + keyboard Escape focus return");
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  await go("/listings");
  await mobileNavigation();
  await page.waitForURL("**/mating");
  pass("anonymous product entry reaches public catalog, no dead link");
  await login(f.seller);
  await page
    .getByRole("heading", { name: "Олександр Єпік", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Розплідник", exact: true })
      .count(),
    0,
  );
  for (const name of [
    "Особисті дані",
    "Публічний профіль",
    "Мої тварини",
    "Оголошення",
    "В’язка",
    "Обране",
    "Акаунт і безпека",
  ])
    assert.ok(
      await page.getByRole("heading", { name, exact: true }).isVisible(),
    );
  await widths("account-seller");
  await page
    .getByRole("button", { name: "Редагувати особисті дані", exact: true })
    .click();
  await page.getByLabel("Ім’я", { exact: true }).waitFor();
  await widths("account-personal-edit");
  await page.getByRole("button", { name: "Скасувати", exact: true }).click();
  pass("existing personal editor preserved");
  const mating = page.locator(".dashboard-mating");
  await mating
    .getByRole("link", { name: "Створити оголошення", exact: true })
    .click();
  await page.waitForURL("**/mating/new");
  await page.getByRole("combobox", { name: "Тварина", exact: true }).waitFor();
  await page
    .getByText("Оберіть свою тварину, для якої шукаєте пару.", { exact: false })
    .waitFor();
  await page.getByRole("list", { name: "Кроки створення" }).waitFor();
  await widths("mating-new");
  pass("account direct create entry + mating step hierarchy");
  await go("/mating/my");
  await page.locator(".mating-card").first().waitFor();
  await page
    .getByRole("heading", { name: "Оголошення про в’язку", exact: true })
    .waitFor();
  await widths("mating-my");
  assert.ok(
    await page
      .getByRole("link", { name: "Створити оголошення", exact: true })
      .isVisible(),
  );
  pass(
    "management dashboard create CTA + readable status/Pet/location/fee cards",
  );
  await go(`/mating/${f.active.id}/edit`);
  await page.getByLabel("Опис", { exact: true }).waitFor();
  await widths("mating-edit");
  await mobileNavigation();
  await page.waitForURL("**/mating");
  pass("mobile mating navigation active owner area");
  await go("/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.full.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page
    .getByRole("heading", { name: "Розплідник", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Налаштувати профіль розплідника", exact: true })
    .waitFor();
  await widths("account-breeder");
  await page
    .locator(".dashboard-mating")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page.waitForURL("**/mating/my");
  await page
    .getByText("У вас ще немає оголошень про в’язку", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".mating-card").count(), 0);
  pass(
    "SELLER → BREEDER same-client session removes old private state + empty CTA",
  );
  await page
    .getByRole("link", { name: "Створити оголошення", exact: true })
    .last()
    .click();
  await page.waitForURL("**/mating/new");
  await page.getByRole("combobox", { name: "Тварина", exact: true }).waitFor();
  pass("empty management create link works");
  assert.deepEqual(errors, []);
  pass("no browser runtime errors");
  await writeFile(
    "test-results/phase9b1-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/phase9b1-failure.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/phase9b1-failure.txt",
    e.stack + "\n" + (await page.locator("body").innerText()),
  );
  throw e;
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
