import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  userContext = await browser.newContext(),
  adminContext = await browser.newContext(),
  ownerContext = await browser.newContext();
const page = await userContext.newPage(),
  adminPage = await adminContext.newPage(),
  ownerPage = await ownerContext.newPage();
const checks = [],
  errors = [],
  requests = [];
for (const p of [page, adminPage, ownerPage])
  p.on("pageerror", (e) => errors.push(e.message));
adminPage.on("request", (r) => {
  if (r.method() !== "OPTIONS" && r.url().includes("/api/v1/admin/reports"))
    requests.push({ url: r.url(), method: r.method() });
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
let f,
  fixtureIds = [],
  reportIds = [],
  beforeReports;
async function go(p, path) {
  await p.goto("http://localhost:3000" + path);
  await p.waitForLoadState("networkidle");
}
async function login(p, actor) {
  await go(p, "/login");
  await p
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await p.getByLabel("Пароль", { exact: true }).fill(f.password);
  await p.getByRole("button", { name: "Увійти", exact: true }).click();
  await p.waitForURL("**/account");
  await p.waitForLoadState("networkidle");
}
async function report(p, targetId, type) {
  await p
    .getByRole("button", { name: "Поскаржитися", exact: true })
    .first()
    .click();
  const dialog = p.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("combobox", { name: "Причина скарги" }).click();
  await dialog.getByRole("option", { name: "Інше", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Надіслати скаргу", exact: true })
    .click();
  await dialog.getByRole("alert").waitFor();
  await dialog
    .getByRole("textbox")
    .fill("Детальна скарга для перевірки адміністратором.");
  await dialog
    .getByRole("button", { name: "Надіслати скаргу", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await p
    .getByRole("button", { name: "Скаргу надіслано", exact: true })
    .first()
    .waitFor();
  const row = await f.db.report.findFirstOrThrow({
    where: {
      reporterId: f.full.user.id,
      targetId,
      targetType: type,
      status: "OPEN",
    },
  });
  reportIds.push(row.id);
  return row;
}
async function responsive(p, label, dialog = false) {
  for (const width of [375, 768, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      label + " overflow " + width,
    );
    assert.equal(await p.locator("select").count(), 0);
    if (dialog) {
      const b = await p.getByRole("dialog").boundingBox();
      assert.ok(b.x >= 15 && b.x + b.width <= width - 15);
      const boxes = await p
        .getByRole("dialog")
        .locator("button:visible")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().height),
        );
      assert.ok(boxes.every((h) => h >= 43.5));
    }
    await p.screenshot({
      path: "test-results/phase10d-" + label + "-" + width + ".png",
    });
    pass(label + " " + width);
  }
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  fixtureIds = [
    f.seller.user.id,
    f.full.user.id,
    f.fallback.user.id,
    f.empty.user.id,
  ];
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
  const listing = await f.db.listing.create({
    data: {
      sellerId: f.seller.user.id,
      petId: pet.id,
      locationId: f.location.id,
      type: "FREE",
      title: "UI Скарга на оголошення",
      description: "Публічний опис для тестування скарги.",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  const review = await f.db.review.create({
    data: {
      authorId: f.seller.user.id,
      targetUserId: f.full.user.id,
      rating: 4,
      text: "UI Відгук для перевірки скарг користувачів.",
      status: "APPROVED",
    },
  });
  await go(
    page,
    "/listings/" + listing.id + "?returnTo=%2Flistings%3Fpage%3D2",
  );
  await page.getByRole("button", { name: "Поскаржитися", exact: true }).click();
  await page.waitForURL(/\/login\?/);
  assert.equal(
    new URL(page.url()).searchParams.get("returnTo"),
    "/listings/" + listing.id + "?returnTo=%2Flistings%3Fpage%3D2",
  );
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.full.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/listings/" + listing.id);
  await page.waitForLoadState("networkidle");
  pass("anonymous login returns to exact public detail context");
  await page.getByRole("button", { name: "Поскаржитися", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByRole("combobox", { name: "Причина скарги" })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Надіслати скаргу" })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await dialog
      .getByRole("combobox")
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await dialog.getByRole("combobox").press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(
    await dialog.getByRole("combobox").getAttribute("data-value"),
    "SCAM",
  );
  await responsive(page, "report-dialog", true);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  pass("dialog dropdown keyboard/trap/Escape/return focus");
  const listingReport = await report(page, listing.id, "LISTING");
  pass("A foreign public Listing report succeeds and disables action");
  await go(page, "/mating/" + f.active.id);
  const matingReport = await report(page, f.active.id, "MATING_LISTING");
  pass("B foreign public Mating report succeeds");
  await go(page, "/sellers/" + f.full.user.id);
  await page.locator(".public-reviews .report-action").waitFor();
  const reviewReport = await report(page, review.id, "REVIEW");
  pass("C approved Review report succeeds");
  await login(ownerPage, f.seller);
  await go(ownerPage, "/listings/" + listing.id);
  assert.equal(
    await ownerPage
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .count(),
    0,
  );
  await go(ownerPage, "/mating/" + f.active.id);
  assert.equal(
    await ownerPage
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .count(),
    0,
  );
  await go(ownerPage, "/sellers/" + f.full.user.id);
  assert.equal(
    await ownerPage
      .locator(".public-reviews")
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .count(),
    0,
  );
  pass("own Listing/Mating/Review report actions hidden");
  await login(adminPage, f.empty);
  requests.length = 0;
  await go(adminPage, "/admin/moderation/reports");
  await adminPage.locator(".admin-card-link").first().waitFor();
  assert.equal(requests.filter((r) => r.method === "GET").length, 1);
  await responsive(adminPage, "reports-queue");
  pass("one bounded queue request and no per-card detail fetch");
  await adminPage.getByRole("combobox", { name: "Тип матеріалу" }).click();
  await adminPage
    .getByRole("option", { name: "Оголошення", exact: true })
    .click();
  await adminPage.waitForURL(/type=LISTING/);
  await adminPage.reload();
  await adminPage.locator(".admin-card-link").first().waitFor();
  assert.equal(new URL(adminPage.url()).searchParams.get("type"), "LISTING");
  pass("reports filters survive refresh");
  const reportPath =
    "/admin/moderation/reports/" +
    listingReport.id +
    "?returnTo=%2Fadmin%2Fmoderation%2Freports%3Ftype%3DLISTING";
  await go(adminPage, reportPath);
  await adminPage
    .getByRole("heading", { name: "Опрацювання скарги" })
    .waitFor();
  await responsive(adminPage, "report-detail");
  await adminPage
    .getByRole("link", { name: "Відкрити модерацію матеріалу" })
    .click();
  await adminPage
    .getByRole("button", { name: "Приховати", exact: true })
    .waitFor();
  await adminPage
    .getByRole("button", { name: "Приховати", exact: true })
    .click();
  const hide = adminPage.getByRole("dialog");
  await hide
    .getByRole("textbox")
    .fill("Матеріал приховано після окремої перевірки.");
  await hide.getByRole("button", { name: "Приховати", exact: true }).click();
  await hide.waitFor({ state: "hidden" });
  await adminPage.getByRole("link", { name: "Повернутися до скарги" }).click();
  await adminPage
    .getByRole("heading", { name: "Опрацювання скарги" })
    .waitFor();
  assert.equal(
    new URL(adminPage.url()).pathname,
    "/admin/moderation/reports/" + listingReport.id,
  );
  await adminPage
    .locator(".admin-panel")
    .filter({
      has: adminPage.getByRole("heading", { name: "Матеріал", exact: true }),
    })
    .getByText("Приховано", { exact: true })
    .waitFor();
  await adminPage
    .getByLabel("Примітка до рішення")
    .fill("Контент перевірено та приховано окремим рішенням.");
  await adminPage
    .getByRole("button", { name: "Опрацювати", exact: true })
    .click();
  await adminPage.getByText("Скаргу опрацьовано.", { exact: true }).waitFor();
  assert.equal(
    (await f.db.report.findUnique({ where: { id: listingReport.id } })).status,
    "RESOLVED",
  );
  pass("D report→moderation hide→durable report return→resolve");
  await go(adminPage, "/admin/moderation/reports/" + matingReport.id);
  await adminPage
    .getByLabel("Примітка до рішення")
    .fill("Підстав для цієї скарги не знайдено.");
  await adminPage
    .getByRole("button", { name: "Відхилити скаргу", exact: true })
    .click();
  await adminPage.getByText("Скаргу відхилено.", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: f.active.id } }))
      .moderationStatus,
    "APPROVED",
  );
  pass("E dismiss retains report and leaves target unchanged");
  await go(adminPage, "/admin/moderation/reports/" + reviewReport.id);
  await f.db.review.delete({ where: { id: review.id } });
  await adminPage.reload();
  await adminPage
    .getByText("Матеріал видалено або недоступний. Скаргу збережено.", {
      exact: true,
    })
    .waitFor();
  pass("deleted target retains report snapshot");
  await go(page, "/admin/moderation/reports");
  await page
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(await page.locator(".admin-card-link").count(), 0);
  await go(page, "/admin/moderation/reports/" + listingReport.id);
  await page
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  pass("F normal USER/BREEDER cannot access reports queue/detail");
  await f.db.user.update({
    where: { id: f.empty.user.id },
    data: { role: "USER" },
  });
  await go(adminPage, "/admin/moderation/reports");
  await adminPage
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(await adminPage.locator(".admin-card-link").count(), 0);
  pass("role loss hides admin report content");
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase10d-browser.json",
    JSON.stringify({ checks, errors, requests }, null, 2),
  );
} catch (e) {
  await page.screenshot({ path: "test-results/phase10d-failure.png" });
  console.error("BROWSER FAILURE", page.url(), adminPage.url(), e);
  throw e;
} finally {
  await browser.close();
  if (f) {
    await f.db.report.deleteMany({ where: { reporterId: { in: fixtureIds } } });
    await f.db.review.deleteMany({
      where: {
        OR: [
          { authorId: { in: fixtureIds } },
          { targetUserId: { in: fixtureIds } },
        ],
      },
    });
    if (beforeReports)
      assert.deepEqual(
        await f.db.report.findMany({ orderBy: { id: "asc" } }),
        beforeReports,
      );
    await f.cleanup();
  }
}
