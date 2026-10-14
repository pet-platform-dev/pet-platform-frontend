import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFile, readFile, mkdir } from "node:fs/promises";
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const users = [],
  checks = [],
  errors = [],
  requests = [];
const resume = process.env.MESSAGING_SCROLL_RESUME === "refetch";
if (resume)
  checks.push(
    ...JSON.parse(
      await readFile("test-results/messaging-scroll-read.json", "utf8"),
    ).checks,
  );
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/\/conversations\/[^/]+\/messages\?/.test(r.url()))
    requests.push(r.url());
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
const view = () => page.locator(".message-viewport");
const bottom = async () =>
  view().evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight < 4);
async function waitUntil(predicate, message) {
  const end = Date.now() + 15000;
  while (!(await predicate())) {
    if (Date.now() > end) throw Error(message);
    await new Promise((r) => setTimeout(r, 100));
  }
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Продавець", "Покупець", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "scroll-read-" + randomUUID() + "@example.invalid",
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
    data: { city: "Тест", region: "Область", slug: randomUUID() },
  });
  const pet = await db.pet.create({
    data: { ownerId: seller.id, speciesId: species.id, gender: "MALE" },
  });
  listing = await db.listing.create({
    data: {
      sellerId: seller.id,
      petId: pet.id,
      locationId: location.id,
      title: "Перевірка прокручування розмови",
      description: "Локальна тимчасова перевірка повідомлень",
      type: "FREE",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
    },
  });
  const a = (await service.start(buyer.id, listing.id, { text: "Історія 01" }))
    .data;
  await db.notification.updateMany({
    where: { userId: seller.id },
    data: { readAt: new Date() },
  });
  await db.message.updateMany({
    where: { conversationId: a.id },
    data: { readAt: new Date() },
  });
  const start = Date.now();
  const rows = Array.from({ length: 59 }, (_, i) => ({
    id: randomUUID(),
    conversationId: a.id,
    senderId: i % 2 ? seller.id : buyer.id,
    text:
      "Історія " +
      String(i + 2).padStart(2, "0") +
      " — повідомлення для перевірки стабільної позиції",
    createdAt: new Date(start + i + 1),
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
  const b = (await service.start(other.id, listing.id, { text: "Нове B" }))
    .data;
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(seller.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page
    .getByRole("button", { name: "Сповіщення, непрочитаних: 3", exact: true })
    .waitFor();
  // Bell click must clear the sibling notification too, not just the clicked row.
  if (!resume) {
    await page
      .getByRole("button", { name: "Сповіщення, непрочитаних: 3", exact: true })
      .click();
    await page
      .locator(`.notification-item a[href="/messages/${a.id}"]`)
      .first()
      .click();
  } else await go("/messages/" + a.id);
  await page.waitForURL("**/messages/" + a.id);
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
  if (!resume)
    pass(
      "bell route: A clears both matching notices, B remains unread, bell 3 → 1",
    );
  await waitUntil(bottom, "initial history did not open at bottom");
  assert.equal(
    await page
      .getByRole("button", { name: /Старіші повідомлення|Новіші повідомлення/ })
      .count(),
    0,
  );
  assert.equal(await page.locator(".message-bubble").count(), 20);
  assert.ok(
    requests.every((r) => new URL(r).searchParams.get("limit") === "20"),
  );
  const initialHeight = await view().evaluate((n) => n.clientHeight);
  assert.ok(initialHeight <= 620 && initialHeight >= 240);
  if (!resume)
    pass(
      "latest bounded page only, no pagination controls, internal viewport opens at bottom",
    );
  await view().focus();
  // Save the first visible message and its exact viewport offset before prepend.
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
  await waitUntil(
    async () => (await page.locator(".message-bubble").count()) >= 40,
    "older page not loaded on top scroll",
  );
  await page.waitForLoadState("networkidle");
  const after = await view().evaluate(
    (n, id) =>
      n.querySelector(`[data-message-id="${id}"]`).getBoundingClientRect().top -
      n.getBoundingClientRect().top,
    anchor.id,
  );
  assert.ok(
    Math.abs(after - anchor.offset) <= 3,
    `prepend shifted anchor by ${after - anchor.offset}`,
  );
  assert.equal(
    await view().evaluate((n) => n === document.activeElement),
    true,
  );
  if (!resume)
    pass(
      "upward scroll loads one older bounded page, preserves visible anchor and keyboard focus",
    );
  // Incoming focus-refetch must leave a reader of older history in place.
  await service.send(buyer.id, a.id, {
    text: "Вхідне під час читання історії",
  });
  const tab = await context.newPage();
  await tab.bringToFront();
  await page.bringToFront();
  // Headless Edge may keep all tabs visible; dispatch the browser lifecycle
  // event consumed by TanStack's real focus manager deterministically.
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await waitUntil(
    async () =>
      (await page.locator(".message-bubble").last().textContent()).includes(
        "Вхідне під час",
      ),
    "incoming focus refetch failed",
  );
  const incomingOffset = await view().evaluate(
    (n, id) =>
      n.querySelector(`[data-message-id="${id}"]`).getBoundingClientRect().top -
      n.getBoundingClientRect().top,
    anchor.id,
  );
  assert.ok(Math.abs(incomingOffset - anchor.offset) <= 3);
  assert.equal(await bottom(), false);
  await tab.close();
  pass("incoming refetch preserves older reading position");
  await page
    .getByLabel("Повідомлення", { exact: true })
    .fill("Надіслано з історії");
  await page.getByRole("button", { name: "Надіслати", exact: true }).click();
  await waitUntil(
    async () =>
      (await page.locator(".message-bubble").last().textContent()).includes(
        "Надіслано з історії",
      ) && (await bottom()),
    "send did not scroll to latest",
  );
  pass("send from older history scrolls to latest message");
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const box = await view().boundingBox();
    assert.ok(box.width <= width && box.height >= 240);
    await page
      .getByLabel("Повідомлення", { exact: true })
      .scrollIntoViewIfNeeded();
    assert.equal(
      await page
        .getByRole("button", { name: "Надіслати", exact: true })
        .isVisible(),
      true,
    );
    await page.screenshot({
      path: `test-results/messaging-scroll-${width}.png`,
      fullPage: true,
    });
  }
  pass(
    "375/768/1440: bounded internal scroll, accessible composer, no horizontal overflow",
  );
  await go("/messages");
  await page.locator(`.conversation-card[href="/messages/${b.id}"]`).click();
  await page.getByRole("button", { name: "Сповіщення", exact: true }).waitFor();
  assert.equal(
    await db.notification.count({ where: { userId: seller.id, readAt: null } }),
    0,
  );
  pass("direct inbox route B synchronizes notifications, bell 1 → 0");
  assert.deepEqual(errors, []);
  pass("no browser runtime/hydration errors");
} finally {
  await context.close();
  await browser.close();
  await db.conversation.deleteMany({
    where: {
      OR: [
        { buyerId: { in: users.map((u) => u.id) } },
        { sellerId: { in: users.map((u) => u.id) } },
      ],
    },
  });
  if (listing) await db.listing.delete({ where: { id: listing.id } });
  await db.pet.deleteMany({
    where: { ownerId: { in: users.map((u) => u.id) } },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
  await writeFile(
    "test-results/messaging-scroll-read.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
