// One focused Phase11G finalization run; no historical moderation journeys.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const { ConversationsService } =
  await import("../../pet-platform-backend/dist/src/conversations/conversations.service.js");
const { NotificationsService } =
  await import("../../pet-platform-backend/dist/src/notifications/notifications.service.js");
const { ReportsService } =
  await import("../../pet-platform-backend/dist/src/reports/reports.service.js");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  service = new ConversationsService(db, new NotificationsService(db));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const contexts = await Promise.all([
  browser.newContext(),
  browser.newContext(),
  browser.newContext(),
]);
const [userPage, sellerPage, adminPage] = await Promise.all(
  contexts.map((c) => c.newPage()),
);
const users = [],
  conversations = [],
  checks = [],
  errors = [];
let documentSockets = [];
const resumeSession = process.env.PHASE11G_RESUME === "session";
if (resumeSession)
  checks.push(
    ...JSON.parse(await readFile("test-results/phase11g-browser.json", "utf8"))
      .checks,
  );
for (const p of [userPage, sellerPage, adminPage])
  p.on("pageerror", (e) => errors.push(e.message));
await userPage.routeWebSocket(/\/socket\.io\//, (ws) => {
  // Pass through the real connection. Track the current document's transport;
  // lifetime Page websocket close events can be lost on full document teardown.
  const item = { closed: false },
    server = ws.connectToServer();
  documentSockets.push(item);
  ws.onClose(() => {
    item.closed = true;
    void server.close();
  });
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (p, path) => {
  if (p === userPage) documentSockets = [];
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
async function until(check, label) {
  const end = Date.now() + 15000;
  while (!(await check())) {
    if (Date.now() > end) throw Error(label);
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function badges(p, messages, notifications) {
  await p
    .getByRole("link", {
      name: messages
        ? `Повідомлення, непрочитаних: ${messages}`
        : "Повідомлення",
      exact: true,
    })
    .waitFor();
  await p
    .getByRole("button", {
      name: notifications
        ? `Сповіщення, непрочитаних: ${notifications}`
        : "Сповіщення",
      exact: true,
    })
    .waitFor();
}
async function send(p, text) {
  await p
    .getByRole("textbox", { name: "Повідомлення", exact: true })
    .fill(text);
  await p.locator(".message-composer").evaluate((form) => form.requestSubmit());
  await until(
    async () =>
      (await p
        .getByRole("textbox", { name: "Повідомлення", exact: true })
        .inputValue()) === "",
    "send pending",
  );
}
async function responsive(p, label) {
  for (const width of [375, 768, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      label + " overflow " + width,
    );
    assert.equal(await p.locator("select").count(), 0);
    await p.screenshot({
      path: `test-results/phase11g-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
let reportId;
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const [firstName, role] of [
    ["Покупець", "USER"],
    ["Продавець", "USER"],
    ["Адміністратор", "ADMIN"],
    ["Інший", "USER"],
  ])
    users.push(
      await db.user.create({
        data: {
          email: "messaging-final-" + randomUUID() + "@example.invalid",
          passwordHash,
          firstName,
          lastName: "Фікстура",
          role,
        },
      }),
    );
  const [buyer, seller, admin, other] = users;
  for (const title of [
    "PRIVATE_11G_A довга назва оголошення для перевірки перенесення",
    "PRIVATE_11G_B",
  ])
    conversations.push(
      await db.conversation.create({
        data: {
          listingKey: randomUUID(),
          buyerId: buyer.id,
          sellerId: seller.id,
          listingTitleSnapshot: title,
          breedNameSnapshot: "Порода",
        },
      }),
    );
  const [a, b] = conversations;
  await service.send(seller.id, a.id, { text: "PRIVATE_11G_A_ONE" });
  await service.send(seller.id, a.id, { text: "PRIVATE_11G_A_TWO" });
  await service.send(seller.id, b.id, { text: "PRIVATE_11G_B_ONE" });
  await login(userPage, buyer, password);
  await login(sellerPage, seller, password);
  await login(adminPage, admin, password);
  if (!resumeSession) {
    await go(userPage, "/messages");
    await userPage.bringToFront();
    await badges(userPage, 3, 3);
    assert.equal(await userPage.locator("a.conversation-card").count(), 2);
    await responsive(userPage, "inbox");
    await userPage.locator(`a[href="/messages/${a.id}"]`).click();
    await userPage.bringToFront();
    await badges(userPage, 1, 1);
    assert.equal(
      await db.message.count({
        where: { conversationId: a.id, senderId: seller.id, readAt: null },
      }),
      0,
    );
    assert.equal(
      await db.message.count({ where: { conversationId: b.id, readAt: null } }),
      1,
    );
    assert.equal(
      await db.notification.count({
        where: { userId: buyer.id, type: "NEW_MESSAGE", readAt: null },
      }),
      1,
    );
    pass(
      "B: A2+B1 unread Messages/NEW_MESSAGE → open A → both badges3→1; B untouched; inbox375/768/1440",
    );
    // An unrelated moderation/report notice must survive subsequent chat reads.
    const unrelated = await db.notification.create({
      data: {
        userId: buyer.id,
        type: "REPORT_RESOLVED",
        title: "Вашу скаргу опрацьовано",
        body: "Ваше звернення перевірено.",
        href: "/account",
      },
    });
    await send(
      userPage,
      "PRIVATE_11G_REPLY\n<script>plain text</script> " + "x".repeat(250),
    );
    const reply = await db.message.findFirstOrThrow({
      where: { conversationId: a.id, senderId: buyer.id },
    });
    await userPage.locator(`[data-message-id="${reply.id}"]`).waitFor();
    assert.equal(
      await userPage.locator(`[data-message-id="${reply.id}"]`).count(),
      1,
    );
    await go(sellerPage, "/messages/" + a.id);
    await sellerPage.bringToFront();
    await sellerPage.locator(`[data-message-id="${reply.id}"]`).waitFor();
    assert.equal(
      await sellerPage
        .locator(`[data-message-id="${reply.id}"] script`)
        .count(),
      0,
    );
    await send(sellerPage, "PRIVATE_11G_LIVE_BACKGROUND");
    const live = await db.message.findFirstOrThrow({
      where: { conversationId: a.id, text: "PRIVATE_11G_LIVE_BACKGROUND" },
    });
    await userPage.locator(`[data-message-id="${live.id}"]`).waitFor();
    assert.equal(
      (await db.message.findUniqueOrThrow({ where: { id: live.id } })).readAt,
      null,
    );
    await badges(userPage, 2, 3);
    await userPage.bringToFront();
    await badges(userPage, 1, 2);
    await until(
      async () =>
        (await db.message.findUniqueOrThrow({ where: { id: live.id } }))
          .readAt !== null,
      "visible incoming did not acknowledge",
    );
    assert.equal(
      (await db.notification.findUniqueOrThrow({ where: { id: unrelated.id } }))
        .readAt,
      null,
    );
    assert.equal(
      await userPage.locator(`[data-message-id="${live.id}"]`).count(),
      1,
    );
    const sendUrl = "**/api/v1/conversations/" + a.id + "/messages";
    await userPage.route(sendUrl, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "Fixture send failure" }),
          })
        : route.continue(),
    );
    await userPage
      .getByRole("textbox", { name: "Повідомлення", exact: true })
      .fill("PRIVATE_11G_RETRY");
    await userPage
      .locator(".message-composer")
      .evaluate((form) => form.requestSubmit());
    await userPage
      .getByText("Не вдалося надіслати повідомлення. Спробуйте ще раз.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await userPage
        .getByRole("textbox", { name: "Повідомлення", exact: true })
        .inputValue(),
      "PRIVATE_11G_RETRY",
    );
    await userPage.unroute(sendUrl);
    await userPage.locator(".message-composer").evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await until(
      async () =>
        (await userPage
          .getByRole("textbox", { name: "Повідомлення", exact: true })
          .inputValue()) === "",
      "retry failed",
    );
    assert.equal(
      await db.message.count({
        where: { conversationId: a.id, text: "PRIVATE_11G_RETRY" },
      }),
      1,
    );
    await responsive(userPage, "chat");
    await userPage
      .getByRole("button", { name: "Сповіщення, непрочитаних: 2", exact: true })
      .click();
    await userPage
      .getByRole("region", { name: "Сповіщення", exact: true })
      .waitFor();
    await responsive(userPage, "notifications");
    await userPage.keyboard.press("Escape");
    assert.equal(
      await userPage
        .locator(".notification-trigger")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    pass(
      "A: live send/reply appears once; background remains unread; foreground sync preserves unrelated notice; failure keeps draft, double submit creates1; safe multiline/unbroken text; chat/header/panel375/768/1440",
    );
    const bubble = userPage.locator(`[data-message-id="${live.id}"]`);
    const action = bubble.locator("summary");
    await action.scrollIntoViewIfNeeded();
    await action.click();
    assert.equal(
      await userPage.locator(".message-bubble.is-own summary").count(),
      0,
    );
    const actionBox = await action.boundingBox();
    assert.ok(actionBox.width >= 44 && actionBox.height >= 44);
    await bubble
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .click();
    const dialog = userPage.getByRole("dialog");
    await dialog.waitFor();
    await responsive(userPage, "report-dialog");
    await userPage.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(
      await action.evaluate((el) => el === document.activeElement),
      true,
    );
    await bubble
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Надіслати скаргу", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    reportId = (
      await db.report.findFirstOrThrow({
        where: {
          reporterId: buyer.id,
          targetType: "MESSAGE",
          targetId: live.id,
        },
      })
    ).id;
    await bubble.getByText("Скаргу надіслано.", { exact: true }).waitFor();
    pass(
      "E: other-message SVG44px action only; report dialog375/768/1440; Escape/focus return and actual successful MESSAGE report",
    );
  } else {
    // Recreate only prerequisites for failed C and unrun D; passed A/B/E are not replayed.
    await go(userPage, "/messages/" + a.id);
    await userPage.bringToFront();
    await badges(userPage, 1, 1);
    await userPage
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .click();
    await userPage
      .getByRole("region", { name: "Сповіщення", exact: true })
      .waitFor();
    await userPage.keyboard.press("Escape");
    const target = await db.message.findFirstOrThrow({
      where: { conversationId: a.id, senderId: seller.id },
    });
    reportId = (
      await new ReportsService(db).create(buyer.id, {
        targetType: "MESSAGE",
        targetId: target.id,
        reason: "SPAM",
      })
    ).data.id;
    await go(sellerPage, "/messages/" + a.id);
  }
  await go(userPage, "/account");
  await until(() => documentSockets.length > 0, "current socket missing");
  const oldSockets = [...documentSockets];
  await userPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await userPage.waitForURL("**/login");
  await until(
    () => oldSockets.every((s) => s.closed),
    "current document socket remained open after logout",
  );
  await login(userPage, other, password);
  await go(userPage, "/messages");
  await badges(userPage, 0, 0);
  await userPage
    .getByRole("heading", { name: "У вас ще немає повідомлень" })
    .waitFor();
  assert.ok(documentSockets.every((s) => !oldSockets.includes(s)));
  assert.equal(documentSockets.filter((s) => !s.closed).length, 1);
  await send(sellerPage, "PRIVATE_11G_AFTER_ACCOUNT_SWITCH");
  await go(userPage, "/messages/" + a.id);
  await userPage.getByText("Розмова недоступна.", { exact: true }).waitFor();
  assert.equal(await userPage.locator(".message-bubble").count(), 0);
  await badges(userPage, 0, 0);
  pass(
    "C: logout closes old sockets; new account has1 fresh socket, empty inbox/counts and no old message/event access",
  );
  await go(adminPage, "/admin/moderation/reports/" + reportId);
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
  await adminPage
    .getByRole("link", { name: "Переглянути контекст розмови", exact: true })
    .click();
  await adminPage
    .getByRole("region", { name: "Приватний контекст розмови" })
    .waitFor();
  await until(
    () => db.moderatorConversationAccess.count({ where: { reportId } }),
    "no audit record",
  );
  const unreadAfterSwitch = await db.message.findFirstOrThrow({
    where: { conversationId: a.id, text: "PRIVATE_11G_AFTER_ACCOUNT_SWITCH" },
  });
  assert.equal(unreadAfterSwitch.readAt, null);
  await responsive(adminPage, "admin-context");
  await go(adminPage, "/account");
  await adminPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await adminPage.waitForURL("**/login");
  await login(adminPage, other, password);
  await go(
    adminPage,
    "/admin/moderation/reports/" + reportId + "/conversation",
  );
  await adminPage
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(await adminPage.locator(".report-context-messages").count(), 0);
  pass(
    "D: report-scoped bounded/full ADMIN context, explicit access audit, no participant read; logout→USER removes staff data; context375/768/1440",
  );
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors, horizontal overflow or native selects");
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
  const ids = users.map((u) => u.id);
  await db.moderatorConversationAccess.deleteMany({
    where: { moderatorId: { in: ids } },
  });
  await db.report.deleteMany({ where: { reporterId: { in: ids } } });
  await db.conversation.deleteMany({
    where: { id: { in: conversations.map((c) => c.id) } },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase11g-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
