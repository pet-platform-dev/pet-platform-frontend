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
  await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const db = new PrismaService();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  timezoneId: "Europe/Kyiv",
});
const page = await context.newPage(),
  users = [],
  pets = [],
  checks = [],
  errors = [],
  failures = [];
const widths = [320, 375, 430, 768, 1024, 1280, 1440];
const selected = new Set(
  (process.env.PHASE13B_SCENARIOS || "A,B,C,D,E,F,G,H").split(","),
);
const go = async (path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
const until = async (fn) => {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await page.waitForTimeout(30);
  }
  throw Error("Motion condition timed out");
};
const settle = async (locator) =>
  locator.evaluate(async (e) => {
    await Promise.all(
      e
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
const noOverflow = async (label) =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    label,
  );
const closedSurfaces = async () => {
  assert.equal(
    await page
      .locator('[data-motion="closed"]')
      .evaluateAll((els) =>
        els.every((e) => e.inert && e.getAttribute("aria-hidden") === "true"),
      ),
    true,
  );
};
const run = async (name, fn) => {
  if (!selected.has(name)) return;
  try {
    await fn();
    checks.push(name);
    console.log("PASS " + name);
  } catch (e) {
    failures.push({ name, error: e.message });
    console.error("FAIL " + name + ": " + e.message);
    await page.screenshot({
      path: "test-results/phase13b-failure-" + name + ".png",
    });
  }
};
page.on("pageerror", (e) => errors.push(e.message));
let listing, conversation, pet, viewer;
async function openReminder() {
  await go("/pets/" + pet.id + "/care/reminders");
  await page
    .getByRole("button", { name: "Додати нагадування", exact: true })
    .click();
  const dialog = page.locator("dialog.reminder-dialog");
  await dialog.waitFor();
  await settle(dialog);
  return dialog;
}
async function closeReminder(dialog) {
  await dialog.getByRole("button", { name: "Скасувати", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", { name: "Додати нагадування", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(
    await page.locator("body").evaluate((e) => e.style.overflow),
    "",
  );
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Motion13B-Local-Only!",
    passwordHash = await require("argon2").hash(password);
  for (let n = 0; n < 2; n++)
    users.push(
      await db.user.create({
        data: {
          email: "phase13b-" + randomUUID() + "@example.invalid",
          passwordHash,
          firstName: n ? "Продавець" : "Покупець",
          lastName: "Phase13B",
        },
      }),
    );
  viewer = users[0];
  const seller = users[1],
    species = await db.species.findFirstOrThrow({ where: { slug: "dog" } }),
    location = await db.location.findFirstOrThrow({
      where: { isActive: true },
    });
  for (const user of users)
    pets.push(
      await db.pet.create({
        data: {
          ownerId: user.id,
          speciesId: species.id,
          name: "Тварина Phase13B",
          gender: "MALE",
        },
      }),
    );
  pet = pets[0];
  listing = await db.listing.create({
    data: {
      sellerId: seller.id,
      petId: pets[1].id,
      locationId: location.id,
      type: "SALE",
      title: "Оголошення Phase13B",
      description: "Лише локальна перевірка руху.",
      price: "1000.50",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  conversation = await db.conversation.create({
    data: {
      listingId: listing.id,
      listingKey: listing.id,
      buyerId: viewer.id,
      sellerId: seller.id,
      listingTitleSnapshot: listing.title,
    },
  });
  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      senderId: seller.id,
      text: "Повідомлення Phase13B",
    },
  });
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
  });
  for (const title of [
    "Перше сповіщення Phase13B",
    "Друге сповіщення Phase13B",
  ])
    await db.notification.create({
      data: {
        userId: viewer.id,
        type: "SYSTEM",
        title,
        body: "Перевірка візуального стану",
        href: "/account",
      },
    });
  await run("A", async () => {
    await go("/listings");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow("header " + width);
      assert.equal(
        await page
          .locator(".site-header")
          .evaluate((e) => getComputedStyle(e).position),
        "sticky",
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(
      await page
        .locator('.desktop-navigation a[href="/listings"]')
        .getAttribute("aria-current"),
      "page",
    );
    const indicator = await page
      .locator('.desktop-navigation a[href="/listings"]')
      .evaluate((e) => getComputedStyle(e, "::after").opacity);
    assert.equal(indicator, "1");
    await page.evaluate(() => window.scrollTo(0, 500));
    assert.ok(
      Math.abs((await page.locator(".site-header").boundingBox()).y) < 1,
    );
  });
  await run("B", async () => {
    for (const width of [320, 375, 430, 768]) {
      await go("/listings");
      await page.setViewportSize({ width, height: 900 });
      const trigger = page.getByRole("button", {
        name: "Відкрити меню",
        exact: true,
      });
      await trigger.click();
      const menu = page.getByRole("dialog", { name: "Меню", exact: true });
      await settle(menu);
      const box = await menu.boundingBox();
      assert.ok(
        Math.abs(box.x) < 1 &&
          Math.abs(box.y) < 1 &&
          box.width >= width - 1 &&
          box.height >= 899,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(
          () => !!document.activeElement.closest(".mobile-navigation-dialog"),
        ),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .locator(".mobile-navigation-dialog")
          .evaluate((e) => !e.open && e.inert),
        true,
      );
      await settle(page.locator(".mobile-navigation-dialog"));
      assert.equal(
        await trigger.evaluate((e) => e === document.activeElement),
        true,
      );
      assert.equal(
        await page.locator("body").evaluate((e) => e.style.overflow),
        "",
      );
      await trigger.click();
      await page
        .getByRole("navigation", { name: "Мобільна навігація", exact: true })
        .getByRole("link", { name: "В’язка", exact: true })
        .click();
      await page.waitForURL("**/mating");
      await page.waitForLoadState("networkidle");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await noOverflow("menu route " + width);
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await until(async () => (await page.locator("dialog[open]").count()) === 0);
    assert.equal(
      await page.locator("body").evaluate((e) => e.style.overflow),
      "",
    );
    await page.setViewportSize({ width: 375, height: 900 });
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Меню", exact: true })
      .getByRole("button", { name: "Закрити меню", exact: true })
      .click();
    await settle(page.locator(".mobile-navigation-dialog"));
    assert.equal(
      await page
        .locator(".mobile-navigation-dialog")
        .evaluate((e) => !e.open && e.inert),
      true,
    );
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(viewer.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
  await run("C", async () => {
    const dialog = await openReminder();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const date = dialog.getByRole("button", { name: "Дата", exact: true });
      await date.click();
      const calendar = dialog.getByRole("dialog", {
        name: "Календар: Дата",
        exact: true,
      });
      await settle(calendar);
      const box = await calendar.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      const month = calendar.getByRole("combobox", {
        name: "Місяць",
        exact: true,
      });
      await month.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Escape");
      assert.equal(await calendar.isVisible(), true);
      assert.equal(await dialog.evaluate((e) => e.open), true);
      await closedSurfaces();
      await calendar.locator("[data-day]").first().focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Escape");
      assert.equal(
        await date.evaluate((e) => e === document.activeElement),
        true,
      );
      await closedSurfaces();
      await until(
        async () => (await dialog.locator(".care-calendar").count()) === 0,
      );
      const hour = dialog.getByRole("combobox", {
        name: "Час: години",
        exact: true,
      });
      await hour.focus();
      await page.keyboard.press("Enter");
      const options = dialog.getByRole("listbox", {
        name: "Час: години",
        exact: true,
      });
      await settle(options);
      const b = await options.boundingBox();
      assert.ok(b.x >= 0 && b.x + b.width <= width + 1);
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      assert.equal(await hour.getAttribute("data-value"), "23");
      await closedSurfaces();
      await until(
        async () =>
          (await dialog.locator('[data-motion="closed"]').count()) === 0,
      );
      await hour.click();
      await page.keyboard.press("Escape");
      await hour.click();
      await page.keyboard.press("Escape");
      await closedSurfaces();
      await noOverflow("pickers " + width);
    }
    await closeReminder(dialog);
  });
  await run("D", async () => {
    const dialog = await openReminder();
    await dialog.getByLabel("Назва", { exact: true }).fill("Тест форми");
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Додати нагадування", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await go("/listings/" + listing.id);
    const report = page.getByRole("button", {
      name: "Поскаржитися",
      exact: true,
    });
    await report.click();
    const modal = page.locator("dialog.report-dialog");
    await settle(modal);
    await page.keyboard.press("Tab");
    assert.equal(
      await modal.evaluate((e) => e.contains(document.activeElement)),
      true,
    );
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "detached" });
    assert.equal(
      await report.evaluate((e) => e === document.activeElement),
      true,
    );
  });
  await run("E", async () => {
    await go("/account");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: /^Сповіщення/ }).click();
      const panel = page.getByRole("region", {
        name: "Сповіщення",
        exact: true,
      });
      await settle(panel);
      const b = await panel.boundingBox();
      assert.ok(b.x >= 0 && b.x + b.width <= width + 1);
      await page.keyboard.press("Escape");
      await closedSurfaces();
      await until(
        async () => (await page.locator(".notification-panel").count()) === 0,
      );
    }
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 2", exact: true })
      .click();
    const panel = page.getByRole("region", { name: "Сповіщення", exact: true });
    await panel
      .getByRole("button", { name: "Позначити як прочитане", exact: true })
      .first()
      .click();
    await until(() =>
      page
        .getByRole("button", {
          name: "Сповіщення, непрочитаних: 1",
          exact: true,
        })
        .isVisible(),
    );
    assert.equal(await panel.locator(".is-unread").count(), 1);
    assert.equal(
      await page
        .locator(".notification-count")
        .evaluate((e) => getComputedStyle(e).animationName),
      "motion-badge",
    );
    await page.keyboard.press("Escape");
    await closedSurfaces();
    assert.equal(
      await page
        .locator(".message-navigation-count")
        .evaluate((e) => getComputedStyle(e).animationName),
      "motion-badge",
    );
    await page.getByRole("link", { name: /^Повідомлення/ }).click();
    await page.waitForURL("**/messages");
    await page.waitForLoadState("networkidle");
    await page.locator('a[href="/messages/' + conversation.id + '"]').waitFor();
    await noOverflow("messages");
  });
  await run("F", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await go("/listings");
    const card = page
      .locator(".listing-card")
      .filter({ has: page.locator('a[href^="/listings/' + listing.id + '"]') });
    await card.hover();
    await settle(card);
    assert.equal(
      await card.evaluate((e) => getComputedStyle(e).borderColor),
      "rgb(170, 181, 158)",
    );
    await card.locator("a").first().focus();
    assert.ok(await card.evaluate((e) => e.contains(document.activeElement)));
    const dialog = await openReminder(),
      button = dialog.getByRole("button", { name: "Скасувати", exact: true });
    await button.hover();
    await page.mouse.down();
    await settle(button);
    const transform = await button.evaluate(
      (e) => getComputedStyle(e).transform,
    );
    assert.ok(transform !== "none");
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await button.evaluate((e) => (e.disabled = true));
    assert.equal(
      await button.evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    await button.evaluate((e) => (e.disabled = false));
    await closeReminder(dialog);
    await go("/pets/" + pet.id + "/edit");
    const check = page.getByRole("checkbox").first();
    await check.check();
    await check.focus();
    await page.keyboard.press("Space");
    assert.equal(await check.isChecked(), false);
    assert.equal(
      await check.evaluate((e) => getComputedStyle(e).appearance),
      "none",
    );
  });
  await run("G", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 900 });
    await go("/");
    assert.equal(
      await page
        .locator(".welcome-card")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "Меню", exact: true });
    assert.equal(
      await menu.evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    await page.keyboard.press("Escape");
    await until(async () => (await page.locator("dialog[open]").count()) === 0);
    const dialog = await openReminder();
    await dialog.getByRole("button", { name: "Дата", exact: true }).click();
    const c = dialog.getByRole("dialog", {
      name: "Календар: Дата",
      exact: true,
    });
    assert.equal(
      await c.evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    assert.equal(
      await c.evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    await page.keyboard.press("Escape");
    await closedSurfaces();
    await closeReminder(dialog);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });
  await run("H", async () => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await go("/listings");
      await noOverflow("catalog " + width);
      assert.equal(await page.locator("select").count(), 0);
      await page.screenshot({
        path: "test-results/phase13b-" + width + ".png",
      });
    }
    assert.deepEqual(errors, []);
  });
} finally {
  await context.close();
  await browser.close();
  if (conversation)
    await db.conversation.delete({ where: { id: conversation.id } });
  if (listing) await db.listing.delete({ where: { id: listing.id } });
  await db.pet.deleteMany({ where: { id: { in: pets.map((p) => p.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase13b-browser" +
      (process.env.PHASE13B_SCENARIOS
        ? "-" + process.env.PHASE13B_SCENARIOS.replaceAll(",", "")
        : "") +
      ".json",
    JSON.stringify({ checks, errors, failures }, null, 2),
  );
}
if (failures.length || errors.length)
  throw Error("Phase13B browser validation has failed scenarios");
