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
const url = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.pathname === "/pet_platform",
);
const { PrismaService } =
  await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const { ConversationsService } =
  await import("../../pet-platform-backend/dist/src/conversations/conversations.service.js");
const { NotificationsService } =
  await import("../../pet-platform-backend/dist/src/notifications/notifications.service.js");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  service = new ConversationsService(db, new NotificationsService(db));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const buyerContext = await browser.newContext(),
  sellerContext = await browser.newContext(),
  otherContext = await browser.newContext();
const buyerPage = await buyerContext.newPage(),
  sellerPage = await sellerContext.newPage(),
  sellerTab = await sellerContext.newPage(),
  otherPage = await otherContext.newPage();
const users = [],
  checks = [],
  errors = [],
  routes = [];
const resume = process.env.PHASE11E_RESUME === "reconnect";
if (resume)
  checks.push(
    ...JSON.parse(await readFile("test-results/phase11e-browser.json", "utf8"))
      .checks,
  );
let listing,
  location,
  dropMessages = false;
for (const page of [buyerPage, sellerPage, sellerTab, otherPage])
  page.on("pageerror", (e) => errors.push(e.message));
// Pass through actual Socket.IO traffic; exercise duplicates and loss explicitly.
await sellerPage.routeWebSocket(/\/socket\.io\//, (ws) => {
  const item = { ws, server: null, closed: false };
  routes.push(item);
  const server = ws.connectToServer();
  item.server = server;
  server.onMessage((frame) => {
    if (
      dropMessages &&
      typeof frame === "string" &&
      frame.includes('"message:new"')
    )
      return;
    ws.send(frame);
    if (typeof frame === "string" && frame.includes('"message:new"'))
      ws.send(frame);
  });
  ws.onClose(() => {
    item.closed = true;
    void server.close();
  });
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (page, path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
async function until(predicate, label) {
  const end = Date.now() + 20000;
  while (!(await predicate())) {
    if (Date.now() > end) throw Error(label);
    await new Promise((r) => setTimeout(r, 100));
  }
}
const view = (page) => page.locator('.message-viewport[role="region"]');
const bottom = (page) =>
  view(page).evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight < 4);
async function badge(page, count) {
  await page
    .getByRole("link", {
      name: count ? `Повідомлення, непрочитаних: ${count}` : "Повідомлення",
      exact: true,
    })
    .waitFor();
}
async function login(page, user, password) {
  await go(page, "/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
}
async function send(page, text, foreground) {
  await page
    .getByRole("textbox", { name: "Повідомлення", exact: true })
    .fill(text);
  if (foreground) await foreground.bringToFront();
  await page
    .locator(".message-composer")
    .evaluate((form) => form.requestSubmit());
  await until(
    async () =>
      (await page
        .getByRole("textbox", { name: "Повідомлення", exact: true })
        .inputValue()) === "",
    "send did not settle",
  );
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Продавець", "Покупець", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "phase11e-" + randomUUID() + "@example.invalid",
          passwordHash,
          firstName,
          lastName: "Перевірка",
        },
      }),
    );
  const [seller, buyer, other] = users,
    species = await db.species.findUniqueOrThrow({ where: { slug: "dog" } });
  location = await db.location.create({
    data: { city: "Тест", region: "Тест", slug: randomUUID() },
  });
  const pet = await db.pet.create({
    data: { ownerId: seller.id, speciesId: species.id, gender: "MALE" },
  });
  listing = await db.listing.create({
    data: {
      sellerId: seller.id,
      petId: pet.id,
      locationId: location.id,
      title: "Цуценя шукає родину",
      description: "Тимчасові realtime перевірки",
      type: "FREE",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
    },
  });
  const a = (await service.start(buyer.id, listing.id, { text: "Історія 01" }))
      .data.id,
    b = (await service.start(other.id, listing.id, { text: "Контекст B" })).data
      .id;
  const old = Date.now() - 2 * 86400000;
  const rows = Array.from({ length: 59 }, (_, i) => ({
    id: randomUUID(),
    conversationId: a,
    senderId: i % 2 ? seller.id : buyer.id,
    text: "Історія " + (i + 2),
    createdAt: new Date(old + i * 60000),
    readAt: new Date(),
  }));
  await db.message.createMany({ data: rows });
  await db.message.updateMany({
    where: { conversationId: { in: [a, b] } },
    data: { readAt: new Date() },
  });
  await db.notification.updateMany({
    where: { userId: { in: users.map((u) => u.id) } },
    data: { readAt: new Date() },
  });
  await login(buyerPage, buyer, password);
  await login(sellerPage, seller, password);
  await login(otherPage, other, password);
  await go(buyerPage, "/messages/" + a);
  await go(sellerPage, "/messages");
  await go(sellerTab, "/messages");
  await go(otherPage, "/messages/" + b);
  await until(
    () => routes.filter((r) => !r.closed && r.server).length === 1,
    "one active seller socket missing",
  );
  const initialConnections = routes.length;
  if (!resume) {
    await send(buyerPage, "Живе A із каталогу");
    await badge(sellerPage, 1);
    await badge(sellerTab, 1);
    await sellerPage
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .waitFor();
    await until(
      async () =>
        (await sellerPage
          .locator("a.conversation-card")
          .first()
          .getAttribute("href")) ===
        "/messages/" + a,
      "inbox not reordered live",
    );
    await sellerPage
      .locator(`a[href="/messages/${a}"] .conversation-preview`)
      .getByText("Живе A із каталогу", { exact: true })
      .waitFor();
    assert.equal(routes.length, initialConnections);
    pass(
      "A/multi-tab: live inbox preview/order and separate message/bell badges in both recipient tabs, no reload",
    );
    await sellerPage
      .locator(`a.conversation-card[href="/messages/${a}"]`)
      .click();
    await view(sellerPage).waitFor();
    await sellerPage.bringToFront();
    await badge(sellerPage, 0);
    await badge(sellerTab, 0);
    await sellerPage
      .getByRole("button", { name: "Сповіщення", exact: true })
      .waitFor();
    await view(sellerPage).focus();
    await send(buyerPage, "Видиме A без refresh", sellerPage);
    await sellerPage
      .getByText("Видиме A без refresh", { exact: true })
      .waitFor();
    await badge(sellerPage, 0);
    await until(
      () =>
        db.message.findFirst({
          where: {
            conversationId: a,
            text: "Видиме A без refresh",
            readAt: { not: null },
          },
        }),
      "visible auto-read did not synchronize",
    );
    assert.equal(
      await view(sellerPage).evaluate((n) => n === document.activeElement),
      true,
    );
    assert.equal(await bottom(sellerPage), true);
    pass(
      "open visible A: append/follow bottom and read+notification sync, no focus steal",
    );
    await send(sellerPage, "Жива відповідь продавця", sellerPage);
    await buyerPage
      .getByText("Жива відповідь продавця", { exact: true })
      .waitFor();
    assert.equal(
      (
        await db.message.findFirstOrThrow({
          where: { conversationId: a, text: "Жива відповідь продавця" },
        })
      ).readAt,
      null,
    );
    await buyerPage.bringToFront();
    await until(
      () =>
        db.message.findFirst({
          where: {
            conversationId: a,
            text: "Жива відповідь продавця",
            readAt: { not: null },
          },
        }),
      "foreground read did not recover",
    );
    pass(
      "B/background privacy: buyer receives reply live; background tab stays unread until active",
    );
    await sellerPage.bringToFront();
    await view(sellerPage).focus();
    const anchor = await view(sellerPage).evaluate((n) => {
      n.scrollTop = 40;
      const top = n.getBoundingClientRect().top,
        m = [...n.querySelectorAll("[data-message-id]")].find(
          (m) => m.getBoundingClientRect().bottom > top,
        );
      return {
        id: m.dataset.messageId,
        offset: m.getBoundingClientRect().top - top,
      };
    });
    await until(
      async () => (await sellerPage.locator(".message-bubble").count()) >= 40,
      "older page not loaded",
    );
    await send(buyerPage, "Нове A під час старої історії", sellerPage);
    await sellerPage
      .getByText("Нове A під час старої історії", { exact: true })
      .waitFor();
    const offset = await view(sellerPage).evaluate(
      (n, id) =>
        n.querySelector(`[data-message-id="${id}"]`).getBoundingClientRect()
          .top - n.getBoundingClientRect().top,
      anchor.id,
    );
    assert.ok(Math.abs(offset - anchor.offset) <= 3);
    assert.equal(await bottom(sellerPage), false);
    assert.equal(
      await sellerPage
        .getByRole("button", {
          name: /Старіші повідомлення|Новіші повідомлення/,
        })
        .count(),
      0,
    );
    pass(
      "history: realtime append and upward prepend coexist with stable anchor/focus and no pagination controls",
    );
    await send(otherPage, "Нове B поруч із відкритим A", sellerPage);
    await badge(sellerPage, 1);
    await sellerPage
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .waitFor();
    assert.ok(sellerPage.url().endsWith("/messages/" + a));
    assert.equal(
      await sellerPage
        .getByText("Нове B поруч із відкритим A", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      (
        await db.message.findFirstOrThrow({
          where: { conversationId: b, text: "Нове B поруч із відкритим A" },
        })
      ).readAt,
      null,
    );
    pass(
      "C: closed B stays unread and updates both badges while A remains stable",
    );
    await sellerPage.bringToFront();
    await send(buyerPage, "Одне канонічне повідомлення", sellerPage);
    await sellerPage
      .getByText("Одне канонічне повідомлення", { exact: true })
      .waitFor();
    await sellerPage.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await until(
      async () =>
        (await sellerPage
          .getByText("Одне канонічне повідомлення", { exact: true })
          .count()) === 1,
      "duplicate rendered",
    );
    const canonical = await db.message.findFirstOrThrow({
      where: { conversationId: a, text: "Одне канонічне повідомлення" },
    });
    assert.equal(
      await db.notification.count({ where: { messageId: canonical.id } }),
      1,
    );
    assert.equal(
      await sellerPage.locator("[data-message-id]").count(),
      new Set(
        await sellerPage
          .locator("[data-message-id]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.messageId)),
      ).size,
    );
    pass(
      "D: sender POST + duplicate Socket.IO packets + refetch produce one visible Message/Notification",
    );
  } else {
    await sellerPage
      .locator(`a.conversation-card[href="/messages/${a}"]`)
      .click();
    await view(sellerPage).waitFor();
    await sellerPage.bringToFront();
    await badge(sellerPage, 0);
    await send(otherPage, "Непрочитане B для reconnect", sellerPage);
    await badge(sellerPage, 1);
  }
  // Drop a real committed event, then close the real transport once. Normal
  // reconnect attempts pass through instead of synthesizing half-open sockets.
  dropMessages = true;
  await send(buyerPage, "Пропущене A під час розриву");
  const connected = routes.filter((r) => !r.closed && r.server).at(-1);
  connected.closed = true;
  await connected.ws.close({ code: 1012, reason: "fixture disconnect" });
  await connected.server.close();
  dropMessages = false;
  await until(
    () => routes.length > initialConnections,
    "client did not attempt backoff reconnect",
  );
  await until(
    async () =>
      (await sellerPage
        .getByText("Пропущене A під час розриву", { exact: true })
        .count()) === 1,
    "reconnect missed-event reconciliation failed",
  );
  await sellerPage.bringToFront();
  await badge(sellerPage, 1);
  pass(
    "E: automatic backoff reconnect reconciles missed committed history/counts without duplication",
  );
  for (const width of [375, 768, 1440]) {
    await sellerPage.setViewportSize({
      width,
      height: width === 375 ? 812 : 1000,
    });
    await sellerPage.bringToFront();
    await send(buyerPage, "Live на ширині " + width, sellerPage);
    await sellerPage
      .getByText("Live на ширині " + width, { exact: true })
      .waitFor();
    assert.equal(
      await sellerPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(await sellerPage.locator("select").count(), 0);
    await sellerPage.screenshot({
      path: `test-results/phase11e-conversation-${width}.png`,
      fullPage: true,
    });
  }
  pass(
    "G: live conversation375/768/1440, bounded scroll/composer/no overflow or native select",
  );
  await go(sellerPage, "/account");
  await sellerPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await sellerPage.waitForURL("**/login");
  await until(
    () => routes.every((r) => r.closed),
    "old session transport not closed",
  );
  await login(sellerPage, other, password);
  await go(sellerPage, "/messages");
  await sellerPage.locator("a.conversation-card").waitFor();
  await send(buyerPage, "PRIVATE_A_AFTER_ACCOUNT_SWITCH");
  await until(
    () =>
      db.message.findFirst({
        where: { conversationId: a, text: "PRIVATE_A_AFTER_ACCOUNT_SWITCH" },
      }),
    "fixture send missing",
  );
  assert.equal(
    await sellerPage
      .getByText("PRIVATE_A_AFTER_ACCOUNT_SWITCH", { exact: true })
      .count(),
    0,
  );
  assert.equal(await sellerPage.locator(`a[href="/messages/${a}"]`).count(), 0);
  await go(sellerPage, "/messages/" + a);
  await sellerPage.getByText("Розмова недоступна.", { exact: true }).waitFor();
  assert.equal(await sellerPage.locator(".message-bubble").count(), 0);
  pass(
    "F: logout closes old transport; new account has fresh connection and no old room/cache/event access",
  );
  assert.deepEqual(errors, []);
  pass("no browser runtime/hydration errors");
} finally {
  await buyerContext.close();
  await sellerContext.close();
  await otherContext.close();
  await browser.close();
  const ids = users.map((u) => u.id);
  await db.conversation.deleteMany({
    where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
  });
  if (listing) await db.listing.deleteMany({ where: { id: listing.id } });
  await db.pet.deleteMany({ where: { ownerId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase11e-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
