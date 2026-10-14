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
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  service = new ConversationsService(db, new NotificationsService(db));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  users = [],
  checks = [],
  errors = [],
  historyRequests = [];
const resume = process.env.PHASE11D_RESUME === "inbox";
if (resume)
  checks.push(
    ...JSON.parse(await readFile("test-results/phase11d-browser.json", "utf8"))
      .checks,
  );
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (/\/conversations\/[^/]+\/messages\?/.test(request.url()))
    historyRequests.push(request.url());
});
let listing, location;
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
const view = () => page.locator(".message-viewport[role=region]");
const bottom = () =>
  view().evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight < 4);
async function until(predicate, label) {
  const end = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() > end) throw Error(label);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
async function geometry(name) {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      name + " overflow " + width,
    );
    assert.equal(await page.locator("select").count(), 0);
    const nav = await page.locator(".message-navigation").boundingBox();
    assert.ok(nav.width >= 44 && nav.height >= 44);
    assert.equal(await page.locator(".message-navigation svg").count(), 1);
    const controls = await page
      .locator(".messages-page a:visible,.messages-page button:visible")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          width: n.getBoundingClientRect().width,
          height: n.getBoundingClientRect().height,
        })),
      );
    assert.ok(
      controls.every((n) => n.width >= 43.5 && n.height >= 43.5),
      name + " target size " + width,
    );
    await page.screenshot({
      path: `test-results/phase11d-${name}-${width}.png`,
      fullPage: true,
    });
  }
  pass(
    name +
      " 375/768/1440: SVG nav,44px actions,no native selects/no horizontal overflow",
  );
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Олександр", "Покупець", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "phase11d-" + randomUUID() + "@example.invalid",
          passwordHash,
          firstName,
          lastName: "Перевірка",
        },
      }),
    );
  const [seller, buyer, other] = users;
  const species = await db.species.findUniqueOrThrow({
    where: { slug: "dog" },
  });
  location = await db.location.create({
    data: { city: "Тест", region: "Тестова область", slug: randomUUID() },
  });
  const pet = await db.pet.create({
    data: { ownerId: seller.id, speciesId: species.id, gender: "MALE" },
  });
  listing = await db.listing.create({
    data: {
      sellerId: seller.id,
      petId: pet.id,
      locationId: location.id,
      title: "Цуценя шукає відповідальну родину",
      description: "Тимчасова перевірка інтерфейсу повідомлень",
      type: "FREE",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
    },
  });
  const a = (await service.start(buyer.id, listing.id, { text: "Історія 01" }))
    .data;
  const first = await db.message.findFirstOrThrow({
    where: { conversationId: a.id },
  });
  const base = Date.now() - 3 * 86400000;
  await db.message.update({
    where: { id: first.id },
    data: { createdAt: new Date(base), readAt: new Date() },
  });
  await db.notification.updateMany({
    where: { userId: seller.id },
    data: { readAt: new Date() },
  });
  const rows = Array.from({ length: 59 }, (_, i) => ({
    id: randomUUID(),
    conversationId: a.id,
    senderId: i % 2 ? seller.id : buyer.id,
    text: `Історія ${i + 2} — збереження позиції читання`,
    createdAt: new Date(base + (i + 1) * 60000),
    readAt: new Date(),
  }));
  await db.message.createMany({ data: rows });
  await db.conversation.update({
    where: { id: a.id },
    data: {
      lastMessageAt: rows.at(-1).createdAt,
      lastMessageId: rows.at(-1).id,
    },
  });
  await service.send(buyer.id, a.id, { text: "Нове A перше" });
  await service.send(buyer.id, a.id, { text: "Нове A друге" });
  const b = (
    await service.start(other.id, listing.id, { text: "Нове B перше" })
  ).data;
  await go("/login");
  assert.equal(await page.locator(".message-navigation").count(), 0);
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(seller.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  const message =
    "Дякую!\n" +
    "довгий_рядок_".repeat(45) +
    "\n<script>window.__messagePwned=1</script>";
  if (!resume) {
    await page
      .getByRole("link", { name: "Повідомлення, непрочитаних: 3", exact: true })
      .waitFor();
    await page.locator(".message-navigation").click();
    await page.waitForURL("**/messages");
    await page.locator("a.conversation-card").first().waitFor();
    assert.equal(await page.locator(".conversation-card.is-unread").count(), 2);
    assert.equal(
      await page.locator(".conversation-card").first().getAttribute("href"),
      "/messages/" + b.id,
    );
    await page
      .locator(`a[href="/messages/${a.id}"]`)
      .getByText("Непрочитаних: 2", { exact: false })
      .waitFor();
    await page
      .locator(`a[href="/messages/${b.id}"]`)
      .getByText("Непрочитаних: 1", { exact: false })
      .waitFor();
    pass(
      "A: anonymous hides entry; authenticated Header badge3; inbox A2/B1 and canonical recent-first order",
    );
    await geometry("inbox");
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Failure must leave authoritative counters unchanged and history usable.
    await page.route(
      `**/conversations/${a.id}/read`,
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Unavailable" }),
        }),
      { times: 1 },
    );
    await page.locator(`a[href="/messages/${a.id}"]`).click();
    await page.waitForURL("**/messages/" + a.id);
    await page
      .getByText("Не вдалося позначити повідомлення прочитаними.", {
        exact: true,
      })
      .waitFor();
    await view().waitFor();
    await page
      .getByRole("link", { name: "Повідомлення, непрочитаних: 3", exact: true })
      .waitFor();
    await page
      .getByRole("alert")
      .getByRole("button", { name: "Спробувати ще раз", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Повідомлення, непрочитаних: 1", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 1", exact: true })
      .waitFor();
    assert.equal(
      await db.notification.count({
        where: {
          userId: seller.id,
          readAt: null,
          message: { conversationId: a.id },
        },
      }),
      0,
    );
    assert.equal((await service.detail(seller.id, b.id)).data.unreadCount, 1);
    pass(
      "read failure preserves badge/history; retry clears A messages and both notices, leaving B1/global1",
    );
    await until(bottom, "initial scroll bottom");
    assert.equal(
      await page
        .getByRole("button", {
          name: /Старіші повідомлення|Новіші повідомлення/,
        })
        .count(),
      0,
    );
    assert.equal(await page.locator(".message-bubble").count(), 20);
    const requestsBefore = historyRequests.length;
    await view().focus();
    const anchor = await view().evaluate((n) => {
      n.scrollTop = 40;
      const top = n.getBoundingClientRect().top;
      const m = [...n.querySelectorAll("[data-message-id]")].find(
        (x) => x.getBoundingClientRect().bottom > top,
      );
      return {
        id: m.dataset.messageId,
        offset: m.getBoundingClientRect().top - top,
      };
    });
    await until(
      async () => (await page.locator(".message-bubble").count()) === 40,
      "older history load",
    );
    await page.waitForLoadState("networkidle");
    const offset = await view().evaluate(
      (n, id) =>
        n.querySelector(`[data-message-id="${id}"]`).getBoundingClientRect()
          .top - n.getBoundingClientRect().top,
      anchor.id,
    );
    assert.ok(Math.abs(offset - anchor.offset) <= 3);
    assert.equal(
      await view().evaluate((n) => n === document.activeElement),
      true,
    );
    assert.equal(
      new Set(
        await page
          .locator("[data-message-id]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.messageId)),
      ).size,
      40,
    );
    assert.equal(
      historyRequests
        .slice(requestsBefore)
        .filter((url) => new URL(url).searchParams.get("page") === "2").length,
      1,
    );
    assert.ok(
      historyRequests.every(
        (url) => new URL(url).searchParams.get("limit") === "20",
      ),
    );
    pass(
      "C: latest bounded page; upward load once; exact anchor/focus preserved; no duplicates/pagination controls",
    );
    await service.send(buyer.id, a.id, {
      text: "Вхідне під час читання історії",
    });
    await page.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await until(
      async () =>
        (await page.locator(".message-bubble").last().textContent()).includes(
          "Вхідне під час",
        ),
      "focus refetch incoming",
    );
    assert.equal(await bottom(), false);
    assert.ok(
      Math.abs(
        (await view().evaluate(
          (n, id) =>
            n.querySelector(`[data-message-id="${id}"]`).getBoundingClientRect()
              .top - n.getBoundingClientRect().top,
          anchor.id,
        )) - anchor.offset,
      ) <= 3,
    );
    pass("focus refetch preserves older reading position");
    await page.route(`**/conversations/${a.id}/messages`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "Unavailable" }),
          })
        : route.continue(),
    );
    const input = page.getByLabel("Повідомлення", { exact: true });
    await input.fill(message);
    await page.getByRole("button", { name: "Надіслати", exact: true }).click();
    await page
      .getByText("Не вдалося надіслати повідомлення. Спробуйте ще раз.", {
        exact: true,
      })
      .waitFor();
    assert.equal(await input.inputValue(), message);
    await page.unroute(`**/conversations/${a.id}/messages`);
    await page.getByRole("button", { name: "Надіслати", exact: true }).click();
    await until(
      async () =>
        (await input.inputValue()) === "" &&
        (await page.locator(".message-bubble").last().textContent()).includes(
          "довгий_рядок_",
        ) &&
        (await bottom()),
      "send success/scroll bottom",
    );
    assert.equal(
      await db.message.count({
        where: { conversationId: a.id, text: message },
      }),
      1,
    );
    assert.equal(await page.evaluate(() => window.__messagePwned), undefined);
    pass(
      "B: failed send retains multiline draft; confirmed success clears once, escapes text and follows bottom",
    );
    await geometry("conversation");
    await page.setViewportSize({ width: 1440, height: 1000 });
  } else {
    // Recreate only the cached-inbox/send setup for the failed navigation assertion.
    await page.locator(".message-navigation").click();
    await page.locator(`a.conversation-card[href="/messages/${a.id}"]`).click();
    await view().waitFor();
    await page
      .getByRole("link", { name: "Повідомлення, непрочитаних: 1", exact: true })
      .waitFor();
    await page.getByLabel("Повідомлення", { exact: true }).fill(message);
    await page.getByRole("button", { name: "Надіслати", exact: true }).click();
    await until(
      async () =>
        (await page.locator(".message-bubble").last().textContent()).includes(
          "довгий_рядок_",
        ) &&
        (await page
          .getByLabel("Повідомлення", { exact: true })
          .inputValue()) === "",
      "resume send setup",
    );
  }
  await page.locator(".conversation-back").click();
  await page.waitForURL("**/messages");
  await page.waitForLoadState("networkidle");
  await until(
    async () =>
      (await page
        .locator("a.conversation-card")
        .first()
        .getAttribute("href")) ===
      "/messages/" + a.id,
    "inbox did not refetch canonical order after send",
  );
  assert.ok(
    (
      await page
        .locator(".conversation-card")
        .first()
        .locator(".conversation-preview")
        .textContent()
    ).startsWith("Ви: Дякую! довгий_рядок_"),
  );
  assert.equal(
    await page.locator(`a[href="/messages/${a.id}"]`).getAttribute("class"),
    "conversation-card",
  );
  assert.equal(
    await page
      .locator(`a[href="/messages/${b.id}"] .conversation-unread`)
      .textContent(),
    "● Непрочитаних: 1",
  );
  pass("send refreshes inbox preview/order; A read, B remains unread");
  // Additional B messages demonstrate per-message total, not conversation count.
  await service.send(other.id, b.id, { text: "Нове B друге" });
  await service.send(other.id, b.id, { text: "Нове B третє" });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await page
    .getByRole("link", { name: "Повідомлення, непрочитаних: 3", exact: true })
    .waitFor();
  await page
    .locator(`a[href="/messages/${b.id}"]`)
    .getByText("Непрочитаних: 3", { exact: false })
    .waitFor();
  pass(
    "B3 remains unread; global badge3 counts incoming messages rather than one unread conversation",
  );
  await db.listing.update({
    where: { id: listing.id },
    data: {
      moderationStatus: "HIDDEN",
      moderationReason: "PRIVATE_PHASE11D_REASON",
    },
  });
  await page.locator(`a[href="/messages/${a.id}"]`).click();
  await page
    .getByText("Оголошення більше не активне", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".conversation-context a").count(), 0);
  assert.equal(
    await page.getByText("PRIVATE_PHASE11D_REASON", { exact: true }).count(),
    0,
  );
  await view().waitFor();
  pass(
    "D: unavailable Listing retains context/history with neutral status and no public link/private reason",
  );
  await go("/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  assert.equal(await page.locator(".message-navigation").count(), 0);
  await page.getByLabel("Електронна адреса", { exact: true }).fill(buyer.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page
    .getByRole("link", { name: "Повідомлення, непрочитаних: 1", exact: true })
    .waitFor();
  await page.locator(".message-navigation").click();
  await page.waitForURL("**/messages");
  await page.locator("a.conversation-card").waitFor();
  assert.equal(await page.locator(`a[href="/messages/${b.id}"]`).count(), 0);
  assert.equal(await page.locator(".conversation-card").count(), 1);
  await go("/messages/" + b.id);
  await page.getByText("Розмова недоступна.", { exact: true }).waitFor();
  assert.equal(await page.locator(".message-bubble").count(), 0);
  pass(
    "E: logout/login replaces badge/inbox/history; foreign direct conversation denied without leakage",
  );
  assert.deepEqual(errors, []);
  pass("no browser runtime/hydration errors");
} finally {
  await context.close();
  await browser.close();
  const ids = users.map((u) => u.id);
  await db.conversation.deleteMany({
    where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
  });
  if (listing) await db.listing.deleteMany({ where: { id: listing.id } });
  await db.pet.deleteMany({ where: { ownerId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  if (location) await db.location.delete({ where: { id: location.id } });
  assert.equal(await db.user.count({ where: { id: { in: ids } } }), 0);
  await db.$disconnect();
  await writeFile(
    "test-results/phase11d-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
