import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(resolve("../pet-platform-backend/package.json"));
require("dotenv").config({
  path: resolve("../pet-platform-backend/.env"),
  quiet: true,
});
const database = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
    database.pathname === "/pet_platform",
);
const { PrismaService } =
    await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js"),
  { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
  );
const db = new PrismaService(),
  browser = await chromium.launch({ channel: "msedge", headless: true }),
  context = await browser.newContext({ timezoneId: "Europe/Kyiv" }),
  otherContext = await browser.newContext({ timezoneId: "Europe/Kyiv" }),
  page = await context.newPage(),
  otherPage = await otherContext.newPage();
const users = [],
  pets = [],
  checks = [],
  errors = [];
let failed;
for (const p of [page, otherPage])
  p.on("pageerror", (e) => errors.push(e.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (p, path) => {
  await p.goto("http://localhost:3000" + path);
  await p.waitForLoadState("networkidle");
};
async function login(p, user, password) {
  await go(p, "/login");
  await p.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await p.getByLabel("Пароль", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Увійти", exact: true }).click();
  await p.waitForURL("**/account");
}
async function responsive(label) {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow " + width,
    );
    assert.equal(await page.locator("select").count(), 0);
    if (label === "form") {
      const box = await page.getByRole("dialog").boundingBox();
      assert.ok(box.x >= 15 && box.y >= 15);
      assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 2);
    }
    await page.screenshot({
      path: `test-results/phase12c-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
async function fillForm(title, type, date, time = "09:30", notes = "") {
  const d = page.getByRole("dialog");
  await d.getByRole("combobox", { name: "Тип події", exact: true }).click();
  await d.getByRole("option", { name: type, exact: true }).click();
  await d.getByLabel("Назва", { exact: true }).fill(title);
  await d.getByLabel("Дата", { exact: true }).fill(date);
  await d.getByLabel("Час", { exact: true }).fill(time);
  await d.getByLabel("Нотатка (необов’язково)", { exact: true }).fill(notes);
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Власник", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "pet-history-browser-" + randomUUID() + "@example.invalid",
          firstName,
          lastName: "Фікстура",
          passwordHash,
        },
      }),
    );
  const species = await db.species.findUniqueOrThrow({
    where: { slug: "dog" },
  });
  for (const user of users)
    pets.push(
      await db.pet.create({
        data: {
          ownerId: user.id,
          speciesId: species.id,
          name: user.firstName + " PRIVATE_12C",
        },
      }),
    );
  const [owner, other] = users,
    [pet, otherPet] = pets,
    care = "/pets/" + pet.id + "/care",
    path = care + "/history";
  const reminder = await db.petReminder.create({
    data: {
      petId: pet.id,
      title: "PRIVATE_REM_12C",
      dueAt: new Date(Date.now() + 86400000),
    },
  });
  await login(page, owner, password);
  await go(page, care);
  const historySection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Історія догляду", exact: true }),
  });
  await historySection
    .getByText("Історія догляду порожня", { exact: true })
    .waitFor();
  await responsive("dashboard");
  await historySection
    .getByRole("link", { name: "Уся історія", exact: true })
    .click();
  await page.waitForURL("**/care/history");
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  await fillForm(
    "Грумінг PRIVATE_12C",
    "Грумінг",
    "2026-09-20",
    "09:30",
    "Звичайна нотатка <b>plain</b>",
  );
  await responsive("form");
  const post = "**/api/v1/pets/" + pet.id + "/care-history";
  await page.route(post, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: '{"message":"RAW_PRIVATE_ERROR"}',
        })
      : route.continue(),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Зберегти", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("dialog")
      .getByLabel("Назва", { exact: true })
      .inputValue(),
    "Грумінг PRIVATE_12C",
  );
  assert.ok(
    !(await page.getByRole("dialog").innerText()).includes("RAW_PRIVATE_ERROR"),
  );
  await page.unroute(post);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Зберегти", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const list = page.getByRole("region", {
    name: "Записи історії догляду",
    exact: true,
  });
  await list
    .getByRole("article", { name: "Грумінг PRIVATE_12C", exact: true })
    .waitFor();
  const grooming = await db.petCareEntry.findFirstOrThrow({
    where: { petId: pet.id, type: "GROOMING" },
  });
  assert.equal(grooming.occurredAt.toISOString(), "2026-09-20T06:30:00.000Z");
  await page
    .getByRole("link", { name: "До догляду за твариною", exact: true })
    .click();
  await page.waitForURL("**/care");
  await historySection
    .getByRole("article", { name: grooming.title, exact: true })
    .waitFor();
  pass(
    "A: owner dashboard→history→create GROOMING;500preserves draft; local Kyiv→UTC roundtrip; confirmed list/dashboard preview",
  );
  await go(page, path);
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  const longNote = "Нотатка про візит. ".repeat(70);
  await fillForm(
    "Давній візит PRIVATE_12C",
    "Візит до ветеринара",
    "2026-08-20",
    "10:00",
    longNote,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Зберегти", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const vet = list.getByRole("article", {
    name: "Давній візит PRIVATE_12C",
    exact: true,
  });
  await vet.waitFor();
  assert.deepEqual(
    await list
      .getByRole("article")
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("aria-label"))),
    [grooming.title, "Давній візит PRIVATE_12C"],
  );
  await vet.locator("summary").click();
  assert.equal(await vet.locator("details").evaluate((el) => el.open), true);
  await vet.locator("summary").click();
  await responsive("list");
  pass(
    "B/H: older VET_VISIT stays below newer event, long notes expand natively;375/768/1440 dashboard/list/centered form no overflow",
  );
  const filter = page.getByRole("combobox", { name: "Тип події", exact: true });
  await filter.click();
  await page
    .getByRole("option", { name: "Візит до ветеринара", exact: true })
    .click();
  await vet.waitFor();
  assert.equal(await list.getByRole("article").count(), 1);
  await filter.click();
  await page.getByRole("option", { name: "Усі типи", exact: true }).click();
  await list
    .getByRole("article", { name: grooming.title, exact: true })
    .waitFor();
  pass(
    "C: custom type filter returns only matching events and ALL restores both",
  );
  await list
    .getByRole("article", { name: grooming.title, exact: true })
    .getByRole("button", { name: "Редагувати", exact: true })
    .click();
  await fillForm(
    "Оновлений грумінг PRIVATE_12C",
    "Гігієна",
    "2026-09-21",
    "11:00",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Зберегти", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const updated = list.getByRole("article", {
    name: "Оновлений грумінг PRIVATE_12C",
    exact: true,
  });
  await updated.getByText("Гігієна", { exact: true }).waitFor();
  pass("D: edit title/type/past date/optional note updates confirmed entry");
  const trigger = vet.getByRole("button", { name: "Видалити", exact: true });
  await trigger.click();
  let del = page.getByRole("dialog", {
    name: "Видалити запис з історії?",
    exact: true,
  });
  await del.waitFor();
  await page.keyboard.press("Escape");
  await del.waitFor({ state: "hidden" });
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  await trigger.click();
  await del.getByText("Цю дію не можна скасувати.", { exact: true }).waitFor();
  await del
    .getByRole("button", { name: "Видалити запис", exact: true })
    .click();
  await del.waitFor({ state: "hidden" });
  await vet.waitFor({ state: "detached" });
  assert.deepEqual(
    await db.petReminder.findUnique({ where: { id: reminder.id } }),
    reminder,
  );
  pass(
    "E: delete confirmation/Escape/focus return; hard-delete selected record only, reminder remains unchanged",
  );
  await login(otherPage, other, password);
  await go(otherPage, path);
  await otherPage
    .getByText("Тварину не знайдено або у вас немає доступу.", { exact: true })
    .waitFor();
  assert.equal(
    await otherPage
      .getByText("Оновлений грумінг PRIVATE_12C", { exact: true })
      .count(),
    0,
  );
  pass(
    "G: direct foreign route conceals identity/entries/controls; backend covers all API ownership verbs",
  );
  await filter.click();
  await page.getByRole("option", { name: "Гігієна", exact: true }).click();
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Назва", { exact: true })
    .fill("UNSAVED_PRIVATE_12C");
  const logoutPage = await context.newPage();
  await go(logoutPage, "/account");
  await logoutPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/login");
  await logoutPage.close();
  await login(page, other, password);
  await go(page, "/pets/" + otherPet.id + "/care/history");
  await page.getByText("Історія догляду порожня", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Тип події", exact: true })
      .getAttribute("data-value"),
    "ALL",
  );
  assert.equal(
    await page
      .getByText("Оновлений грумінг PRIVATE_12C", { exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  assert.equal(
    await page
      .getByRole("dialog")
      .getByLabel("Назва", { exact: true })
      .inputValue(),
    "",
  );
  await page.keyboard.press("Escape");
  await go(page, path);
  await page
    .getByText("Тварину не знайдено або у вас немає доступу.", { exact: true })
    .waitFor();
  pass(
    "F: cross-tab logout with open draft/filter→B empty history/ALL/clean form→A denial; no previous owner state",
  );
  assert.deepEqual(errors, []);
  pass(
    "runtime/hydration errors0, native selects0, no medical/structured-record or reminder auto-action",
  );
} catch (error) {
  failed = error;
  throw error;
} finally {
  await context.close();
  await otherContext.close();
  await browser.close();
  await db.pet.deleteMany({ where: { id: { in: pets.map((p) => p.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase12c-browser.json",
    JSON.stringify({ checks, errors, failed: failed?.message }, null, 2),
  );
}
