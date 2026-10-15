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
const app = (
  await Test.createTestingModule({ imports: [AppModule] }).compile()
).createNestApplication({ logger: false });
configureApp(app);
await app.listen(4000);
const db = app.get(PrismaService);
const { NotificationsService } =
  await import("../../pet-platform-backend/dist/src/notifications/notifications.service.js");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  timezoneId: "Europe/Kyiv",
  viewport: { width: 1440, height: 850 },
});
const page = await context.newPage(),
  users = [],
  pets = [],
  checks = [],
  errors = [];
let failure;
page.on("pageerror", (e) => errors.push(e.message));
await context.route(
  /https:\/\/(www.youtube-nocookie.com|player.vimeo.com)\//,
  (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Fixture video embed</title>",
    }),
);
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
const go = async (path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
const until = async (fn) => {
  for (let n = 0; n < 120; n++) {
    if (await fn()) return;
    await page.waitForTimeout(100);
  }
  throw Error("Condition timed out");
};
async function responsive(name) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      name + " overflow " + width,
    );
    assert.equal(await page.locator("select").count(), 0);
    for (const input of await page
      .locator("input[type=checkbox],input[type=radio]")
      .all()) {
      assert.equal(
        await input.evaluate((e) => {
          const style = getComputedStyle(e);
          return (
            style.appearance === "none" ||
            (Boolean(e.closest(".review-rating-option")) &&
              style.opacity === "0" &&
              Boolean(e.nextElementSibling?.querySelector("svg")))
          );
        }),
        true,
        name + " custom input",
      );
    }
    await page.screenshot({
      path: `test-results/phase13a-${name}-${width}.png`,
      fullPage: true,
    });
  }
  pass(name + ": seven widths, no overflow/native select, custom choices");
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Phase13a-Local-Only!";
  const passwordHash = await require("argon2").hash(password);
  for (const accountType of ["BREEDER", "SELLER"])
    users.push(
      await db.user.create({
        data: {
          email: "phase13a-" + randomUUID() + "@example.invalid",
          passwordHash,
          firstName: "Олександр",
          lastName: "Тестовий",
          accountType,
        },
      }),
    );
  const [seller, viewer] = users;
  const species = await db.species.findFirstOrThrow({ where: { slug: "dog" } }),
    location = await db.location.findFirstOrThrow({
      where: { isActive: true },
    });
  for (const owner of users)
    pets.push(
      await db.pet.create({
        data: {
          ownerId: owner.id,
          speciesId: species.id,
          name: "Тварина Phase13A",
          gender: "MALE",
          showOnBreederProfile: owner.id === seller.id,
        },
      }),
    );
  const breeder = await db.breederProfile.create({
    data: {
      userId: seller.id,
      kennelName: "Розплідник Phase13A",
      description: "Тестовий публічний профіль",
    },
  });
  await db.breederMedia.create({
    data: {
      breederProfileId: breeder.id,
      type: "VIDEO",
      position: 0,
      url: "https://vimeo.com/123",
    },
  });
  await db.sellerProfile.create({
    data: {
      userId: seller.id,
      phone: "+380501234567",
      telegram: "phase13a_test",
    },
  });
  const listing = await db.listing.create({
    data: {
      sellerId: seller.id,
      petId: pets[0].id,
      locationId: location.id,
      type: "SALE",
      title: "Оголошення Phase13A",
      description: "Опис для перевірки інтерфейсу.",
      price: "1200.50",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  const mating = await db.matingListing.create({
    data: {
      ownerId: seller.id,
      petId: pets[0].id,
      locationId: location.id,
      title: "В’язка Phase13A",
      description: "Умови в’язки для перевірки інтерфейсу.",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  await go("/");
  assert.equal(new URL(page.url()).pathname, "/");
  await page
    .getByRole("link", { name: "Переглянути оголошення", exact: true })
    .waitFor();
  await responsive("home-public");
  await go("/register");
  await responsive("registration");
  const radio = page.getByRole("radio").last();
  await radio.check();
  assert.equal(await radio.isChecked(), true);
  await radio.focus();
  await page.keyboard.press("ArrowLeft");
  pass("custom radios retain click and keyboard behavior");
  await go("/listings");
  await responsive("catalog");
  await page.setViewportSize({ width: 1440, height: 850 });
  assert.equal(
    await page
      .locator('.desktop-navigation a[href="/listings"]')
      .getAttribute("aria-current"),
    "page",
  );
  await page.evaluate(() => window.scrollTo(0, 500));
  assert.ok(Math.abs((await page.locator(".site-header").boundingBox()).y) < 1);
  pass("sticky header and active catalog navigation");
  for (const width of [320, 375, 430, 768]) {
    await page.setViewportSize({ width, height: 850 });
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "Меню", exact: true });
    await menu.waitFor();
    await until(async () => {
      const box = await menu.boundingBox();
      return box && Math.abs(box.y) < 1;
    });
    const b = await menu.boundingBox();
    assert.ok(
      b.width >= width - 1 &&
        b.height >= 849 &&
        Math.abs(b.x) < 1 &&
        Math.abs(b.y) < 1,
    );
    assert.equal(
      await page.locator("body").evaluate((e) => getComputedStyle(e).overflow),
      "hidden",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () =>
          !!document.activeElement.closest("dialog.mobile-navigation-dialog"),
      ),
      true,
    );
    await page.screenshot({ path: `test-results/phase13a-menu-${width}.png` });
    await page.keyboard.press("Escape");
    await until(() =>
      page
        .getByRole("button", { name: "Відкрити меню", exact: true })
        .isVisible(),
    );
  }
  pass("full-screen mobile menu, focus containment, Escape and focus return");
  await page.setViewportSize({ width: 1440, height: 850 });
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(viewer.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
  await responsive("account");
  assert.equal(
    await page.locator('a[href="/mating/my"]').getAttribute("class"),
    "button secondary",
  );
  await go("/profile");
  await responsive("profile");
  await go("/listings/new");
  await responsive("listing-form");
  const price = page.locator("#price");
  if (await price.count()) {
    await price.fill("12abc.50");
    assert.equal(await price.inputValue(), "12.50");
  }
  await go("/pets/" + pets[1].id + "/edit");
  await responsive("pet-form");
  const checkbox = page.getByRole("checkbox").first();
  await checkbox.check();
  assert.equal(await checkbox.isChecked(), true);
  await checkbox.focus();
  await page.keyboard.press("Space");
  assert.equal(await checkbox.isChecked(), false);
  pass("custom checkbox click/Space, numeric input normalization");
  await go("/listings/" + listing.id);
  await responsive("listing-detail");
  const sellerActions = page.locator(".seller-primary-actions");
  await sellerActions
    .getByRole("button", { name: "Написати продавцю", exact: true })
    .waitFor();
  await sellerActions
    .getByRole("link", { name: "Переглянути профіль", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".report-action .button").getAttribute("class"),
    "button warning compact",
  );
  await page
    .getByRole("button", { name: "Показати телефон", exact: true })
    .click();
  await page
    .getByRole("link", { name: "+380501234567", exact: true })
    .waitFor();
  pass("seller action group, optional contact reveal and distinct report");
  await go("/mating/" + mating.id);
  await responsive("mating-detail");
  assert.equal(
    await page
      .locator(".listing-detail-sidebar")
      .evaluate((e) => e.lastElementChild.classList.contains("report-action")),
    true,
  );
  pass("mating report follows seller and facts");
  await go("/sellers/" + seller.id);
  await responsive("breeder-video");
  assert.equal(await page.locator(".breeder-video-player iframe").count(), 1);
  assert.equal(
    await page.getByRole("button", { name: /Переглянути відео/ }).count(),
    0,
  );
  pass("breeder video visible immediately, responsive trusted iframe");
  const notifications = app.get(NotificationsService),
    dueAt = new Date(Date.now() - 3600000),
    reminders = [];
  for (const [i, title] of [
    "Перше нагадування Phase13A",
    "Друге нагадування Phase13A",
  ].entries()) {
    const r = await db.petReminder.create({
      data: {
        petId: pets[1].id,
        title,
        dueAt: new Date(dueAt.getTime() + i * 1000),
        notes:
          i === 0
            ? "Деталі нагадування.\n".repeat(30)
            : "Друге переглянуте нагадування",
      },
    });
    reminders.push(r);
    await notifications.create({
      userId: viewer.id,
      type: "PET_REMINDER_DUE",
      title,
      body: "Час події",
      href: "/pets/" + pets[1].id + "/care/reminders",
      reminderId: r.id,
      reminderDueAt: r.dueAt,
    });
  }
  await notifications.create({
    userId: viewer.id,
    type: "SYSTEM",
    title: "Інше сповіщення",
    body: "Залишається непрочитаним",
    href: "/account",
  });
  await go("/account");
  await page.setViewportSize({ width: 375, height: 700 });
  await page
    .getByRole("button", { name: "Сповіщення, непрочитаних: 3", exact: true })
    .click();
  await page.getByRole("link", { name: /Перше нагадування Phase13A/ }).click();
  await page.waitForURL("**/care/reminders");
  await page.waitForLoadState("networkidle");
  assert.equal(
    await db.notification.count({ where: { userId: viewer.id, readAt: null } }),
    2,
  );
  const second = page.getByRole("article", {
    name: "Друге нагадування Phase13A",
    exact: true,
  });
  const background = await context.newPage();
  await background.goto("http://localhost:3000/account");
  await background.bringToFront();
  await second.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  assert.equal(
    await db.notification.count({ where: { userId: viewer.id, readAt: null } }),
    2,
  );
  await background.close();
  await page.bringToFront();
  pass("background tab does not acknowledge the second reminder");
  await until(
    async () =>
      (await db.notification.count({
        where: { userId: viewer.id, readAt: null },
      })) === 1,
  );
  await until(() =>
    page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .isVisible(),
  );
  assert.equal(
    await db.notification.count({
      where: { userId: viewer.id, type: "SYSTEM", readAt: null },
    }),
    1,
  );
  pass(
    "notification link reads first; viewing second clears its bell state, SYSTEM remains unread",
  );
  await responsive("reminders");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".site-header")
      .evaluate(
        () =>
          getComputedStyle(document.querySelector(".button"))
            .transitionDuration,
      ),
    "1e-05s",
  );
  pass("reduced motion respected");
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
} catch (e) {
  failure = e;
  await page.screenshot({
    path: "test-results/phase13a-failure.png",
    fullPage: false,
  });
  throw e;
} finally {
  await context.close();
  await browser.close();
  await db.listing.deleteMany({
    where: { sellerId: { in: users.map((u) => u.id) } },
  });
  await db.matingListing.deleteMany({
    where: { ownerId: { in: users.map((u) => u.id) } },
  });
  await db.pet.deleteMany({ where: { id: { in: pets.map((p) => p.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await app.close();
  await writeFile(
    "test-results/phase13a-browser.json",
    JSON.stringify({ checks, errors, failure: failure?.message }, null, 2),
  );
}
