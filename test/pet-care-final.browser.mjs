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

process.env.PET_REMINDER_DELIVERY_ENABLED = "false";
const { Test } = require("@nestjs/testing");
const { AppModule } =
  await import("../../pet-platform-backend/dist/src/app.module.js");
const { configureApp } =
  await import("../../pet-platform-backend/dist/src/configure-app.js");
const { PrismaService } =
  await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const { PetReminderDeliveryService } =
  await import("../../pet-platform-backend/dist/src/pets/reminders/delivery/pet-reminder-delivery.service.js");
const { MessagingGateway } =
  await import("../../pet-platform-backend/dist/src/conversations/messaging.gateway.js");
const app = (
  await Test.createTestingModule({ imports: [AppModule] }).compile()
).createNestApplication({ logger: false });
configureApp(app);
await app.listen(4000);
const db = app.get(PrismaService),
  delivery = app.get(PetReminderDeliveryService),
  gateway = app.get(MessagingGateway);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true }),
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
async function until(check) {
  const end = Date.now() + 7000;
  while (!(await check())) {
    if (Date.now() > end) throw Error("Final Pet Care check timed out");
    await new Promise((r) => setTimeout(r, 25));
  }
}
const dialog = () => page.locator("dialog.reminder-dialog");
async function option(root, label, value) {
  await root.getByRole("combobox", { name: label, exact: true }).click();
  await root.getByRole("option", { name: value, exact: true }).click();
}
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
async function selectDate(label, value) {
  await dialog().getByRole("button", { name: label, exact: true }).click();
  const c = page.getByRole("dialog", {
    name: "Календар: " + label,
    exact: true,
  });
  const [y, m] = value.split("-");
  await option(c, "Рік", y);
  await option(c, "Місяць", months[Number(m) - 1]);
  await c.locator('[data-day="' + value + '"]').click();
}
async function selectTime(label, value) {
  const [h, m] = value.split(":");
  await option(dialog(), label + ": години", h);
  await option(dialog(), label + ": хвилини", m);
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
      const b = await dialog().boundingBox();
      assert.ok(
        b.x >= 15 && b.x + b.width <= width - 15,
        label + " dialog bounds",
      );
    }
    if (calendar) {
      const c = page.locator(".care-calendar"),
        b = await c.boundingBox();
      assert.ok(b.x >= 0 && b.x + b.width <= width, "calendar bounds");
      for (const name of ["Попередній місяць", "Наступний місяць"]) {
        const b = await c
          .getByRole("button", { name, exact: true })
          .boundingBox();
        assert.ok(
          b.width >= 44 && b.height >= 44,
          "calendar navigation touch target",
        );
      }
      const day = await c.locator("[data-day]").first().boundingBox();
      assert.ok(day.height >= 44);
    }
    await page.screenshot({
      path: `test-results/phase12f-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
async function failureThenSave(api, nameLabel, name) {
  await page.route(api, (r) =>
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
    await dialog().getByLabel(nameLabel, { exact: true }).inputValue(),
    name,
  );
  assert.ok(!(await dialog().innerText()).includes("RAW_PRIVATE_ERROR"));
  await page.unroute(api);
  await dialog().getByRole("button", { name: "Зберегти", exact: true }).click();
  await dialog().waitFor({ state: "hidden" });
  await page.getByRole("article", { name, exact: true }).waitFor();
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Власник", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "pet-final-browser-" + randomUUID() + "@example.invalid",
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
          name: user.firstName + " PRIVATE_12F",
        },
      }),
    );
  const [a, b] = users,
    [pet, otherPet] = pets,
    care = "/pets/" + pet.id + "/care",
    names = {
      reminders: "Нагадування PRIVATE_12F",
      history: "Історія PRIVATE_12F",
      vaccinations: "Вакцинація PRIVATE_12F",
      medications: "Ліки PRIVATE_12F",
    };
  const run = () =>
    delivery.processDueReminders(
      new Date(),
      pets.map((p) => p.id),
    );
  await login(page, a, password);
  await login(otherPage, b, password);
  await until(() =>
    [...gateway.identities.values()].some((i) => i.userId === a.id),
  );
  if (process.env.PHASE12F_BROWSER_SESSION_ONLY === "true") {
    await db.petReminder.create({
      data: {
        petId: pet.id,
        title: names.reminders,
        dueAt: new Date(Date.now() - 1000),
      },
    });
    await db.petCareEntry.create({
      data: {
        petId: pet.id,
        title: names.history,
        type: "OTHER",
        occurredAt: new Date(),
      },
    });
    await db.petVaccinationRecord.create({
      data: {
        petId: pet.id,
        name: names.vaccinations,
        administeredAt: new Date(),
      },
    });
    await db.petMedicationRecord.create({
      data: { petId: pet.id, name: names.medications, startedAt: new Date() },
    });
    await run();
    for (const path of [
      "",
      "/reminders",
      "/history",
      "/vaccinations",
      "/medications",
    ]) {
      await go(page, care + path);
      assert.ok((await page.locator("body").innerText()).includes(pet.name));
    }
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Сповіщення", exact: true })
      .getByText(/Нагадування PRIVATE_12F —/)
      .waitFor();
    await page.keyboard.press("Escape");
  } else {
    await go(page, care);
    await page
      .getByRole("heading", { name: "Догляд за твариною", exact: true })
      .waitFor();
    await responsive("dashboard-empty");
    const tomorrow = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    });
    for (const kind of [
      "reminders",
      "history",
      "vaccinations",
      "medications",
    ]) {
      await go(page, care + "/" + kind);
      await page
        .getByRole("button", {
          name:
            kind === "reminders"
              ? "Додати нагадування"
              : kind === "vaccinations"
                ? "Додати вакцинацію"
                : "Додати запис",
          exact: true,
        })
        .click();
      const title = kind === "vaccinations" ? "Назва вакцини" : "Назва",
        dateLabel = kind === "medications" ? "Дата початку" : "Дата",
        timeLabel = kind === "medications" ? "Час початку" : "Час";
      await dialog().getByLabel(title, { exact: true }).fill(names[kind]);
      await dialog()
        .getByLabel("Нотатка (необов’язково)", { exact: true })
        .fill("PRIVATE_NOTE_12F <img src=x onerror=alert(1)>");
      await selectDate(
        dateLabel,
        kind === "reminders" ? tomorrow : "2026-09-20",
      );
      await selectTime(
        timeLabel,
        kind === "medications"
          ? "23:45"
          : kind === "vaccinations"
            ? "08:00"
            : "16:00",
      );
      if (kind === "reminders") {
        await option(dialog(), "Повторення", "Щодня");
        await dialog()
          .getByRole("button", { name: dateLabel, exact: true })
          .click();
        const cal = page.getByRole("dialog", {
          name: "Календар: " + dateLabel,
          exact: true,
        });
        assert.deepEqual(
          await cal.getByRole("columnheader").allTextContents(),
          ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
        );
        assert.equal(await cal.locator("[aria-current=date]").count(), 1);
        await responsive("calendar", true);
        const focused = cal.locator('[data-day][tabindex="0"]');
        await focused.focus();
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Home");
        await page.keyboard.press("End");
        await page.keyboard.press("PageUp");
        await page.keyboard.press("PageDown");
        await page.keyboard.press("Escape");
        assert.equal(await cal.count(), 0);
        assert.equal(
          await dialog()
            .getByRole("button", { name: dateLabel, exact: true })
            .evaluate((e) => e === document.activeElement),
          true,
        );
        await dialog()
          .getByRole("combobox", { name: timeLabel + ": години", exact: true })
          .click();
        await responsive("time-options");
        await page.keyboard.press("Escape");
        await selectTime(timeLabel, "00:00");
        await selectTime(timeLabel, "16:00");
      }
      if (kind === "vaccinations") {
        await dialog()
          .getByLabel("Додати наступну дату", { exact: true })
          .check();
        await selectDate("Наступна дата", tomorrow);
        await selectTime("Наступний час", "08:00");
      }
      if (kind === "medications") {
        await dialog()
          .getByRole("combobox", { name: "Час початку: хвилини", exact: true })
          .focus();
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        assert.equal(
          await dialog()
            .getByLabel("Час початку у форматі HH:mm", { exact: true })
            .innerText(),
          "23:59",
        );
        await selectTime(timeLabel, "23:45");
      }
      await responsive(kind + "-form");
      const apiKind = kind === "history" ? "care-history" : kind;
      await failureThenSave(
        "**/api/v1/pets/" + pet.id + "/" + apiKind,
        title,
        names[kind],
      );
      assert.equal(await page.locator('article img[src="x"]').count(), 0);
      await responsive(kind + "-list");
      const card = page.getByRole("article", {
        name: names[kind],
        exact: true,
      });
      await card.getByRole("button", { name: "Видалити", exact: true }).click();
      const expected =
        kind === "reminders"
          ? "Видалити нагадування?"
          : kind === "history"
            ? "Видалити запис з історії?"
            : kind === "vaccinations"
              ? "Видалити запис про вакцинацію?"
              : "Видалити запис про ліки?";
      await page.getByRole("dialog", { name: expected, exact: true }).waitFor();
      if (kind === "vaccinations" || kind === "medications")
        assert.ok((await dialog().innerText()).includes(names[kind]));
      await dialog()
        .getByRole("button", { name: "Скасувати", exact: true })
        .click();
      await card.waitFor();
    }
    pass(
      "A/F: owner creates all4types with shared custom controls, failures preserve drafts, precise delete confirmations/cancel; HH:mm00/08/16/23:45/23:59; calendar/time keyboard/focus/touch,375/768/1440 no overflow",
    );
    await go(page, care);
    for (const name of Object.values(names))
      await page.getByRole("article", { name, exact: true }).first().waitFor();
    await responsive("dashboard-populated");
    assert.equal(await page.locator(".pet-care-card article").count(), 5);
    const reminder = await db.petReminder.findFirstOrThrow({
      where: { petId: pet.id },
    });
    await db.petReminder.update({
      where: { id: reminder.id },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await run()).delivered, 1);
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .waitFor();
    const bell = page.getByRole("button", { name: /^Сповіщення/ });
    await bell.click();
    const panel = page.getByRole("region", { name: "Сповіщення", exact: true });
    await panel.getByText(/Нагадування PRIVATE_12F —/).waitFor();
    assert.ok(!(await panel.innerText()).includes("PRIVATE_NOTE"));
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const box = await panel.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      await page.screenshot({
        path: `test-results/phase12f-notification-${width}.png`,
        fullPage: true,
      });
    }
    await panel
      .getByRole("link", { name: "Нагадування про " + pet.name, exact: true })
      .click();
    await page.waitForURL("**/care/reminders");
    await until(async () =>
      Boolean(
        (
          await db.notification.findUnique({
            where: { reminderId: reminder.id },
          })
        ).readAt,
      ),
    );
    assert.equal((await run()).delivered, 0);
    assert.equal(
      await db.notification.count({ where: { reminderId: reminder.id } }),
      1,
    );
    assert.equal(
      (await db.petReminder.findUnique({ where: { id: reminder.id } })).status,
      "PENDING",
    );
    pass(
      "B: live owner bell+1, notes absent, safe read/navigation not completion, repeat tick no duplicate",
    );
    await page
      .getByRole("article", { name: names.reminders, exact: true })
      .getByRole("button", { name: "Виконано", exact: true })
      .click();
    await until(
      async () =>
        (await db.petReminder.findUnique({ where: { id: reminder.id } }))
          .status === "COMPLETED",
    );
    const next = await db.petReminder.findFirstOrThrow({
      where: { previousId: reminder.id },
    });
    assert.ok(next.dueAt > new Date());
    assert.equal(next.notificationDeliveredAt, null);
    assert.equal((await run()).delivered, 0);
    assert.equal(
      await db.petReminder.count({ where: { previousId: reminder.id } }),
      1,
    );
    assert.equal(await db.petCareEntry.count({ where: { petId: pet.id } }), 1);
    assert.equal(
      await db.petVaccinationRecord.count({ where: { petId: pet.id } }),
      1,
    );
    assert.equal(
      await db.petMedicationRecord.count({ where: { petId: pet.id } }),
      1,
    );
    pass(
      "C: completion retains history/notification, one future recurrence, no automatic care-record coupling",
    );
    for (const kind of [
      "",
      "/reminders",
      "/history",
      "/vaccinations",
      "/medications",
    ]) {
      await go(otherPage, care + kind);
      await otherPage
        .getByText("Тварину не знайдено або у вас немає доступу.", {
          exact: true,
        })
        .waitFor();
      assert.ok(
        !(await otherPage.locator("body").innerText()).includes("PRIVATE_12F"),
      );
    }
    const { SignJWT } = require("jose"),
      { AuthConfig } =
        await import("../../pet-platform-backend/dist/src/auth/auth.config.js");
    const session = await db.authSession.findFirstOrThrow({
      where: { userId: b.id, revokedAt: null },
    });
    const token = await new SignJWT({ sid: session.id })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(b.id)
      .setIssuer("pet-platform")
      .setAudience("pet-platform-browser")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(app.get(AuthConfig).secret);
    for (const path of [
      care,
      "/pets/" + pet.id + "/reminders",
      "/pets/" + pet.id + "/care-history",
      "/pets/" + pet.id + "/vaccinations",
      "/pets/" + pet.id + "/medications",
    ]) {
      const r = await fetch("http://localhost:4000/api/v1" + path, {
        headers: { Authorization: "Bearer " + token },
      });
      assert.equal(r.status, 404);
    }
    pass(
      "E: foreign direct dashboard/all4routes and private API concealed404, no owner/private identity",
    );
  }
  await go(page, care + "/medications");
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  await dialog()
    .getByLabel("Назва", { exact: true })
    .fill("UNSAVED_PRIVATE_12F");
  const logout = await context.newPage();
  await go(logout, "/account");
  await logout
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL((u) => u.pathname === "/login");
  await logout.close();
  await until(
    () => ![...gateway.identities.values()].some((i) => i.userId === a.id),
  );
  await login(page, b, password);
  for (const path of [
    "",
    "/reminders",
    "/history",
    "/vaccinations",
    "/medications",
  ]) {
    await go(page, "/pets/" + otherPet.id + "/care" + path);
    const text = await page.locator("body").innerText();
    for (const secret of [
      pet.name,
      ...Object.values(names),
      "UNSAVED_PRIVATE_12F",
    ])
      assert.ok(!text.includes(secret));
  }
  await page.getByRole("button", { name: "Додати запис", exact: true }).click();
  assert.equal(
    await dialog().getByLabel("Назва", { exact: true }).inputValue(),
    "",
  );
  await dialog()
    .getByRole("button", { name: "Скасувати", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Сповіщення", exact: true }).count(),
    1,
  );
  await db.petReminder.create({
    data: {
      petId: pet.id,
      title: "A_AFTER_SWITCH_PRIVATE_12F",
      dueAt: new Date(Date.now() - 1000),
    },
  });
  await run();
  assert.equal(
    await page.getByRole("button", { name: "Сповіщення", exact: true }).count(),
    1,
  );
  await page.getByRole("button", { name: "Сповіщення", exact: true }).click();
  await page
    .getByRole("region", { name: "Сповіщення", exact: true })
    .getByText("Сповіщень поки немає", { exact: true })
    .waitFor();
  pass(
    "D: cross-tab logout resets draft/all care caches, fresh B socket/bell, late A due notification stays private",
  );
  assert.deepEqual(errors, []);
  pass(
    "runtime/hydration errors0; no native controls/HTML injection; scoped fixture cleanup",
  );
} catch (e) {
  failed = e;
  throw e;
} finally {
  await context.close();
  await otherContext.close();
  await browser.close();
  await db.pet.deleteMany({ where: { id: { in: pets.map((p) => p.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await app.close();
  await writeFile(
    process.env.PHASE12F_BROWSER_SESSION_ONLY
      ? "test-results/phase12f-browser-session-retry.json"
      : "test-results/phase12f-browser.json",
    JSON.stringify({ checks, errors, failed: failed?.message }, null, 2),
  );
}
