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
  (process.env.PHASE13C_SCENARIOS || "A,B,C,D,E,F,G,H,I,J").split(","),
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
      path: "test-results/phase13c-failure-" + name + ".png",
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
  const password = "Motion13C-Local-Only!",
    passwordHash = await require("argon2").hash(password);
  for (let n = 0; n < 2; n++)
    users.push(
      await db.user.create({
        data: {
          email: "phase13c-" + randomUUID() + "@example.invalid",
          passwordHash,
          firstName: n ? "Продавець" : "Покупець",
          lastName: "Phase13C",
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
          name: "Тварина Phase13C",
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
      title: "Оголошення Phase13C",
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
      text: "Повідомлення Phase13C",
    },
  });
  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
  });
  for (const title of [
    "Перше сповіщення Phase13C",
    "Друге сповіщення Phase13C",
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
  const long = (prefix, limit) =>
    (prefix + "Довгенерозривненайменування".repeat(30)).slice(0, limit);
  const remPet = pet;
  const extraPet = await db.pet.create({
    data: {
      ownerId: viewer.id,
      speciesId: species.id,
      name: long("Догляд", 150),
      gender: "MALE",
    },
  });
  pets.push(extraPet);
  pet = extraPet;
  const qaBreed = await db.breed.create({
    data: {
      speciesId: species.id,
      slug: "phase13c-" + randomUUID(),
      name: long("Breed", 145),
      nameUk: long("Порода", 145),
    },
  });
  globalThis.qaBreedId = qaBreed.id;
  await db.user.update({
    where: { id: viewer.id },
    data: { firstName: long("Ім’я", 95), lastName: long("Прізвище", 95) },
  });
  await db.user.update({
    where: { id: seller.id },
    data: {
      accountType: "BREEDER",
      firstName: long("Ім’я", 95),
      lastName: long("Прізвище", 95),
    },
  });
  await db.pet.update({
    where: { id: pets[1].id },
    data: {
      name: long("Тварина", 145),
      breedId: qaBreed.id,
      showOnBreederProfile: true,
    },
  });
  const breeder = await db.breederProfile.create({
    data: { userId: seller.id, kennelName: long("Розплідник", 155) },
  });
  await db.breederMedia.create({
    data: {
      breederProfileId: breeder.id,
      type: "VIDEO",
      position: 0,
      url: "https://vimeo.com/123",
    },
  });
  const mating = await db.matingListing.create({
    data: {
      ownerId: seller.id,
      petId: pets[1].id,
      locationId: location.id,
      title: long("В’язка", 150),
      description: long("Умови", 1000),
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
      price: "123456789.45",
    },
  });
  globalThis.qaMatingId = mating.id;
  await db.listing.update({
    where: { id: listing.id },
    data: {
      title: long("Оголошення", 155),
      description: long("Опис", 1000),
      price: "123456789.45",
    },
  });
  await db.message.update({
    where: { id: message.id },
    data: { text: long("Повідомлення", 2900) },
  });
  await db.sellerProfile.create({
    data: {
      userId: seller.id,
      phone: "+380501234567",
      telegram: "phase13c_test",
    },
  });
  await db.listingImage.createMany({
    data: [0, 1, 2].map((position) => ({
      listingId: listing.id,
      position,
      url:
        "https://res.cloudinary.com/demo/image/upload/phase13c-" +
        position +
        ".png",
    })),
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J9sAAAAASUVORK5CYII=",
    "base64",
  );
  await context.route("https://res.cloudinary.com/**", (r) =>
    r.fulfill({ contentType: "image/png", body: png }),
  );
  await context.route("https://player.vimeo.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>QA video</title>",
    }),
  );
  const dueAt = new Date(Date.now() - 3600000),
    reminders = [];
  await db.notification.deleteMany({ where: { userId: viewer.id } });
  for (const i of [0, 1]) {
    const reminder = await db.petReminder.create({
      data: {
        petId: remPet.id,
        title: long(i ? "Друге нагадування " : "Перше нагадування ", 118),
        dueAt: new Date(dueAt.getTime() + i * 1000),
        notes: i ? "Другий запис" : "Довга нотатка.\n".repeat(40),
      },
    });
    reminders.push(reminder);
    await db.notification.create({
      data: {
        userId: viewer.id,
        type: "PET_REMINDER_DUE",
        title: reminder.title,
        body: "Нагадування про догляд",
        reminderId: reminder.id,
        reminderDueAt: reminder.dueAt,
        href: "/pets/" + remPet.id + "/care/reminders",
      },
    });
  }
  await db.notification.create({
    data: {
      userId: viewer.id,
      type: "SYSTEM",
      title: long("Системне", 158),
      body: long("Текст", 1200),
      href: "/account",
    },
  });
  await db.notification.create({
    data: {
      userId: viewer.id,
      type: "NEW_MESSAGE",
      messageId: message.id,
      title: "Повідомлення Phase13C",
      body: long("Текст", 1200),
      href: "/messages/" + conversation.id,
    },
  });
  await db.petCareEntry.create({
    data: {
      petId: pet.id,
      type: "VET_VISIT",
      title: long("Історія", 138),
      occurredAt: dueAt,
      notes: long("Нотатка", 1500),
    },
  });
  await db.petVaccinationRecord.create({
    data: {
      petId: pet.id,
      name: long("Вакцинація", 138),
      administeredAt: dueAt,
      notes: long("Нотатка", 1500),
    },
  });
  await db.petMedicationRecord.create({
    data: {
      petId: pet.id,
      name: long("Препарат", 138),
      startedAt: dueAt,
      notes: long("Нотатка", 1500),
    },
  });
  const reps = [320, 375, 768, 1440];
  const geometry = async (label) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      await noOverflow(label + " " + width);
      assert.equal(await page.locator("select").count(), 0);
    }
  };
  const shot = async (label) => {
    const width = page.viewportSize().width;
    if (reps.includes(width))
      await page.screenshot({
        path: "test-results/phase13c-" + label + "-" + width + ".png",
      });
  };
  const target = async (locator, label) => {
    const b = await locator.boundingBox();
    assert.ok(
      b && b.width >= 43.5 && b.height >= 43.5,
      label + " 44px target " + JSON.stringify(b),
    );
  };
  const fit = async (locator, label) => {
    await settle(locator);
    const b = await locator.boundingBox();
    assert.ok(
      b && b.x >= -1 && b.x + b.width <= page.viewportSize().width + 1,
      label + " horizontal fit " + JSON.stringify(b),
    );
  };
  await run("A", async () => {
    await go("/");
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(
      await page.locator(".notification-trigger,.message-navigation").count(),
      0,
    );
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow("home " + width);
      await shot("home");
      await page.evaluate(() => window.scrollTo(0, 300));
      assert.ok(
        Math.abs((await page.locator(".site-header").boundingBox()).y) < 1,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await go("/listings");
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(
      await page.locator('.desktop-navigation [aria-current="page"]').count(),
      1,
    );
    assert.equal(
      await page
        .locator('.desktop-navigation a[href="/listings"]')
        .getAttribute("aria-current"),
      "page",
    );
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 900 });
      await target(page.locator(".mobile-navigation-trigger"), "burger");
      await noOverflow("mobile header");
    }
  });
  await run("B", async () => {
    for (const width of [320, 375, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page
        .getByRole("button", { name: "Відкрити меню", exact: true })
        .click();
      const menu = page.getByRole("dialog", { name: "Меню", exact: true });
      await fit(menu, "menu");
      const b = await menu.boundingBox();
      assert.ok(Math.abs(b.y) < 1 && b.height >= 899);
      await target(
        menu.getByRole("button", { name: "Закрити меню", exact: true }),
        "menu close",
      );
      await shot("menu");
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await menu.evaluate((e) => e.contains(document.activeElement)),
        true,
      );
      await page.keyboard.press("Escape");
      await settle(page.locator(".mobile-navigation-dialog"));
      assert.equal(
        await page.locator("body").evaluate((e) => e.style.overflow),
        "",
      );
      assert.equal(
        await page
          .locator(".mobile-navigation-dialog")
          .evaluate((e) => e.inert && !e.open),
        true,
      );
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Мобільна навігація", exact: true })
      .getByRole("link", { name: "В’язка", exact: true })
      .click();
    await page.waitForURL("**/mating");
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await until(async () => (await page.locator("dialog[open]").count()) === 0);
    assert.equal(
      await page.locator("body").evaluate((e) => e.style.overflow),
      "",
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
    await go("/listings");
    await geometry("catalog");
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 800 });
      const sort = page.locator('.catalog-sort [role="combobox"]').first();
      await sort.click();
      const list = page.getByRole("listbox", { name: /Сортування/ }).first();
      await fit(list, "sort");
      const b = await list.boundingBox();
      assert.ok(
        b.y >= 0 && b.y + b.height <= 801,
        "sort bottom clipping " + JSON.stringify(b),
      );
      await page.keyboard.press("Escape");
    }
    await go("/listings/" + listing.id);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow("listing detail " + width);
      await shot("listing-detail");
      await target(
        page.locator(".seller-primary-actions .button").first(),
        "seller action",
      );
      assert.ok(await page.locator(".report-action").count());
    }
    await page.locator(".gallery-open").click();
    const gallery = page.locator("dialog.gallery-lightbox");
    await gallery.waitFor();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await gallery.waitFor({ state: "hidden" });
    const report = page.getByRole("button", {
      name: "Поскаржитися",
      exact: true,
    });
    await report.click();
    const dialog = page.locator("dialog.report-dialog");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 700 });
      await fit(dialog, "report");
      const b = await dialog.boundingBox();
      assert.ok(b.y >= 0 && b.y + b.height <= 701);
      await noOverflow("report");
    }
    await page.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((e) => e.contains(document.activeElement)),
      true,
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(
      await report.evaluate((e) => e === document.activeElement),
      true,
    );
  });
  await run("D", async () => {
    await go("/mating");
    await geometry("mating cards");
    await go("/mating/" + mating.id);
    await geometry("mating detail");
    assert.equal(
      await page
        .locator(".listing-detail-sidebar")
        .evaluate((e) =>
          e.lastElementChild.classList.contains("report-action"),
        ),
      true,
    );
    await go("/sellers/" + seller.id);
    await geometry("breeder");
    assert.equal(await page.locator(".breeder-video-player iframe").count(), 1);
    assert.equal(
      await page.getByRole("button", { name: /Переглянути відео/ }).count(),
      0,
    );
  });
  await run("E", async () => {
    for (const path of [
      "/account",
      "/profile",
      "/listings/new",
      "/mating/new",
    ]) {
      await go(path);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await noOverflow(path + " " + width);
        if (path === "/account") await shot("account");
      }
      assert.equal(await page.locator("select").count(), 0);
    }
    await go("/account");
    await page.setViewportSize({ width: 320, height: 360 });
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    const menu = page.getByRole("dialog", { name: "Меню", exact: true });
    await menu
      .getByRole("link", { name: "Мій профіль", exact: true })
      .scrollIntoViewIfNeeded();
    await target(
      menu.getByRole("button", { name: "Закрити меню", exact: true }),
      "close",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("body").evaluate((e) => e.style.overflow),
      "",
    );
  });
  await run("F", async () => {
    const dialog = await openReminder();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow("care form " + width);
      assert.equal(
        await dialog.locator("input[type=date],input[type=time]").count(),
        0,
      );
      await shot("care-form");
      await dialog.getByRole("button", { name: "Дата", exact: true }).click();
      const calendar = dialog.getByRole("dialog", {
        name: "Календар: Дата",
        exact: true,
      });
      await fit(calendar, "calendar");
      await target(
        calendar.getByRole("button", {
          name: "Попередній місяць",
          exact: true,
        }),
        "previous month",
      );
      assert.equal(
        await calendar.getByRole("columnheader").first().innerText(),
        "Пн",
      );
      for (const label of ["Місяць", "Рік"]) {
        const combo = calendar.getByRole("combobox", {
          name: label,
          exact: true,
        });
        await combo.focus();
        await page.keyboard.press("Space");
        await fit(
          calendar.getByRole("listbox", { name: label, exact: true }),
          label,
        );
        await page.keyboard.press("Escape");
      }
      await page.keyboard.press("Escape");
      await until(
        async () => (await dialog.locator(".care-calendar").count()) === 0,
      );
      for (const value of ["00:00", "08:00", "16:00", "23:45"]) {
        for (const [label, index] of [
          ["Час: години", 0],
          ["Час: хвилини", 1],
        ]) {
          const combo = dialog.getByRole("combobox", {
            name: label,
            exact: true,
          });
          await combo.click();
          await dialog
            .getByRole("option", { name: value.split(":")[index], exact: true })
            .click();
        }
        assert.equal(
          await dialog
            .getByLabel("Час у форматі HH:mm", { exact: true })
            .innerText(),
          value,
        );
      }
    }
    await closedSurfaces();
    await closeReminder(dialog);
    for (const suffix of [
      "",
      "/reminders",
      "/history",
      "/vaccinations",
      "/medications",
    ]) {
      await go("/pets/" + pet.id + "/care" + suffix);
      await geometry("care" + suffix);
    }
    await go("/pets/" + pet.id + "/care/vaccinations");
    await page
      .getByRole("button", { name: "Видалити", exact: true })
      .first()
      .click();
    const confirm = page.locator("dialog.reminder-dialog");
    await fit(confirm, "delete confirmation");
    await page.keyboard.press("Escape");
    await confirm.waitFor({ state: "detached" });
  });
  await run("G", async () => {
    await go("/account");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await target(page.locator(".notification-trigger"), "bell");
      await target(page.locator(".message-navigation"), "messages");
      await page.getByRole("button", { name: /^Сповіщення/ }).click();
      const panel = page.getByRole("region", {
        name: "Сповіщення",
        exact: true,
      });
      await fit(panel, "bell panel");
      await noOverflow("notification " + width);
      await page.keyboard.press("Escape");
      await until(
        async () => (await page.locator(".notification-panel").count()) === 0,
      );
    }
    await page.setViewportSize({ width: 375, height: 800 });
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 4", exact: true })
      .click();
    await page
      .getByRole("link", { name: reminders[0].title, exact: true })
      .click();
    await page.waitForURL("**/care/reminders");
    await page.waitForLoadState("networkidle");
    assert.equal(
      await db.notification.count({
        where: { userId: viewer.id, readAt: null },
      }),
      3,
    );
    await page
      .getByRole("article", { name: reminders[1].title, exact: true })
      .scrollIntoViewIfNeeded();
    await page.bringToFront();
    await until(
      async () =>
        (await db.notification.count({
          where: { userId: viewer.id, readAt: null },
        })) === 2,
    );
    await until(() =>
      page
        .getByRole("button", {
          name: "Сповіщення, непрочитаних: 2",
          exact: true,
        })
        .isVisible(),
    );
    assert.equal(
      await db.notification.count({
        where: { userId: viewer.id, type: "SYSTEM", readAt: null },
      }),
      1,
    );
  });
  await run("H", async () => {
    await go("/messages");
    await geometry("inbox");
    await go("/messages/" + conversation.id);
    await geometry("conversation");
    const action = page.locator('summary[aria-label="Дії з повідомленням"]');
    await action.click();
    await page
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .click();
    const dialog = page.locator("dialog.report-dialog");
    await fit(dialog, "message report");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(
      await action.evaluate((e) => e === document.activeElement),
      true,
    );
  });
  await run("I", async () => {
    await go("/listings");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("Tab");
    const link = page.locator('.desktop-navigation a[href="/listings"]');
    await link.focus();
    const focus = await link.evaluate((e) => {
      const s = getComputedStyle(e);
      return {
        color: s.outlineColor,
        width: s.outlineWidth,
        style: s.outlineStyle,
      };
    });
    const nums = focus.color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    const l = (rgb) => {
      const c = rgb
        .map((x) => x / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const a = l(nums),
      b = l([250, 247, 242]),
      ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(
      focus.style !== "none" && ratio >= 3,
      "focus ring contrast " + ratio.toFixed(2) + " " + focus.color,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 900 });
    const dialog = await openReminder();
    await dialog.getByRole("button", { name: "Дата", exact: true }).click();
    const calendar = dialog.getByRole("dialog", {
      name: "Календар: Дата",
      exact: true,
    });
    assert.equal(
      await calendar.evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    assert.equal(
      await calendar.evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await page.keyboard.press("Escape");
    await closeReminder(dialog);
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await until(async () => (await page.locator("dialog[open]").count()) === 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });
  await run("J", async () => {
    for (const path of [
      "/",
      "/listings",
      "/listings/" + listing.id,
      "/mating",
      "/mating/" + mating.id,
      "/sellers/" + seller.id,
      "/account",
      "/profile",
      "/pets",
      "/pets/" + pet.id + "/edit",
      "/pets/" + pet.id + "/care",
      "/pets/" + pet.id + "/care/history",
      "/pets/" + pet.id + "/care/vaccinations",
      "/pets/" + pet.id + "/care/medications",
      "/messages",
      "/messages/" + conversation.id,
    ]) {
      await go(path);
      await geometry(path);
    }
    assert.deepEqual(errors, []);
  });
} finally {
  await context.close();
  await browser.close();
  if (conversation)
    await db.conversation.delete({ where: { id: conversation.id } });
  if (globalThis.qaMatingId)
    await db.matingListing.delete({ where: { id: globalThis.qaMatingId } });
  if (listing) await db.listing.delete({ where: { id: listing.id } });
  await db.pet.deleteMany({ where: { id: { in: pets.map((p) => p.id) } } });
  if (globalThis.qaBreedId)
    await db.breed.delete({ where: { id: globalThis.qaBreedId } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase13c-browser" +
      (process.env.PHASE13C_SCENARIOS
        ? "-" + process.env.PHASE13C_SCENARIOS.replaceAll(",", "")
        : "") +
      ".json",
    JSON.stringify({ checks, errors, failures }, null, 2),
  );
}
if (failures.length || errors.length)
  throw Error("Phase13C browser validation has failed scenarios");
