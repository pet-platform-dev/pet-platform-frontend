import assert from "node:assert/strict";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext(),
  page = await context.newPage();
let f;
async function go(path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
try {
  f = await matingFixtures();
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await go(`/mating/${f.active.id}/edit`);
  await page.getByLabel("Опис", { exact: true }).fill("НЕЗБЕРЕЖЕНИЙ ОПИС");
  await page.route(/\/mating-listings\/[0-9a-f-]+$/, (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.continue(),
  );
  await page.route("**/mating-listings/me?status=ACTIVE*", (route) =>
    route.abort(),
  );
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page
    .getByText("Не вдалося перевірити активні оголошення.", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Опис", { exact: true }).count(),
    1,
    "Failed save must not unmount form",
  );
  assert.equal(
    await page.getByLabel("Опис", { exact: true }).inputValue(),
    "НЕЗБЕРЕЖЕНИЙ ОПИС",
  );
  await page.unrouteAll();
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.getByText("Зміни збережено.", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: f.active.id } }))
      .description,
    "НЕЗБЕРЕЖЕНИЙ ОПИС",
  );
  console.log(
    "PASS edit failed save + eligibility failure retains inputs and retries",
  );
  await go("/mating/new");
  const combo = page.getByRole("combobox", { name: "Тварина", exact: true });
  await combo.click();
  await page.getByRole("option").filter({ hasText: "Рекс" }).click();
  await page
    .getByLabel("Опис", { exact: true })
    .fill("НОВА НЕЗБЕРЕЖЕНА ЧЕРНЕТКА");
  const loc = page.getByRole("combobox", { name: "Місце в’язки", exact: true });
  await loc.fill(f.location.city);
  await page
    .getByRole("option")
    .filter({ hasText: f.location.city })
    .first()
    .click();
  await page.getByLabel("Фіксована оплата", { exact: true }).check();
  await page.getByLabel("Сума, грн", { exact: true }).fill("12,34");
  await page.route("**/mating-listings", (route) => route.abort());
  await page.route("**/mating-listings/me?status=ACTIVE*", (route) =>
    route.abort(),
  );
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page
    .getByText("Не вдалося перевірити активні оголошення.", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Опис", { exact: true }).inputValue(),
    "НОВА НЕЗБЕРЕЖЕНА ЧЕРНЕТКА",
  );
  assert.equal(
    await page.getByLabel("Сума, грн", { exact: true }).inputValue(),
    "12,34",
  );
  assert.equal(await combo.getAttribute("data-value"), f.known.id);
  await page.getByRole("button", { name: "Очистити місце в’язки" }).waitFor();
  await page.unrouteAll();
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await page.waitForURL(/\/mating\/[0-9a-f-]+\/edit$/);
  await page.getByText("Чернетка", { exact: true }).waitFor();
  console.log(
    "PASS create failed save + eligibility failure retains Pet/location/description/fee and retries",
  );
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
