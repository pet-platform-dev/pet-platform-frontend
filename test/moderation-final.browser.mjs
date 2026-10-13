import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext(),
  page = await context.newPage();
const checks = [],
  errors = [],
  requests = [];
let f,
  ids = [],
  beforeReports;
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.method() !== "OPTIONS" && r.url().includes("/api/v1/admin/"))
    requests.push({ url: r.url(), method: r.method() });
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function go(path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
async function login(actor) {
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
}
async function geometry(label, dialog = false) {
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
    const scope = dialog
      ? page.getByRole("dialog")
      : page.locator(".admin-moderation");
    const boxes = await scope
      .locator("button:visible,a.button:visible,.admin-card-link:visible")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          h: n.getBoundingClientRect().height,
          w: n.getBoundingClientRect().width,
        })),
      );
    assert.ok(
      boxes.every((b) => b.h >= 43.5 && b.w >= 43.5),
      label + " targets " + width,
    );
    if (dialog) {
      const b = await scope.boundingBox();
      assert.ok(b.x >= 15 && b.x + b.width <= width - 15);
    }
    if (process.env.PHASE10F_SCENARIO === "fallback") {
      const fallback = scope.locator(".gallery-open .muted");
      await fallback.waitFor();
      const text = await fallback.boundingBox();
      const counter = await scope
        .locator(".gallery-counter:visible")
        .first()
        .boundingBox();
      assert.ok(
        text.y + text.height + 4 <= counter.y,
        label + " readable fallback " + width,
      );
    }
    await page.screenshot({
      path: "test-results/phase10f-" + label + "-" + width + ".png",
    });
  }
  pass(label + " fits375/768/1440;44px;no overflow/native select");
}
async function reasonDialog(name, label) {
  const trigger = page.getByRole("button", { name, exact: true });
  await trigger.click();
  const d = page.getByRole("dialog");
  await d.waitFor();
  await d
    .getByRole("textbox")
    .fill("Тестова причина для перевірки доступності.");
  await geometry(label, true);
  await d.getByRole("textbox").focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await d
      .getByRole("button", { name, exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await d.waitFor({ state: "hidden" });
  assert.equal(
    await trigger.evaluate((n) => n === document.activeElement),
    true,
  );
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  ids = [f.seller.user.id, f.full.user.id, f.fallback.user.id, f.empty.user.id];
  beforeReports = await f.db.report.findMany({ orderBy: { id: "asc" } });
  await f.db.user.update({
    where: { id: f.empty.user.id },
    data: { role: "ADMIN" },
  });
  const pet = await f.db.pet.create({
    data: {
      ownerId: f.seller.user.id,
      speciesId: f.breeds[0].speciesId,
      breedId: f.breeds[0].id,
      gender: "MALE",
    },
  });
  const pending = await f.db.listing.create({
    data: {
      sellerId: f.seller.user.id,
      petId: pet.id,
      locationId: f.location.id,
      type: "FREE",
      title: "10F Queue inspection",
      description: "10F PRIVATE INSPECTED CONTENT",
      moderationStatus: "PENDING",
      updatedAt: new Date("1980-01-01"),
      images: {
        create: {
          url: "https://res.cloudinary.com/fixture/image/upload/sample.jpg",
        },
      },
    },
  });
  const approved = await f.db.listing.create({
    data: {
      sellerId: f.seller.user.id,
      petId: f.known.id,
      locationId: f.location.id,
      type: "FREE",
      title: "10F Public report target",
      description: "Публічний контент для перевірки діалогу.",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
      images: {
        create: {
          url: "https://res.cloudinary.com/fixture/image/upload/sample.jpg",
        },
      },
    },
  });
  const report = await f.db.report.create({
    data: {
      reporterId: f.full.user.id,
      reporterName: "Заявник",
      targetType: "LISTING",
      targetId: approved.id,
      targetPreview: "10F Report inspection",
      details: "10F REPORT PRIVATE DETAILS",
      reason: "SPAM",
      createdAt: new Date("1980-01-01"),
    },
  });
  await login(f.empty);
  if (process.env.PHASE10F_SCENARIO === "fallback") {
    await go("/admin/moderation/listings/" + approved.id);
    await page.locator(".admin-detail-sidebar").waitFor();
    await geometry("moderation-fallback");
    await go("/admin/moderation/reports/" + report.id);
    await page.getByRole("heading", { name: "Опрацювання скарги" }).waitFor();
    await geometry("report-fallback");
  } else {
    const nav = page.locator(".dashboard-card").filter({
      has: page.getByRole("heading", { name: "Модерація", exact: true }),
    });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const a = await nav
          .getByRole("link", { name: "Модерація", exact: true })
          .boundingBox(),
        b = await nav
          .getByRole("link", { name: "Скарги", exact: true })
          .boundingBox();
      assert.ok(b.x - a.x - a.width >= 9 || b.y - a.y - a.height >= 9);
    }
    pass("admin account actions have existing responsive spacing");
    requests.length = 0;
    await go("/admin/moderation");
    await page
      .locator(".admin-card-link")
      .filter({ hasText: pending.title })
      .waitFor();
    assert.equal(requests.filter((r) => r.method === "GET").length, 1);
    await geometry("moderation-queue");
    await page
      .locator(".admin-card-link")
      .filter({ hasText: pending.title })
      .click();
    await page.locator(".admin-detail-sidebar").waitFor();
    await geometry("moderation-detail");
    await reasonDialog("Відхилити", "reject-dialog");
    await page.getByRole("link", { name: "Повернутися до черги" }).click();
    await page.waitForURL("**/admin/moderation");
    pass(
      "A queue→detail→safe return;one bounded queue request,no card detail prefetch",
    );
    await go("/admin/moderation/reports");
    await page
      .locator(".admin-card-link")
      .filter({ hasText: "10F Report inspection" })
      .waitFor();
    await geometry("report-queue");
    await page
      .locator(".admin-card-link")
      .filter({ hasText: "10F Report inspection" })
      .getByText("Відкрита", { exact: true })
      .waitFor();
    await page
      .locator(".admin-card-link")
      .filter({ hasText: "10F Report inspection" })
      .click();
    await page.getByRole("heading", { name: "Опрацювання скарги" }).waitFor();
    await geometry("report-detail");
    await page.getByRole("link", { name: "Повернутися до скарг" }).click();
    await page.waitForURL("**/admin/moderation/reports");
    pass("B separate report queue/detail return and singular status copy");
    await go("/admin/moderation/listings/" + approved.id);
    await page.locator(".admin-detail-sidebar").waitFor();
    await reasonDialog("Приховати", "hide-dialog");
    await go("/admin/moderation/listings/" + pending.id);
    await page.locator(".admin-detail-sidebar").waitFor();
    await f.db.listing.update({
      where: { id: pending.id },
      data: { description: "10F PRIVATE OWNER CHANGED CONTENT" },
    });
    const before = requests.filter((r) => r.method === "POST").length;
    await page.getByRole("button", { name: "Схвалити", exact: true }).click();
    await page.locator(".admin-conflict").waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Схвалити", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      requests.filter((r) => r.method === "POST").length,
      before + 1,
    );
    await page
      .locator(".admin-conflict")
      .getByRole("button", { name: "Оновити", exact: true })
      .click();
    await page
      .getByText("Дані оновлено. Перегляньте зміст перед новим рішенням.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      (await f.db.listing.findUnique({ where: { id: pending.id } }))
        .moderationStatus,
      "PENDING",
    );
    pass(
      "D stale409 locks actions and explicit refresh never replays approval",
    );
    await f.db.user.update({
      where: { id: f.empty.user.id },
      data: { role: "USER" },
    });
    await page.getByRole("button", { name: "Схвалити", exact: true }).click();
    await page
      .getByRole("heading", { name: "Доступ до модерації недоступний" })
      .waitFor();
    assert.equal(await page.locator(".admin-detail-sidebar").count(), 0);
    assert.doesNotMatch(await page.locator("body").innerText(), /10F PRIVATE/);
    await go("/account");
    assert.equal(
      await page.getByRole("link", { name: "Модерація", exact: true }).count(),
      0,
    );
    pass(
      "role loss next privileged403 clears data/actions and admin navigation",
    );
    await page
      .getByRole("button", { name: "Вийти з акаунта", exact: true })
      .click();
    await page.waitForLoadState("networkidle");
    await login(f.full);
    assert.equal(
      await page.getByRole("link", { name: "Модерація", exact: true }).count(),
      0,
    );
    const afterLogin = requests.length;
    for (const path of [
      "/admin/moderation",
      "/admin/moderation/listings/" + pending.id,
      "/admin/moderation/reports",
      "/admin/moderation/reports/" + report.id,
    ]) {
      await go(path);
      await page
        .getByRole("heading", { name: "Доступ до модерації недоступний" })
        .waitFor();
      assert.doesNotMatch(
        await page.content(),
        /10F PRIVATE|10F REPORT PRIVATE/,
      );
    }
    assert.equal(requests.length, afterLogin);
    pass(
      "C former ADMIN logout→normal BREEDER login:queue/detail/report/navigation absent,no privileged fetch/SSR data",
    );
    await go("/listings/" + approved.id);
    await page
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.waitFor();
    await d.getByRole("combobox", { name: "Причина скарги" }).click();
    await d.getByRole("option", { name: "Інше", exact: true }).click();
    await d.getByRole("button", { name: "Надіслати скаргу" }).click();
    await d.getByRole("alert").waitFor();
    assert.ok(await d.getByRole("textbox").getAttribute("aria-describedby"));
    await geometry("report-dialog", true);
    await page.keyboard.press("Escape");
    await d.waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("button", { name: "Поскаржитися", exact: true })
        .evaluate((n) => n === document.activeElement),
      true,
    );
    pass(
      "E public report dialog labelled custom dropdown/error association/Escape/focus return",
    );
  }
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    process.env.PHASE10F_SCENARIO === "fallback"
      ? "test-results/phase10f-fallback.json"
      : "test-results/phase10f-browser.json",
    JSON.stringify({ checks, errors, requests }, null, 2),
  );
} catch (e) {
  console.error("BROWSER FAILURE", page.url(), e);
  await page.screenshot({ path: "test-results/phase10f-failure.png" });
  throw e;
} finally {
  await browser.close();
  if (f) {
    await f.db.report.deleteMany({ where: { reporterId: { in: ids } } });
    if (beforeReports)
      assert.deepEqual(
        await f.db.report.findMany({ orderBy: { id: "asc" } }),
        beforeReports,
      );
    await f.cleanup();
  }
}
