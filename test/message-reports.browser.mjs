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
const url = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.pathname === "/pet_platform",
);
const { PrismaService } =
  await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  browser = await chromium.launch({ channel: "msedge", headless: true });
const buyerContext = await browser.newContext(),
  sellerContext = await browser.newContext(),
  adminContext = await browser.newContext();
const buyerPage = await buyerContext.newPage(),
  sellerPage = await sellerContext.newPage(),
  adminPage = await adminContext.newPage();
const checks = [],
  errors = [],
  requests = [],
  users = [];
let conversation, reportId;
for (const page of [buyerPage, sellerPage, adminPage])
  page.on("pageerror", (e) => errors.push(e.message));
adminPage.on("request", (r) => {
  if (r.method() === "GET" && r.url().includes("/api/v1/admin/reports"))
    requests.push(r.url());
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (page, path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
async function login(page, user, password) {
  await go(page, "/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
}
async function until(work, label) {
  const end = Date.now() + 15000;
  while (!(await work())) {
    if (Date.now() > end) throw Error(label);
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function responsive(page, label, dialog = false) {
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
    if (dialog) {
      const box = await page.getByRole("dialog").boundingBox();
      assert.ok(box.x >= 15 && box.x + box.width <= width - 15);
      assert.ok(
        await page
          .getByRole("dialog")
          .locator("button:visible")
          .evaluateAll((nodes) =>
            nodes.every((n) => n.getBoundingClientRect().height >= 43.5),
          ),
      );
    }
    await page.screenshot({
      path: `test-results/phase11f-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const [firstName, role] of [
    ["Покупець", "USER"],
    ["Продавець", "USER"],
    ["Модератор", "ADMIN"],
  ])
    users.push(
      await db.user.create({
        data: {
          email: "message-report-browser-" + randomUUID() + "@example.invalid",
          firstName,
          lastName: "Фікстура",
          passwordHash,
          role,
        },
      }),
    );
  const [buyer, seller, admin] = users;
  conversation = await db.conversation.create({
    data: {
      listingKey: randomUUID(),
      buyerId: buyer.id,
      sellerId: seller.id,
      listingTitleSnapshot: "PRIVATE_PHASE11F_LISTING",
      breedNameSnapshot: "Порода",
    },
  });
  await db.message.createMany({
    data: Array.from({ length: 45 }, (_, i) => ({
      id: randomUUID(),
      conversationId: conversation.id,
      senderId: i % 2 ? buyer.id : seller.id,
      text: "Історія " + i,
      createdAt: new Date(Date.now() - 3600000 + i * 1000),
    })),
  });
  await login(sellerPage, seller, password);
  await login(buyerPage, buyer, password);
  await login(adminPage, admin, password);
  await go(sellerPage, "/messages/" + conversation.id);
  await sellerPage
    .getByRole("textbox", { name: "Повідомлення", exact: true })
    .fill("PRIVATE_PHASE11F_REPORTED <script>safe text</script>");
  await sellerPage
    .locator(".message-composer")
    .evaluate((form) => form.requestSubmit());
  await until(
    () =>
      db.message.findFirst({
        where: {
          conversationId: conversation.id,
          text: { startsWith: "PRIVATE_PHASE11F_REPORTED" },
        },
      }),
    "seller message not committed",
  );
  const message = await db.message.findFirstOrThrow({
    where: {
      conversationId: conversation.id,
      text: { startsWith: "PRIVATE_PHASE11F_REPORTED" },
    },
  });
  await go(buyerPage, "/messages/" + conversation.id);
  const bubble = buyerPage.locator(`[data-message-id="${message.id}"]`),
    summary = bubble.locator("summary");
  await summary.waitFor();
  assert.equal(
    await buyerPage.locator(".message-bubble.is-own summary").count(),
    0,
  );
  const actionBox = await summary.boundingBox();
  assert.ok(actionBox.width >= 44 && actionBox.height >= 44);
  await summary.focus();
  await buyerPage.keyboard.press("Enter");
  await bubble
    .getByRole("button", { name: "Поскаржитися", exact: true })
    .click();
  let dialog = buyerPage.getByRole("dialog");
  await dialog.waitFor();
  await buyerPage.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await summary.evaluate((el) => el === document.activeElement),
    true,
  );
  await bubble
    .getByRole("button", { name: "Поскаржитися", exact: true })
    .click();
  await dialog.waitFor();
  await buyerPage.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await responsive(buyerPage, "report-dialog", true);
  await dialog.getByRole("combobox", { name: "Причина скарги" }).click();
  await dialog.getByRole("option", { name: "Інше", exact: true }).click();
  await dialog
    .getByRole("textbox")
    .fill("Перевірка скарги на конкретне повідомлення.");
  await dialog
    .getByRole("button", { name: "Надіслати скаргу", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await bubble.getByText("Скаргу надіслано.", { exact: true }).waitFor();
  const report = await db.report.findFirstOrThrow({
    where: {
      reporterId: buyer.id,
      targetType: "MESSAGE",
      targetId: message.id,
    },
  });
  reportId = report.id;
  assert.equal(report.reason, "OTHER");
  assert.equal(
    await summary.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(
    await db.notification.count({ where: { userId: seller.id } }),
    0,
  );
  pass(
    "A: real seller send → buyer SVG action → reused dialog; keyboard/Escape/focus return,375/768/1440, successful MESSAGE report, no sender notification",
  );
  await go(buyerPage, "/messages/" + conversation.id);
  await buyerPage.locator(`[data-message-id="${message.id}"] summary`).click();
  await buyerPage
    .locator(`[data-message-id="${message.id}"]`)
    .getByRole("button", { name: "Поскаржитися", exact: true })
    .click();
  await buyerPage
    .getByRole("dialog")
    .getByRole("button", { name: "Надіслати скаргу", exact: true })
    .click();
  await buyerPage.getByRole("dialog").waitFor({ state: "hidden" });
  await buyerPage
    .locator(`[data-message-id="${message.id}"]`)
    .getByText("Скаргу надіслано.", { exact: true })
    .waitFor();
  assert.equal(
    await db.report.count({
      where: { reporterId: buyer.id, targetId: message.id, status: "OPEN" },
    }),
    1,
  );
  pass(
    "duplicate OPEN409 handled after reload; chat and message remain available",
  );
  await go(adminPage, "/admin/moderation/reports");
  await adminPage.getByRole("combobox", { name: "Тип матеріалу" }).click();
  await adminPage
    .getByRole("option", { name: "Повідомлення", exact: true })
    .click();
  await adminPage.waitForURL("**/reports?type=MESSAGE");
  const card = adminPage.locator(`a[href*="/reports/${reportId}?"]`);
  await card.waitFor();
  assert.ok((await card.textContent()).includes("PRIVATE_PHASE11F_REPORTED"));
  assert.equal(requests.filter((u) => u.includes("/conversation")).length, 0);
  await card.click();
  await adminPage
    .getByText("Повідомлення, на яке поскаржилися", { exact: true })
    .waitFor();
  assert.ok(
    (await adminPage.locator(".report-context-messages li").count()) <= 21,
  );
  assert.equal(
    await db.moderatorConversationAccess.count({ where: { reportId } }),
    0,
  );
  await responsive(adminPage, "report-detail");
  pass(
    "B: existing admin queue MESSAGE filter/snapshot; bounded detail and highlighted exact text; no queue/history fanout or access log; responsive375/768/1440",
  );
  await adminPage
    .getByRole("link", { name: "Переглянути контекст розмови", exact: true })
    .click();
  const view = adminPage.getByRole("region", {
    name: "Приватний контекст розмови",
  });
  await view.waitFor();
  await until(
    () => db.moderatorConversationAccess.count({ where: { reportId } }),
    "explicit access not audited",
  );
  assert.equal(await view.locator("li").count(), 20);
  await adminPage
    .getByText("Повідомлення, на яке поскаржилися", { exact: true })
    .first()
    .waitFor();
  await responsive(adminPage, "full-context");
  // Trigger a privileged next-page request after live role loss.
  await db.user.update({ where: { id: admin.id }, data: { role: "USER" } });
  await view.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await adminPage
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(await adminPage.locator(".report-context-messages").count(), 0);
  await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
  await adminPage.getByRole("button", { name: "Перевірити доступ" }).click();
  await view.waitFor();
  await view.focus();
  await adminPage.keyboard.press("Home");
  await view.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await until(
    async () => (await view.locator("li").count()) >= 40,
    "older context not loaded",
  );
  await view.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await until(
    async () => (await view.locator("li").count()) === 46,
    "first messages unreachable",
  );
  const audit = await db.moderatorConversationAccess.findMany({
    where: { reportId },
  });
  assert.ok(audit.length >= 4);
  assert.ok(
    audit.every(
      (a) => a.moderatorId === admin.id && a.conversationId === conversation.id,
    ),
  );
  pass(
    "C: explicit report-scoped20/page context; audit; scroll older history to first message; reported message identifiable; role loss403 removes private context, restored ADMIN can reauthorize",
  );
  await go(
    buyerPage,
    "/admin/moderation/reports/" + reportId + "/conversation",
  );
  await buyerPage
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(
    await buyerPage
      .getByText("PRIVATE_PHASE11F_LISTING", { exact: true })
      .count(),
    0,
  );
  assert.equal(await buyerPage.locator(".report-context-messages").count(), 0);
  pass("D: direct normal USER context URL denied without private content");
  await go(adminPage, "/account");
  await adminPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await adminPage.waitForURL("**/login");
  await login(adminPage, seller, password);
  await go(
    adminPage,
    "/admin/moderation/reports/" + reportId + "/conversation",
  );
  await adminPage
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(await adminPage.locator(".report-context-messages").count(), 0);
  assert.equal(
    await adminPage
      .getByText("PRIVATE_PHASE11F_REPORTED <script>safe text</script>", {
        exact: true,
      })
      .count(),
    0,
  );
  pass("E: ADMIN logout → USER login, private moderation context absent");
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors or native selects");
} finally {
  await buyerContext.close();
  await sellerContext.close();
  await adminContext.close();
  await browser.close();
  const ids = users.map((u) => u.id);
  await db.moderatorConversationAccess.deleteMany({
    where: { moderatorId: { in: ids } },
  });
  await db.report.deleteMany({ where: { reporterId: { in: ids } } });
  if (conversation)
    await db.conversation.deleteMany({ where: { id: conversation.id } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase11f-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
