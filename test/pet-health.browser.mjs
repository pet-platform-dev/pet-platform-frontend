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
const dialog = () => page.locator("dialog.reminder-dialog");
const months = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];
async function selectOption(scope, label, value) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await scope.getByRole("option", { name: value, exact: true }).click();
}
async function date(label, value) {
  await dialog().getByRole("button", { name: label, exact: true }).click();
  const c = page.getByRole("dialog", {
    name: "Календар: " + label,
    exact: true,
  });
  const [y, m] = value.split("-");
  await selectOption(c, "Рік", y);
  await selectOption(c, "Місяць", months[Number(m) - 1]);
  await c.locator('button[data-day="' + value + '"]').click();
}
async function time(label, value) {
  const [h, m] = value.split(":");
  await selectOption(dialog(), label + ": години", h);
  await selectOption(dialog(), label + ": хвилини", m);
  assert.equal(
    await dialog()
      .getByLabel(label + " у форматі HH:mm", { exact: true })
      .innerText(),
    value,
  );
}
async function responsive(label, calendar = false) {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow " + width,
    );
    assert.equal(
      await page.locator("select,input[type=date],input[type=time]").count(),
      0,
    );
    if (await dialog().count()) {
      const box = await dialog().boundingBox();
      assert.ok(
        box.x >= 15 && box.x + box.width <= width - 15,
        label + " dialog bounds",
      );
    }
    if (calendar) {
      const box = await page.locator(".care-calendar").boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, "calendar bounds");
    }
    await page.screenshot({
      path: `test-results/phase12d-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
async function save() {
  await dialog().getByRole("button", { name: "Зберегти", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Власник", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "pet-health-browser-" + randomUUID() + "@example.invalid",
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
          name: user.firstName + " PRIVATE_12D",
        },
      }),
    );
  const [owner, other] = users,
    [pet, otherPet] = pets,
    care = "/pets/" + pet.id + "/care";
  await login(page, owner, password);
  await go(page, care);
  await page
    .getByRole("heading", { name: "Вакцинації", exact: true })
    .waitFor();
  await responsive("dashboard");
  await go(page, care + "/vaccinations");
  await page
    .getByRole("button", { name: "Додати вакцинацію", exact: true })
    .click();
  await dialog()
    .getByLabel("Назва вакцини", { exact: true })
    .fill("Вакцина PRIVATE_12D");
  await date("Дата", "2026-09-20");
  await time("Час", "16:00");
  await dialog().getByLabel("Додати наступну дату", { exact: true }).check();
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Наступна дата", exact: true })
      .innerText(),
    "Оберіть дату",
  );
  assert.equal(
    await dialog()
      .getByLabel("Наступний час у форматі HH:mm", { exact: true })
      .innerText(),
    "Оберіть час",
  );
  await date("Наступна дата", "2026-11-20");
  await time("Наступний час", "08:00");
  await responsive("vaccination-form");
  await dialog().getByRole("button", { name: "Дата", exact: true }).click();
  const calendar = page.getByRole("dialog", {
    name: "Календар: Дата",
    exact: true,
  });
  assert.deepEqual(await calendar.getByRole("columnheader").allTextContents(), [
    "Пн",
    "Вт",
    "Ср",
    "Чт",
    "Пт",
    "Сб",
    "Нд",
  ]);
  await calendar.locator('[data-day="2026-09-20"]').focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.locator(":focus").getAttribute("data-day"),
    "2026-09-19",
  );
  await page.keyboard.press("Home");
  assert.equal(
    await page.locator(":focus").getAttribute("data-day"),
    "2026-09-14",
  );
  await page.keyboard.press("End");
  assert.equal(
    await page.locator(":focus").getAttribute("data-day"),
    "2026-09-20",
  );
  await page.keyboard.press("PageUp");
  assert.equal(
    await page.locator(":focus").getAttribute("data-day"),
    "2026-08-20",
  );
  await page.keyboard.press("PageDown");
  await responsive("calendar", true);
  await page.keyboard.press("Escape");
  assert.equal(await calendar.count(), 0);
  assert.ok(await dialog().isVisible());
  assert.equal(
    await dialog()
      .getByRole("button", { name: "Дата", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  const post = "**/api/v1/pets/" + pet.id + "/vaccinations";
  await page.route(post, (r) =>
    r.request().method() === "POST"
      ? r.fulfill({
          status: 500,
          contentType: "application/json",
          body: '{"message":"RAW_PRIVATE_ERROR"}',
        })
      : r.continue(),
  );
  await dialog().getByRole("button", { name: "Зберегти", exact: true }).click();
  await dialog().getByRole("alert").waitFor();
  assert.equal(
    await dialog().getByLabel("Назва вакцини", { exact: true }).inputValue(),
    "Вакцина PRIVATE_12D",
  );
  assert.ok(!(await dialog().innerText()).includes("RAW_PRIVATE_ERROR"));
  await page.unroute(post);
  await save();
  const vaccine = await db.petVaccinationRecord.findFirstOrThrow({
    where: { petId: pet.id },
  });
  assert.equal(
    vaccine.administeredAt.toISOString(),
    "2026-09-20T13:00:00.000Z",
  );
  assert.equal(vaccine.nextDueAt.toISOString(), "2026-11-20T06:00:00.000Z");
  assert.ok(
    (
      await page
        .getByRole("article", { name: vaccine.name, exact: true })
        .innerText()
    ).includes("16:00"),
  );
  pass(
    "A: vaccination local16:00→UTC13:00; optional date/time explicit; failed save preserves draft; confirmed save",
  );
  pass(
    "B: custom Ukrainian Monday-first calendar/month/year; keyboard arrows/Home/End/PageUp/Down/Escape focus;375/768/1440 no overflow",
  );
  await go(page, care + "/medications");
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  await dialog().getByLabel("Назва", { exact: true }).fill("Ліки PRIVATE_12D");
  await date("Дата початку", "2026-09-20");
  await time("Час початку", "08:00");
  await dialog().getByLabel("Додати дату завершення", { exact: true }).check();
  await date("Дата завершення", "2026-09-20");
  await time("Час завершення", "18:00");
  await responsive("medication-form");
  await save();
  const medication = await db.petMedicationRecord.findFirstOrThrow({
    where: { petId: pet.id },
  });
  assert.equal(medication.startedAt.toISOString(), "2026-09-20T05:00:00.000Z");
  assert.equal(medication.endedAt.toISOString(), "2026-09-20T15:00:00.000Z");
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  await dialog()
    .getByLabel("Назва", { exact: true })
    .fill("Триває PRIVATE_12D");
  await date("Дата початку", "2026-09-19");
  await time("Час початку", "00:00");
  await save();
  await page
    .getByRole("article", { name: "Триває PRIVATE_12D", exact: true })
    .getByText("Триває", { exact: true })
    .waitFor();
  await responsive("medication-list");
  pass(
    "C: medication08:00/18:00→UTC05:00/15:00;00:00 open-ended Триває; both optional semantics",
  );
  for (const [kind, record] of [
    ["vaccinations", vaccine],
    ["medications", medication],
  ]) {
    await go(page, care + "/" + kind);
    const card = page.getByRole("article", { name: record.name, exact: true });
    await card.getByRole("button", { name: "Редагувати", exact: true }).click();
    await dialog()
      .getByLabel("Нотатка (необов’язково)", { exact: true })
      .fill("Оновлено PRIVATE_12D");
    await save();
    await card.getByText("Оновлено PRIVATE_12D", { exact: true }).waitFor();
    await card.getByRole("button", { name: "Видалити", exact: true }).click();
    await dialog()
      .getByRole("button", { name: "Видалити запис", exact: true })
      .click();
    await dialog().waitFor({ state: "hidden" });
    await card.waitFor({ state: "hidden" });
  }
  pass("D: confirmed edit/delete both kinds");
  await go(page, care);
  await page
    .getByRole("article", { name: "Триває PRIVATE_12D", exact: true })
    .waitFor();
  for (const path of ["reminders", "history"]) {
    await go(page, care + "/" + path);
    await page
      .getByRole("button", {
        name: path === "reminders" ? "Додати нагадування" : "Додати запис",
        exact: true,
      })
      .click();
    await date("Дата", path === "reminders" ? "2026-11-20" : "2026-09-20");
    await time("Час", "23:45");
    await dialog()
      .getByRole("combobox", { name: "Час: години", exact: true })
      .click();
    assert.equal(
      await dialog().getByRole("option", { name: "23", exact: true }).count(),
      1,
    );
    assert.equal(
      await dialog().getByRole("option", { name: "24", exact: true }).count(),
      0,
    );
    await page.keyboard.press("Escape");
    await responsive(path + "-shared-picker");
    await dialog()
      .getByRole("button", { name: "Скасувати", exact: true })
      .click();
  }
  assert.equal(await db.petReminder.count({ where: { petId: pet.id } }), 0);
  assert.equal(await db.petCareEntry.count({ where: { petId: pet.id } }), 0);
  pass(
    "E: shared custom picker in Reminders/History;23:45,24-hour options; no domain side effects",
  );
  await login(otherPage, other, password);
  for (const kind of ["vaccinations", "medications"]) {
    await go(otherPage, care + "/" + kind);
    await otherPage
      .getByText("Тварину не знайдено або у вас немає доступу.", {
        exact: true,
      })
      .waitFor();
    assert.equal(await otherPage.getByRole("article").count(), 0);
  }
  pass("F: other account concealed404 both record pages");
  await go(page, care + "/medications");
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  await dialog()
    .getByLabel("Назва", { exact: true })
    .fill("UNSAVED_PRIVATE_12D");
  const logoutPage = await context.newPage();
  await go(logoutPage, "/account");
  await logoutPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL((u) => u.pathname === "/login");
  await logoutPage.close();
  await login(page, other, password);
  await go(page, "/pets/" + otherPet.id + "/care/medications");
  await page.getByText("Записів про ліки ще немає", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Триває PRIVATE_12D", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  assert.equal(
    await dialog().getByLabel("Назва", { exact: true }).inputValue(),
    "",
  );
  await dialog()
    .getByRole("button", { name: "Скасувати", exact: true })
    .click();
  pass(
    "G: cross-tab logout removes private records/draft; next account clean empty list/form",
  );
  assert.deepEqual(errors, []);
  pass(
    "runtime/hydration errors0; no native select/date/time; no automatic history/reminder",
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
    "test-results/phase12d-browser.json",
    JSON.stringify({ checks, errors, failed: failed?.message }, null, 2),
  );
}
