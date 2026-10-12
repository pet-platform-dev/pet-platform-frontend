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
  errors = [],
  writes = [];
let f;
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    r.url().includes("/mating-listings") &&
    ["POST", "PATCH", "DELETE"].includes(r.method())
  )
    writes.push({
      url: r.url(),
      method: r.method(),
      body: r.postData() ? r.postDataJSON() : null,
    });
});
async function go(path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
async function login(actor, target = "/account") {
  await go(
    "/login" +
      (target === "/account"
        ? ""
        : "?" + new URLSearchParams({ returnTo: target })),
  );
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**" + target);
  await page.waitForLoadState("networkidle");
}
async function choose(pet, keyboard = false) {
  const combo = page.getByRole("combobox", { name: "Тварина", exact: true });
  await combo.click();
  const option = page
    .getByRole("option")
    .filter({ hasText: pet.name ?? "Самка" })
    .last();
  if (keyboard) {
    const values = await page
      .getByRole("option")
      .evaluateAll((items) => items.map((el) => el.dataset.value));
    const index = values.indexOf(pet.id);
    assert.ok(index >= 0);
    await combo.press("Home");
    for (let n = 0; n < index; n++) await combo.press("ArrowDown");
    await combo.press("Enter");
  } else await option.click();
  assert.equal(await combo.getAttribute("data-value"), pet.id);
}
async function location() {
  const combo = page.getByRole("combobox", {
    name: "Місце в’язки",
    exact: true,
  });
  await combo.fill(f.location.city);
  const option = page
    .getByRole("option")
    .filter({ hasText: f.location.city })
    .first();
  await option.waitFor();
  await combo.press("ArrowDown");
  await combo.press("Enter");
  await page.getByRole("button", { name: "Очистити місце в’язки" }).waitFor();
}
async function geometry(label, dialog = false) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " page overflow " + width,
    );
    for (const element of await page
      .locator(
        dialog
          ? "dialog[open] .button"
          : "main input:not([type=radio]),main textarea,main .button,main [role=combobox]",
      )
      .all()) {
      if (!(await element.isVisible())) continue;
      const box = await element.boundingBox();
      assert.ok(
        box.x >= -1 && box.x + box.width <= width + 1,
        label + " bounds " + width,
      );
      if (await element.evaluate((el) => el.matches(".button,[role=combobox]")))
        assert.ok(box.height >= 44, label + " touch height " + width);
    }
    await page.screenshot({
      path: `test-results/phase9b-${label}-${width}.png`,
      fullPage: true,
    });
    pass(label + " " + width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function save(name = "Зберегти зміни") {
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Зміни збережено." })
    .waitFor();
}
async function confirm(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog
    .getByRole("button", {
      name: label === "Видалити чернетку" ? label : "Підтвердити",
      exact: true,
    })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page.waitForLoadState("networkidle");
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  for (const target of [
    "/mating/new",
    "/mating/my",
    `/mating/${f.active.id}/edit`,
  ]) {
    await go(target);
    await page.waitForURL(
      (u) =>
        u.pathname === "/login" && u.searchParams.get("returnTo") === target,
    );
    pass("anonymous safe return " + target);
  }
  await login(f.seller, "/mating/my");
  await page
    .getByRole("heading", { name: "Оголошення про в’язку", exact: true })
    .waitFor();
  await page.locator(".mating-card").first().waitFor();
  let firstPageText = await page.locator("main").innerText();
  await geometry("management");
  await page.getByRole("button", { name: "Наступна", exact: true }).click();
  await page.getByText("Сторінка 2 із 2", { exact: true }).waitFor();
  const allPages =
    firstPageText + " " + (await page.locator("main").innerText());
  for (const text of ["Чернетка", "Активне", "Завершено", "Архів"])
    assert.ok(allPages.includes(text), text);
  pass("owner pagination page 2 + four statuses");
  await go("/mating/new");
  await page.getByRole("combobox", { name: "Тварина", exact: true }).waitFor();
  await choose(f.unknown);
  await page
    .getByText("Щоб створити оголошення про в’язку, вкажіть стать тварини.", {
      exact: true,
    })
    .waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Зберегти чернетку", exact: true })
      .isDisabled(),
  );
  pass("E unknown gender + Pet edit CTA");
  await choose(f.competing);
  await page
    .getByText("Для цієї тварини вже є активне оголошення про в’язку.", {
      exact: true,
    })
    .waitFor();
  assert.ok(
    await page
      .getByRole("link", { name: "Редагувати активне оголошення" })
      .isVisible(),
  );
  pass("F existing ACTIVE eligibility");
  await choose(f.known, true);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Характер спокійний. Умови обговорюємо з власником.");
  await location();
  await geometry("create");
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL(/\/mating\/[0-9a-f-]+\/edit$/);
  await page.getByText("Чернетка", { exact: true }).waitFor();
  const created = page.url().split("/").at(-2);
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: created } })).status,
    "DRAFT",
  );
  assert.equal(
    writes.find(
      (x) =>
        x.method === "POST" &&
        new URL(x.url).pathname.endsWith("/mating-listings"),
    ).body.fee,
    null,
  );
  assert.equal(
    await page.getByRole("combobox", { name: "Тварина", exact: true }).count(),
    0,
  );
  pass("A draft first + agreement + immutable Pet");
  await page.getByLabel("Фіксована оплата", { exact: true }).check();
  await page.getByLabel("Сума, грн", { exact: true }).fill("1e3");
  const writesBeforeInvalid = writes.length;
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.getByText(/Вкажіть суму від 0/).waitFor();
  assert.equal(writes.length, writesBeforeInvalid);
  pass("invalid fixed fee remains field-level and never reaches API");
  await page.getByLabel("Сума, грн", { exact: true }).fill("1234,56");
  await save();
  await page.reload();
  await page.getByLabel("Сума, грн", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Сума, грн", { exact: true }).inputValue(),
    "1234.56",
  );
  pass("C fixed decimal preserved after reload");
  await page.getByLabel("Безкоштовно", { exact: true }).check();
  await save();
  assert.equal(
    (
      await f.db.matingListing.findUnique({ where: { id: created } })
    ).price.toFixed(2),
    "0.00",
  );
  await go("/mating/my");
  assert.ok((await page.getByText("Безкоштовно", { exact: true }).count()) > 0);
  pass("D semantic zero renders free");
  await page
    .locator(`article.mating-card a[href="/mating/${created}/edit"]`)
    .click();
  await page.waitForURL(`**/mating/${created}/edit`);
  await page.getByLabel("Фіксована оплата", { exact: true }).check();
  await page.getByLabel("Сума, грн", { exact: true }).fill("999");
  await page.route(`**/mating-listings/${created}/publish`, (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Тварина вже має активне оголошення про в’язку",
      }),
    }),
  );
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Чернетку збережено. Для цієї тварини вже є активне" })
    .waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: created } })).status,
    "DRAFT",
  );
  await page.unroute(`**/mating-listings/${created}/publish`);
  await page
    .getByRole("link", { name: "До моїх оголошень про в’язку", exact: true })
    .click();
  await page.waitForURL("**/mating/my");
  await page
    .locator(`article.mating-card:has(a[href="/mating/${created}/edit"])`)
    .getByText("999 ₴", { exact: true })
    .waitFor();
  pass(
    "backend ACTIVE conflict preserves saved draft and refreshes cached card fee",
  );
  await go(`/mating/${created}/edit`);
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page.getByText("Активне", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: created } })).status,
    "ACTIVE",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Видалити чернетку", exact: true })
      .count(),
    0,
  );
  pass("B explicit publish + no active delete");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Оновлений опис. ".repeat(300));
  await save();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: created } })).petId,
    f.known.id,
  );
  await geometry("active-edit");
  pass("G active edits preserve Pet");
  const trigger = page.getByRole("button", {
    name: "Завершити пошук",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await geometry("close-dialog", true);
  await dialog.getByRole("button", { name: "Скасувати", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => !!document.activeElement.closest("dialog")),
    true,
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  pass("keyboard confirmation trap + Escape focus return");
  await confirm("Завершити пошук");
  await page.getByText("Завершено", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: created } })).status,
    "CLOSED",
  );
  assert.equal(await page.getByLabel("Опис", { exact: true }).count(), 0);
  assert.equal(
    await page
      .locator("#mating-status")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  pass("H close/read-only + stable success focus");
  await confirm("Перемістити в архів");
  await page.getByText("Архів", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: created } })).status,
    "ARCHIVED",
  );
  assert.equal(
    await page
      .locator("#mating-status")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  pass("I archive + stable success focus");
  await go("/mating/new");
  await choose(f.unnamed);
  assert.equal(await page.getByText("Без імені", { exact: true }).count(), 0);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Чернетка для видалення.");
  await location();
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL(/\/mating\/[0-9a-f-]+\/edit$/);
  const deleted = page.url().split("/").at(-2);
  await confirm("Видалити чернетку");
  await page.waitForURL("**/mating/my");
  assert.equal(
    await f.db.matingListing.findUnique({ where: { id: deleted } }),
    null,
  );
  pass("J draft delete + redirect + unnamed Pet");
  await page.route("**/mating-listings/me?*", (route) => route.abort());
  await go("/mating/my");
  await page
    .getByText("Не вдалося завантажити ваші оголошення.", { exact: true })
    .waitFor();
  await page.unroute("**/mating-listings/me?*");
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await page.locator(".mating-card").first().waitFor();
  pass("network failure retry");
  await page.getByRole("link", { name: "Мій профіль", exact: true }).click();
  await page.waitForURL("**/account");
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
    .locator(".dashboard-mating")
    .getByRole("link", { name: "Мої оголошення", exact: true })
    .click();
  await page.waitForURL("**/mating/my");
  await page
    .getByText("У вас ще немає оголошень про в’язку", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".mating-card").count(), 0);
  await go(`/mating/${created}/edit`);
  await page.getByText("Оголошення недоступне.", { exact: true }).waitFor();
  pass("K session switch removes A state + foreign owner rejected");
  await go("/mating/new");
  await choose(f.breeder);
  await page.getByLabel("Опис", { exact: true }).fill("Оголошення заводчика.");
  await location();
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL(/\/mating\/[0-9a-f-]+\/edit$/);
  await page.getByText("Чернетка", { exact: true }).waitFor();
  pass("BREEDER shares same create flow");
  assert.deepEqual(errors, []);
  pass("no browser runtime errors");
  await writeFile(
    "test-results/phase9b-browser.json",
    JSON.stringify(
      {
        checks,
        writes: writes.map(({ method, body, url }) => ({
          method,
          body,
          path: new URL(url).pathname,
        })),
        errors,
      },
      null,
      2,
    ),
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/phase9b-failure.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/phase9b-failure.txt",
    e.stack + "\n" + (await page.locator("body").innerText()),
  );
  throw e;
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
