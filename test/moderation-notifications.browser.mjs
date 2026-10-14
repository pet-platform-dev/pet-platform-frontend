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
  users = [],
  checks = [],
  errors = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const ownerContext = await browser.newContext(),
  adminContext = await browser.newContext();
const ownerPage = await ownerContext.newPage(),
  adminPage = await adminContext.newPage();
for (const page of [ownerPage, adminPage])
  page.on("pageerror", (e) => errors.push(e.message));
const password = "LocalFixture-" + randomUUID();
let before, location;
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
async function login(page, user) {
  await go(page, "/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  const response = await pending;
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
  return {
    token: (await response.json()).data.accessToken,
    csrf: response.request().headers()["x-csrf-token"],
  };
}
const bell = () => ownerPage.getByRole("button", { name: /^Сповіщення/ });
const panel = () =>
  ownerPage.getByRole("region", { name: "Сповіщення", exact: true });
async function count(value) {
  await ownerPage.waitForFunction(
    (v) =>
      document
        .querySelector(".notification-trigger")
        ?.getAttribute("aria-label") ===
      (v ? "Сповіщення, непрочитаних: " + v : "Сповіщення"),
    value,
  );
}
async function refreshOwner(value) {
  await ownerPage.bringToFront();
  // Separate headless contexts can both remain visible. Exercise the existing
  // navigation refetch rather than synthesizing a focus transition that did not occur.
  await ownerPage.locator('.site-header a[href="/my-listings"]').click();
  await ownerPage.waitForURL("**/my-listings");
  await count(value);
}
async function decision(kind, row, action, reason) {
  await adminPage.bringToFront();
  await go(adminPage, `/admin/moderation/${kind}/${row.id}`);
  const name = { approve: "Схвалити", reject: "Відхилити", hide: "Приховати" }[
    action
  ];
  await adminPage.getByRole("button", { name, exact: true }).click();
  if (reason) {
    const dialog = adminPage.getByRole("dialog");
    await dialog.getByRole("textbox").fill(reason);
    await dialog.getByRole("button", { name, exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
  }
  await adminPage.waitForFunction(
    () => !document.querySelector('.admin-moderation [aria-busy="true"]'),
  );
  const expected = { approve: "APPROVED", reject: "REJECTED", hide: "HIDDEN" }[
    action
  ];
  for (let n = 0; n < 50; n++) {
    const actual = await (
      kind === "listings" ? db.listing : db.matingListing
    ).findUnique({ where: { id: row.id } });
    if (actual.moderationStatus === expected) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Decision did not settle");
}
async function openNotification(title, path) {
  await bell().click();
  const link = panel().getByRole("link", { name: title, exact: true });
  await link.waitFor();
  assert.equal(await link.getAttribute("href"), path);
  await link.click();
  await ownerPage.waitForURL("http://localhost:3000" + path);
  await count(0);
}
try {
  await mkdir("test-results", { recursive: true });
  before = await fingerprint();
  const hash = await require("argon2").hash(password);
  for (const role of ["USER", "ADMIN"]) {
    const user = await db.user.create({
      data: {
        email:
          "moderation-notification-browser-" +
          randomUUID() +
          "@example.invalid",
        passwordHash: hash,
        firstName: role === "USER" ? "Власник" : "Адміністратор",
        role,
      },
    });
    users.push(user.id);
  }
  const owner = await db.user.findUnique({ where: { id: users[0] } }),
    admin = await db.user.findUnique({ where: { id: users[1] } });
  const species = await db.species.findUniqueOrThrow({
    where: { slug: "dog" },
  });
  location = await db.location.create({
    data: { city: "Сповіщення", region: "Тестова область", slug: randomUUID() },
  });
  async function fixture(kind, title, status) {
    const pet = await db.pet.create({
      data: { ownerId: owner.id, speciesId: species.id, gender: "MALE" },
    });
    const data = {
      petId: pet.id,
      locationId: location.id,
      title,
      description:
        "Докладний опис для перевірки повідомлення про результат модерації.",
      status: status === "APPROVED" ? "ACTIVE" : "DRAFT",
      moderationStatus: status,
      ...(status === "APPROVED" ? { publishedAt: new Date() } : {}),
    };
    return (kind === "listings" ? db.listing : db.matingListing).create({
      data:
        kind === "listings"
          ? {
              ...data,
              sellerId: owner.id,
              type: "FREE",
              images: {
                create: {
                  url: "https://res.cloudinary.com/fixture/image/upload/sample.jpg",
                },
              },
            }
          : { ...data, ownerId: owner.id },
    });
  }
  const approved = await fixture(
    "listings",
    "Оголошення для схвалення",
    "PENDING",
  );
  const rejected = await fixture(
    "listings",
    "Оголошення для виправлення",
    "PENDING",
  );
  const hidden = await fixture(
    "mating-listings",
    "Пропозиція для перевірки",
    "APPROVED",
  );
  await login(ownerPage, owner);
  await count(0);
  const adminAuth = await login(adminPage, admin);
  await decision("listings", approved, "approve");
  await refreshOwner(1);
  assert.equal(await db.notification.count({ where: { userId: owner.id } }), 1);
  await openNotification(
    "Оголошення схвалено",
    `/listings/${approved.id}/edit`,
  );
  pass(
    "A: admin approves Listing; owner navigation refetch gets badge; notification opens owned management and marks read",
  );
  const stale = await adminContext.request.post(
    `http://localhost:4000/api/v1/admin/moderation/listings/${approved.id}/approve`,
    {
      headers: {
        Authorization: "Bearer " + adminAuth.token,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": adminAuth.csrf,
      },
      data: { expectedUpdatedAt: approved.updatedAt.toISOString() },
    },
  );
  assert.equal(stale.status(), 409);
  assert.equal(await db.notification.count({ where: { userId: owner.id } }), 1);
  pass("D: stale duplicate admin action409; exactly one outcome notification");
  const rejectReason =
    "Уточніть умови передачі тварини перед повторним поданням.";
  await decision("listings", rejected, "reject", rejectReason);
  await refreshOwner(1);
  await openNotification(
    "Оголошення відхилено",
    `/listings/${rejected.id}/edit`,
  );
  await ownerPage.getByText(rejectReason, { exact: true }).waitFor();
  pass(
    "B: rejected Listing opens private editor with owner-visible reason, not unavailable public page",
  );
  const hideReason =
    "Оновіть інформацію через підтримку перед подальшою публікацією.";
  await decision("mating-listings", hidden, "hide", hideReason);
  await refreshOwner(1);
  await bell().click();
  await panel()
    .getByRole("link", { name: "Оголошення про в’язку приховано", exact: true })
    .waitFor();
  assert.equal((await panel().innerText()).includes(hideReason), false);
  for (const width of [375, 768, 1440]) {
    await ownerPage.setViewportSize({ width, height: 1000 });
    const box = await panel().boundingBox(),
      button = await bell().boundingBox();
    assert.ok(box.x >= 15 && box.x + box.width <= width - 15);
    assert.ok(button.width >= 44 && button.height >= 44);
    assert.equal(
      await ownerPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(await ownerPage.locator("select").count(), 0);
    await ownerPage.screenshot({
      path: "test-results/phase11b-panel-" + width + ".png",
    });
  }
  pass(
    "E: real moderation copy fits375/768/1440;44px bell;no overflow/native select",
  );
  const hiddenLink = panel().getByRole("link", {
    name: "Оголошення про в’язку приховано",
    exact: true,
  });
  assert.equal(
    await hiddenLink.getAttribute("href"),
    `/mating/${hidden.id}/edit`,
  );
  await hiddenLink.click();
  await ownerPage.waitForURL(`**/mating/${hidden.id}/edit`);
  await count(0);
  await ownerPage.getByText(hideReason, { exact: true }).waitFor();
  pass(
    "C: hidden MatingListing opens owner management with reason, not public404",
  );
  const rows = await db.notification.findMany({ where: { userId: owner.id } });
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.readAt !== null));
  assert.equal(await db.notification.count({ where: { userId: admin.id } }), 0);
  for (const row of rows)
    for (const secret of [admin.email, admin.id, rejectReason, hideReason])
      assert.ok(!(row.title + row.body).includes(secret));
  assert.deepEqual(errors, []);
  pass(
    "only owner receives bounded snapshots; no reason/admin leakage;0 runtime/hydration errors",
  );
} finally {
  await ownerContext.close();
  await adminContext.close();
  await browser.close();
  try {
    await db.listing.deleteMany({ where: { sellerId: { in: users } } });
    await db.matingListing.deleteMany({ where: { ownerId: { in: users } } });
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
      "test-results/phase11b-browser.json",
      JSON.stringify({ checks, errors }, null, 2),
    );
  }
}
