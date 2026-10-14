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
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  users = [],
  checks = [],
  errors = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  buyerContext = await browser.newContext(),
  sellerContext = await browser.newContext();
const buyerPage = await buyerContext.newPage(),
  sellerPage = await sellerContext.newPage();
for (const p of [buyerPage, sellerPage])
  p.on("pageerror", (e) => errors.push(e.message));
const password = "LocalFixture-" + randomUUID();
let before, listing, location, conversationId;
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function fingerprint() {
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','AuthRefreshToken') ORDER BY tablename`;
  const result = {};
  for (const { tablename } of tables) {
    const [row] = await db.$queryRawUnsafe(
      "SELECT count(*)::int AS count, md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS hash FROM \"" +
        tablename.replaceAll('"', '""') +
        '" t',
    );
    result[tablename] = row;
  }
  return result;
}
async function go(page, path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
async function login(page, user, fromListing = false) {
  if (!fromListing) await go(page, "/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL(
    fromListing ? "**/listings/" + listing.id : "**/account",
  );
  await page.waitForLoadState("networkidle");
}
async function geometry(page, label, dialog = false) {
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
      : page.locator(".messages-page");
    const boxes = await scope
      .locator("button:visible,a:visible")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          w: n.getBoundingClientRect().width,
          h: n.getBoundingClientRect().height,
        })),
      );
    assert.ok(
      boxes.every((b) => b.w >= 43.5 && b.h >= 43.5),
      label + " touch targets " + width,
    );
    if (dialog) {
      const b = await scope.boundingBox();
      assert.ok(b.x >= 15 && b.x + b.width <= width - 15);
    }
    await page.screenshot({
      path: "test-results/phase11c-" + label + "-" + width + ".png",
    });
  }
  pass(label + " fits375/768/1440;44px;no horizontal overflow/native select");
}
try {
  await mkdir("test-results", { recursive: true });
  before = await fingerprint();
  const hash = await require("argon2").hash(password);
  for (const firstName of ["Продавець", "Покупець", "Інший"]) {
    const user = await db.user.create({
      data: {
        email: "conversation-browser-" + randomUUID() + "@example.invalid",
        passwordHash: hash,
        firstName,
        lastName: "Тестовий",
      },
    });
    users.push(user.id);
  }
  const seller = await db.user.findUnique({ where: { id: users[0] } }),
    buyer = await db.user.findUnique({ where: { id: users[1] } }),
    other = await db.user.findUnique({ where: { id: users[2] } });
  const species = await db.species.findUniqueOrThrow({
      where: { slug: "dog" },
    }),
    breed = await db.breed.findFirst({
      where: { speciesId: species.id, isActive: true },
    });
  location = await db.location.create({
    data: {
      city: "Повідомлення",
      region: "Тестова область",
      slug: randomUUID(),
    },
  });
  const pet = await db.pet.create({
    data: {
      ownerId: seller.id,
      speciesId: species.id,
      breedId: breed?.id,
      gender: "MALE",
      name: "Рекс",
    },
  });
  listing = await db.listing.create({
    data: {
      sellerId: seller.id,
      petId: pet.id,
      locationId: location.id,
      type: "FREE",
      title: "Цуценя шукає відповідальну родину",
      description: "Докладний опис тварини для перевірки приватної розмови.",
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
  if (process.env.PHASE11C_RESUME === "dialog") {
    const prior = JSON.parse(
      await readFile("test-results/phase11c-browser.json", "utf8"),
    );
    assert.ok(
      prior.checks.includes(
        "anonymous login returns to the same Listing safely",
      ),
    );
    checks.push("anonymous login returns to the same Listing safely");
    await login(buyerPage, buyer);
    await go(buyerPage, "/listings/" + listing.id);
  } else {
    await go(buyerPage, "/listings/" + listing.id);
    const anonymous = buyerPage.getByRole("link", {
      name: "Написати продавцю",
      exact: true,
    });
    await anonymous.waitFor();
    assert.ok((await anonymous.getAttribute("href")).includes("returnTo="));
    await anonymous.click();
    await buyerPage.waitForURL("**/login?**");
    await login(buyerPage, buyer, true);
    pass("anonymous login returns to the same Listing safely");
  }
  await buyerPage
    .getByRole("button", { name: "Написати продавцю", exact: true })
    .click();
  const dialog = buyerPage.getByRole("dialog");
  await dialog.getByLabel("Повідомлення", { exact: true }).waitFor();
  assert.equal(
    await dialog
      .getByLabel("Повідомлення", { exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await buyerPage.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog
      .getByRole("button", { name: "Скасувати", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await buyerPage.keyboard.press("Tab");
  assert.equal(
    await dialog
      .getByLabel("Повідомлення", { exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  await geometry(buyerPage, "first-message", true);
  await dialog.getByRole("button", { name: "Надіслати", exact: true }).click();
  await dialog
    .getByRole("alert")
    .getByText("Введіть повідомлення", { exact: true })
    .waitFor();
  assert.equal(
    await db.conversation.count({ where: { listingKey: listing.id } }),
    0,
  );
  const firstText = "Добрий день, цуценя ще актуальне?";
  await dialog.getByLabel("Повідомлення", { exact: true }).fill(firstText);
  await buyerPage.keyboard.press("Enter");
  assert.equal(
    await dialog.getByLabel("Повідомлення", { exact: true }).inputValue(),
    firstText + "\n",
  );
  assert.equal(
    await db.conversation.count({ where: { listingKey: listing.id } }),
    0,
  );
  await dialog.getByLabel("Повідомлення", { exact: true }).fill(firstText);
  let fail = true;
  await buyerPage.route("**/api/v1/listings/*/conversation", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "PRIVATE_INTERNAL_ERROR" }),
      });
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Надіслати", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(
    await dialog.getByLabel("Повідомлення", { exact: true }).inputValue(),
    firstText,
  );
  assert.equal(
    await db.conversation.count({ where: { listingKey: listing.id } }),
    0,
  );
  await dialog.getByRole("button", { name: "Надіслати", exact: true }).click();
  await buyerPage.waitForURL("**/messages/*");
  conversationId = new URL(buyerPage.url()).pathname.split("/").at(-1);
  await buyerPage
    .getByRole("list", { name: "Історія повідомлень" })
    .getByText(firstText, { exact: true })
    .waitFor();
  await buyerPage.unroute("**/api/v1/listings/*/conversation");
  pass(
    "A: first send is atomic; validation/failed send retain draft; Enter inserts newline; success navigates to conversation",
  );
  await geometry(buyerPage, "conversation");
  await login(sellerPage, seller);
  await go(sellerPage, "/listings/" + listing.id);
  assert.equal(
    await sellerPage
      .getByRole("button", { name: "Написати продавцю", exact: true })
      .count(),
    0,
  );
  pass("E: own Listing has no self-chat CTA");
  await go(sellerPage, "/messages");
  await sellerPage
    .getByRole("link")
    .filter({ hasText: listing.title })
    .waitFor();
  await sellerPage.getByText("Покупець Тестовий", { exact: true }).waitFor();
  assert.ok(await sellerPage.getByText(/Непрочитаних:/).count());
  await geometry(sellerPage, "inbox");
  await sellerPage.getByRole("link").filter({ hasText: listing.title }).click();
  await sellerPage.waitForURL("**/messages/" + conversationId);
  await sellerPage
    .getByRole("list", { name: "Історія повідомлень" })
    .getByText(firstText, { exact: true })
    .waitFor();
  const reply = "<script>window.__chatPwned=1</script> Так, ще актуальне.";
  await sellerPage.getByLabel("Повідомлення", { exact: true }).fill(reply);
  await sellerPage
    .getByRole("button", { name: "Надіслати", exact: true })
    .click();
  await sellerPage
    .getByRole("list", { name: "Історія повідомлень" })
    .getByText(reply, { exact: true })
    .waitFor();
  assert.equal(await sellerPage.evaluate(() => window.__chatPwned), undefined);
  pass(
    "B: seller inbox shows Listing/buyer/unread context; reply renders escaped plain text",
  );
  await buyerPage.reload();
  await buyerPage
    .getByRole("list", { name: "Історія повідомлень" })
    .getByText(reply, { exact: true })
    .waitFor();
  pass("C: buyer refresh receives reply without realtime");
  await go(buyerPage, "/listings/" + listing.id);
  await buyerPage
    .getByRole("button", { name: "Написати продавцю", exact: true })
    .click();
  await buyerPage
    .getByRole("dialog")
    .getByLabel("Повідомлення", { exact: true })
    .fill("Дякую, хочу уточнити деталі.");
  await buyerPage
    .getByRole("dialog")
    .getByRole("button", { name: "Надіслати", exact: true })
    .click();
  await buyerPage.waitForURL("**/messages/" + conversationId);
  assert.equal(
    await db.conversation.count({ where: { listingKey: listing.id } }),
    1,
  );
  assert.equal(await db.message.count({ where: { conversationId } }), 3);
  pass("D: contacting same Listing again reuses the exact Conversation");
  await db.listing.update({
    where: { id: listing.id },
    data: { moderationStatus: "HIDDEN" },
  });
  await buyerPage.reload();
  await buyerPage
    .getByText("Оголошення більше не активне", { exact: true })
    .waitFor();
  assert.equal(await buyerPage.locator(".conversation-context a").count(), 0);
  await buyerPage.getByText(listing.title, { exact: true }).waitFor();
  pass(
    "unavailable Listing retains private snapshot/history with neutral state and no public link",
  );
  await go(buyerPage, "/account");
  await buyerPage
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await buyerPage.waitForURL("**/login");
  await login(buyerPage, other);
  await go(buyerPage, "/messages");
  await buyerPage
    .getByRole("heading", { name: "У вас ще немає повідомлень", exact: true })
    .waitFor();
  assert.equal(
    await buyerPage.getByText(firstText, { exact: true }).count(),
    0,
  );
  await go(buyerPage, "/messages/" + conversationId);
  await buyerPage.getByText("Розмова недоступна.", { exact: true }).waitFor();
  assert.equal(await buyerPage.getByText(reply, { exact: true }).count(), 0);
  pass(
    "F: logout/login clears inbox/history; new account direct route safely denied without old message leakage",
  );
  assert.deepEqual(errors, []);
  pass("no browser runtime/hydration errors");
} finally {
  await buyerContext.close();
  await sellerContext.close();
  await browser.close();
  try {
    await db.conversation.deleteMany({
      where: { OR: [{ buyerId: { in: users } }, { sellerId: { in: users } }] },
    });
    if (listing) await db.listing.deleteMany({ where: { id: listing.id } });
    await db.pet.deleteMany({ where: { ownerId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (location) await db.location.delete({ where: { id: location.id } });
    if (before)
      assert.deepEqual(
        await fingerprint(),
        before,
        "Existing stable records preserved",
      );
  } finally {
    await db.$disconnect();
    await writeFile(
      "test-results/phase11c-browser.json",
      JSON.stringify({ checks, errors }, null, 2),
    );
  }
}
