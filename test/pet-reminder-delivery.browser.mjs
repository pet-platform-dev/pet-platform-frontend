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
const { NotificationsService } =
  await import("../../pet-platform-backend/dist/src/notifications/notifications.service.js");
const { MessagingGateway } =
  await import("../../pet-platform-backend/dist/src/conversations/messaging.gateway.js");
const app = (
  await Test.createTestingModule({ imports: [AppModule] }).compile()
).createNestApplication({ logger: false });
configureApp(app);
await app.listen(4000);
const db = app.get(PrismaService),
  delivery = app.get(PetReminderDeliveryService),
  notices = app.get(NotificationsService),
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
    if (Date.now() > end) throw Error("Timed out waiting for private socket");
    await new Promise((r) => setTimeout(r, 25));
  }
}
const bell = () => page.getByRole("button", { name: /^Сповіщення/ }),
  panel = () => page.getByRole("region", { name: "Сповіщення", exact: true });
async function open() {
  if ((await bell().getAttribute("aria-expanded")) !== "true")
    await bell().click();
  await panel()
    .getByRole("heading", { name: "Сповіщення", exact: true })
    .waitFor();
}
async function close() {
  if ((await bell().getAttribute("aria-expanded")) === "true")
    await page.keyboard.press("Escape");
}
async function responsive() {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await open();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "overflow " + width,
    );
    const b = await panel().boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= width, "panel bounds " + width);
    await page.screenshot({
      path: `test-results/phase12e-panel-${width}.png`,
      fullPage: true,
    });
  }
  await close();
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Власник", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "pet-delivery-browser-" + randomUUID() + "@example.invalid",
          firstName,
          lastName: "Фікстура",
          passwordHash,
        },
      }),
    );
  const species = await db.species.findUniqueOrThrow({
    where: { slug: "dog" },
  });
  pets.push(
    await db.pet.create({
      data: { ownerId: users[0].id, speciesId: species.id, name: "Локі" },
    }),
  );
  const [a, b] = users,
    [pet] = pets,
    path = "/pets/" + pet.id + "/care/reminders",
    run = () =>
      delivery.processDueReminders(
        new Date(),
        pets.map((p) => p.id),
      );
  if (process.env.PHASE12E_BROWSER_VISUAL_ONLY === "true") {
    await login(page, a, password);
    await until(() =>
      [...gateway.identities.values()].some((i) => i.userId === a.id),
    );
    await db.pet.update({
      where: { id: pet.id },
      data: { name: "Довге ім’я ".repeat(9) },
    });
    await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "Дуже довга назва нагадування ".repeat(4).slice(0, 120),
        dueAt: new Date(Date.now() - 1000),
      },
    });
    await run();
    await open();
    await panel()
      .getByText(/Дуже довга назва нагадування/)
      .waitFor();
    await responsive();
    await open();
    const heading = page.locator(".notification-item.is-pet-reminder strong a");
    const geometry = await heading.evaluate((e) => ({
      height: e.getBoundingClientRect().height,
      lineHeight: getComputedStyle(e).lineHeight,
      padding: getComputedStyle(e).padding,
      clamp: getComputedStyle(e).webkitLineClamp,
    }));
    assert.equal(geometry.height, 44);
    assert.equal(geometry.lineHeight, "22px");
    assert.equal(geometry.padding, "0px");
    assert.equal(geometry.clamp, "2");
    pass(
      "Focused F/H retry: two complete22px heading lines,44px target,zero clipping padding;375/768/1440 clean",
    );
  } else {
    await login(page, a, password);
    await login(otherPage, b, password);
    await until(
      () =>
        [...gateway.identities.values()].some((i) => i.userId === a.id) &&
        [...gateway.identities.values()].some((i) => i.userId === b.id),
    );
    const messagesBefore = await page
      .locator('a[href="/messages"]')
      .first()
      .innerText();
    const r = await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "Дати препарат PRIVATE_12E",
        notes: "PRIVATE_NOTE_NOT_IN_BELL",
        dueAt: new Date("2026-09-20T13:00Z"),
      },
    });
    assert.equal((await run()).delivered, 1);
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .waitFor();
    assert.equal(
      await otherPage
        .getByRole("button", { name: "Сповіщення", exact: true })
        .count(),
      1,
    );
    await open();
    const row = panel()
      .locator("li")
      .filter({ hasText: "Дати препарат PRIVATE_12E" });
    await row.waitFor();
    assert.ok((await row.innerText()).includes("16:00"));
    assert.ok(!(await panel().innerText()).includes("PRIVATE_NOTE"));
    await row
      .getByRole("link", { name: "Нагадування про Локі", exact: true })
      .click();
    await page.waitForURL("**/care/reminders");
    await page.getByRole("article", { name: r.title, exact: true }).waitFor();
    await until(async () =>
      Boolean(
        (await db.notification.findUnique({ where: { reminderId: r.id } }))
          .readAt,
      ),
    );
    assert.equal(
      (await db.petReminder.findUnique({ where: { id: r.id } })).status,
      "PENDING",
    );
    assert.equal(
      await page.locator('a[href="/messages"]').first().innerText(),
      messagesBefore,
    );
    pass(
      "A: live owner bell+1, foreign bell0, local16:00, notes absent, click safe reminders route/read without completion; Messages unchanged",
    );
    assert.equal((await run()).delivered, 0);
    assert.equal(
      await db.notification.count({ where: { reminderId: r.id } }),
      1,
    );
    pass("B: repeated delivery has no duplicate");
    const recurring = await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "Повтор PRIVATE_12E",
        dueAt: new Date(Date.now() - 1000),
        recurrenceType: "DAILY",
        seriesId: randomUUID(),
      },
    });
    await run();
    await go(page, path);
    await page
      .getByRole("article", { name: recurring.title, exact: true })
      .getByRole("button", { name: "Виконано", exact: true })
      .click();
    await until(
      async () =>
        (await db.petReminder.findUnique({ where: { id: recurring.id } }))
          .status === "COMPLETED",
    );
    const next = await db.petReminder.findFirstOrThrow({
      where: { previousId: recurring.id },
    });
    assert.ok(next.dueAt > new Date());
    assert.equal(next.notificationDeliveredAt, null);
    assert.equal((await run()).delivered, 0);
    assert.equal(
      await db.notification.count({ where: { reminderId: recurring.id } }),
      1,
    );
    pass(
      "C: recurring occurrence delivered once, owner completes in Reminder UI, distinct future successor remains undelivered",
    );
    await close();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const background = await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "Фон PRIVATE_12E",
        dueAt: new Date(Date.now() - 1000),
      },
    });
    await run();
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 2", exact: true })
      .waitFor();
    assert.equal(
      (
        await db.notification.findUnique({
          where: { reminderId: background.id },
        })
      ).readAt,
      null,
    );
    await page.evaluate(() => {
      delete document.visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    pass(
      "D: simulated background visibility receives unread notification; receipt alone never marks read",
    );
    await notices.create({
      userId: a.id,
      type: "MODERATION_APPROVED",
      title: "Оголошення схвалено",
      body: "Звичайне сповіщення",
      href: "/my-listings",
    });
    await notices.create({
      userId: a.id,
      type: "NEW_MESSAGE",
      title: "Нове повідомлення",
      body: "Звичайне повідомлення",
      href: "/messages",
    });
    await db.pet.update({
      where: { id: pet.id },
      data: { name: "Довге ім’я ".repeat(9) },
    });
    await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "Дуже довга назва нагадування ".repeat(4).slice(0, 120),
        dueAt: new Date(Date.now() - 1000),
      },
    });
    await run();
    await open();
    await panel()
      .getByRole("link", { name: "Оголошення схвалено", exact: true })
      .waitFor();
    await panel()
      .getByRole("link", { name: "Нове повідомлення", exact: true })
      .waitFor();
    assert.equal(
      await page.locator('a[href="/messages"]').first().innerText(),
      messagesBefore,
    );
    assert.equal(
      await panel()
        .getByRole("button", { name: "Виконано", exact: true })
        .count(),
      0,
    );
    await responsive();
    const longItem = page
      .locator(".notification-item.is-pet-reminder")
      .filter({ hasText: "Дуже довга назва" });
    await open();
    assert.equal(
      await longItem
        .locator("strong a")
        .evaluate((e) => getComputedStyle(e).webkitLineClamp),
      "2",
    );
    await close();
    pass(
      "F/H: existing moderation/message items render unchanged; long Pet title clamped;375/768/1440 clean panel without overflow",
    );
    await db.pet.update({ where: { id: pet.id }, data: { name: null } });
    await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "Без назви тварини PRIVATE_12E",
        dueAt: new Date(Date.now() - 1000),
      },
    });
    await run();
    await open();
    await panel()
      .getByRole("link", {
        name: "Нагадування про " + species.name,
        exact: true,
      })
      .waitFor();
    assert.ok(!(await panel().innerText()).includes("Без імені"));
    await close();
    await go(page, "/account");
    await page
      .getByRole("button", { name: "Вийти з акаунта", exact: true })
      .click();
    await page.waitForURL((u) => u.pathname === "/login");
    await until(
      () => ![...gateway.identities.values()].some((i) => i.userId === a.id),
    );
    await login(page, b, password);
    await until(
      () =>
        [...gateway.identities.values()].filter((i) => i.userId === b.id)
          .length === 2,
    );
    await db.petReminder.create({
      data: {
        petId: pet.id,
        title: "A_AFTER_SWITCH_PRIVATE_12E",
        dueAt: new Date(Date.now() - 1000),
      },
    });
    await run();
    assert.equal(
      await page
        .getByRole("button", { name: "Сповіщення", exact: true })
        .count(),
      1,
    );
    await open();
    await panel().getByText("Сповіщень поки немає", { exact: true }).waitFor();
    assert.ok(
      !(await page.locator("body").innerText()).includes("PRIVATE_12E"),
    );
    assert.equal(await db.notification.count({ where: { userId: b.id } }), 0);
    pass(
      "E: A socket disconnected/B fresh; A delivery after switch stays private, B bell/list/cache clean; nameless fallback valid",
    );
  }
  assert.deepEqual(errors, []);
  pass(
    "runtime/hydration errors0; fixtures scoped; no vaccine/medication integration",
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
    process.env.PHASE12E_BROWSER_VISUAL_ONLY
      ? "test-results/phase12e-browser-visual-retry.json"
      : "test-results/phase12e-browser.json",
    JSON.stringify({ checks, errors, failed: failed?.message }, null, 2),
  );
}
