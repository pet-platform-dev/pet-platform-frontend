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
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ timezoneId: "Europe/Kyiv" }),
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
      assert.ok(Math.abs(box.y + box.height / 2 - 500) < 2);
    }
    await page.screenshot({
      path: `test-results/phase12b-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Власник", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "pet-reminders-browser-" + randomUUID() + "@example.invalid",
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
          name: user.firstName + " PRIVATE_12B",
        },
      }),
    );
  const [owner, other] = users,
    [pet, otherPet] = pets,
    path = "/pets/" + pet.id + "/care/reminders",
    care = "/pets/" + pet.id + "/care";
  const expired = await db.petReminder.create({
    data: {
      petId: pet.id,
      title: "Прострочена подія PRIVATE_12B",
      notes: "Лише введені власником дані.",
      dueAt: new Date(Date.now() - 86400000),
    },
  });
  scenarios: {
    await login(page, owner, password);
    if (process.env.PHASE12B_BROWSER_VISUAL_ONLY) {
      await go(page, path + "?add=1");
    } else {
      await go(page, care);
      await page
        .getByRole("heading", { name: "Догляд за твариною", exact: true })
        .waitFor();
      await responsive("dashboard");
      await page
        .getByRole("link", { name: "+ Додати нагадування", exact: true })
        .first()
        .click();
      await page.waitForURL("**/care/reminders?add=1");
    }
    const dialog = page.getByRole("dialog", {
      name: "Додати нагадування",
      exact: true,
    });
    await dialog.waitFor();
    await dialog
      .getByLabel("Назва", { exact: true })
      .fill("Щотижнева подія PRIVATE_12B");
    await dialog.getByLabel("Дата", { exact: true }).fill("2027-01-20");
    await dialog.getByLabel("Час", { exact: true }).fill("09:30");
    const recurrence = dialog.getByRole("combobox", {
      name: "Повторення",
      exact: true,
    });
    await recurrence.click();
    await dialog.getByRole("option", { name: "Щотижня", exact: true }).click();
    await dialog
      .getByLabel("Нотатка (необов’язково)", { exact: true })
      .fill("Приватна нотатка <b>plain text</b>");
    await responsive("form");
    if (process.env.PHASE12B_BROWSER_VISUAL_ONLY) {
      assert.deepEqual(errors, []);
      pass(
        "H visual correction: centered dialog, readable primary actions and no overflow at375/768/1440",
      );
      break scenarios;
    }
    // Error preserves user input; only confirmed save changes the list.
    const post = "**/api/v1/pets/" + pet.id + "/reminders";
    await page.route(post, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: '{"message":"RAW_PRIVATE_ERROR"}',
          })
        : route.continue(),
    );
    await dialog.getByRole("button", { name: "Зберегти", exact: true }).click();
    await dialog.getByRole("alert").waitFor();
    assert.equal(
      await dialog.getByLabel("Назва", { exact: true }).inputValue(),
      "Щотижнева подія PRIVATE_12B",
    );
    assert.ok(!(await dialog.innerText()).includes("RAW_PRIVATE_ERROR"));
    await page.unroute(post);
    await dialog.getByRole("button", { name: "Зберегти", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    let recurring = await db.petReminder.findFirstOrThrow({
      where: { petId: pet.id, title: "Щотижнева подія PRIVATE_12B" },
    });
    assert.equal(recurring.dueAt.toISOString(), "2027-01-20T07:30:00.000Z");
    assert.equal(recurring.recurrenceType, "WEEKLY");
    const pending = page.getByRole("region", {
        name: "Заплановані нагадування",
        exact: true,
      }),
      completed = page.getByRole("region", {
        name: "Виконані нагадування",
        exact: true,
      });
    await pending
      .getByRole("article", { name: recurring.title, exact: true })
      .waitFor();
    await responsive("list");
    await page
      .getByRole("link", { name: "До догляду за твариною", exact: true })
      .click();
    await page.waitForURL("**/care");
    await page
      .locator(".pet-care-grid")
      .getByRole("article", { name: recurring.title, exact: true })
      .first()
      .waitFor();
    pass(
      "A/H: owner creates weekly reminder with local Kyiv→UTC roundtrip; failed create preserves draft; confirmed save appears on dashboard/list;375/768/1440 form/list/dashboard",
    );
    await go(page, path);
    const recurringCard = pending.getByRole("article", {
      name: recurring.title,
      exact: true,
    });
    await recurringCard
      .getByRole("button", { name: "Виконано", exact: true })
      .click();
    await completed
      .getByRole("article", { name: recurring.title, exact: true })
      .waitFor();
    const occurrences = await db.petReminder.findMany({
      where: { seriesId: recurring.seriesId },
      orderBy: { dueAt: "asc" },
    });
    assert.equal(occurrences.length, 2);
    assert.equal(occurrences[0].status, "COMPLETED");
    assert.equal(occurrences[1].status, "PENDING");
    assert.equal(
      occurrences[1].dueAt.toISOString(),
      "2027-01-27T07:30:00.000Z",
    );
    assert.equal(
      await pending
        .getByRole("article", { name: recurring.title, exact: true })
        .count(),
      1,
    );
    assert.equal(
      await completed
        .getByRole("article", { name: recurring.title, exact: true })
        .getByRole("button", { name: "Редагувати", exact: true })
        .count(),
      0,
    );
    pass(
      "B: completion preserves original occurrence and creates exactly one weekly successor, completed records have no edit/reopen",
    );
    const overdueCard = pending.getByRole("article", {
      name: expired.title,
      exact: true,
    });
    await overdueCard.getByText("Прострочено", { exact: true }).waitFor();
    assert.ok(!(await overdueCard.innerText()).includes("небезпека"));
    pass("C: derived overdue has restrained text status without medical claim");
    await overdueCard
      .getByRole("button", { name: "Редагувати", exact: true })
      .click();
    const edit = page.getByRole("dialog", {
      name: "Редагувати нагадування",
      exact: true,
    });
    await edit
      .getByLabel("Назва", { exact: true })
      .fill("Перенесена подія PRIVATE_12B");
    await edit.getByLabel("Дата", { exact: true }).fill("2027-02-15");
    await edit.getByLabel("Час", { exact: true }).fill("10:00");
    await edit.getByRole("button", { name: "Зберегти", exact: true }).click();
    await edit.waitFor({ state: "hidden" });
    const updated = pending.getByRole("article", {
      name: "Перенесена подія PRIVATE_12B",
      exact: true,
    });
    await updated.waitFor();
    assert.equal(
      await updated.getByText("Прострочено", { exact: true }).count(),
      0,
    );
    pass(
      "D: editing overdue reminder into future updates title/date and removes overdue marker",
    );
    const deleteTrigger = updated.getByRole("button", {
      name: "Видалити",
      exact: true,
    });
    await deleteTrigger.click();
    let del = page.getByRole("dialog", {
      name: "Видалити нагадування?",
      exact: true,
    });
    await del.waitFor();
    await page.keyboard.press("Escape");
    await del.waitFor({ state: "hidden" });
    assert.equal(
      await deleteTrigger.evaluate((el) => el === document.activeElement),
      true,
    );
    await deleteTrigger.click();
    del = page.getByRole("dialog", {
      name: "Видалити нагадування?",
      exact: true,
    });
    await del
      .getByText("Цю дію не можна скасувати.", { exact: true })
      .waitFor();
    await del
      .getByRole("button", { name: "Видалити нагадування", exact: true })
      .click();
    await del.waitFor({ state: "hidden" });
    await updated.waitFor({ state: "detached" });
    assert.equal(
      await db.petReminder.findUnique({ where: { id: expired.id } }),
      null,
    );
    pass(
      "E: explicit occurrence-only delete confirmation, Escape and return focus, confirmed removal",
    );
    await login(otherPage, other, password);
    await go(otherPage, path);
    await otherPage
      .getByText("Тварину не знайдено або у вас немає доступу.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await otherPage.getByText(recurring.title, { exact: true }).count(),
      0,
    );
    pass(
      "G: non-owner direct route conceals reminder data; backend tests cover all API verbs/ADMIN/BREEDER",
    );
    // Open an unsaved draft before session transition.
    await page
      .getByRole("button", { name: "Додати нагадування", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Назва", { exact: true })
      .fill("UNSAVED_PRIVATE_12B");
    const logoutPage = await context.newPage();
    await go(logoutPage, "/account");
    await logoutPage
      .getByRole("button", { name: "Вийти з акаунта", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname === "/login");
    await logoutPage.close();
    await login(page, other, password);
    await go(page, "/pets/" + otherPet.id + "/care/reminders");
    await page.getByText("Нагадувань ще немає", { exact: true }).waitFor();
    assert.ok(
      !(await page.locator("main").innerText()).includes("PRIVATE_12B_A"),
    );
    assert.equal(
      await page.getByText(recurring.title, { exact: true }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "Додати нагадування", exact: true })
      .click();
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
      .getByText("Тварину не знайдено або у вас немає доступу.", {
        exact: true,
      })
      .waitFor();
    pass(
      "F: A logout → B own empty list/create draft → A denial; no previous-account rows/drafts",
    );
    assert.deepEqual(errors, []);
    pass(
      "no runtime/hydration errors or native select; public/private boundaries preserved",
    );
  }
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
    "test-results/phase12b-browser.json",
    JSON.stringify({ checks, errors, failed: failed?.message }, null, 2),
  );
}
