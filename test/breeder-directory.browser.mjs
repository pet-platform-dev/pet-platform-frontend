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
const db = new PrismaService();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
const widths = [320, 375, 430, 768, 1024, 1280, 1440],
  errors = [],
  checks = [],
  failures = [],
  users = [],
  marker = randomUUID(),
  password = "Directory14A-Local-Only!";
const selected = new Set(
  (process.env.PHASE14A_SCENARIOS || "A,B,C,D,E,F,G,H,I").split(","),
);
let location, breed, viewer, rows, anonymous, asset;
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
};
const loaded = async () => {
  await page.locator("a.breeder-directory-card").first().waitFor();
};
const noOverflow = async (label) =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    label,
  );
const ids = () =>
  page
    .locator("a.breeder-directory-card")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
async function run(name, fn) {
  if (!selected.has(name)) return;
  try {
    await fn();
    checks.push(name);
    console.log("PASS " + name);
  } catch (e) {
    failures.push({ name, error: e.message });
    console.error("FAIL " + name + ": " + e.message);
    await page.screenshot({
      path: "test-results/phase14a-failure-" + name + ".png",
    });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  const hash = await require("argon2").hash(password),
    species = await db.species.findUniqueOrThrow({ where: { slug: "dog" } });
  location = await db.location.create({
    data: {
      countryCode: "UA",
      city: "Наддовгенайменуванняміста".repeat(5).slice(0, 140),
      region: "Наддовгенайменуванняобласті".repeat(5).slice(0, 140),
      slug: "phase14a-" + marker,
    },
  });
  breed = await db.breed.create({
    data: {
      name: "Phase14A breed " + marker,
      nameUk: "Довгенайменуванняпороди".repeat(6).slice(0, 140),
      slug: "phase14a-" + marker,
      speciesId: species.id,
      isActive: true,
    },
  });
  const people = Array.from({ length: 28 }, (_, i) => ({
    id: randomUUID(),
    email: `phase14a-browser-${marker}-${i}@example.invalid`,
    passwordHash: hash,
    firstName: "Тест",
    lastName: "Каталогу",
    accountType: i >= 26 ? "SELLER" : "BREEDER",
  }));
  users.push(...people.map((p) => p.id));
  viewer = people[27];
  await db.user.createMany({ data: people });
  rows = people.slice(0, 25).map((u, i) => ({
    userId: u.id,
    kennelName: (
      `000 Phase14A ${marker} ${String(i).padStart(2, "0")} ` +
      "НаддовгаНазваРозплідника".repeat(5)
    ).slice(0, 160),
    description: "Публічний опис розплідника. ".repeat(15),
    locationId: location.id,
  }));
  await db.breederProfile.createMany({
    data: [...rows, { userId: people[26].id, kennelName: "PRIVATE_PHASE14A" }],
  });
  const profiles = await db.breederProfile.findMany({
    where: { userId: { in: rows.map((p) => p.userId) } },
    select: { id: true, userId: true },
  });
  await db.breederProfileBreed.createMany({
    data: profiles.map((p) => ({ breederProfileId: p.id, breedId: breed.id })),
  });
  const profile = profiles.find((p) => p.userId === rows[0].userId),
    assetId = randomUUID();
  asset = await db.breederMediaAsset.create({
    data: {
      id: assetId,
      ownerId: rows[0].userId,
      breederProfileId: profile.id,
      type: "LOGO",
      status: "ATTACHED",
      expiresAt: new Date(),
      publicId: `pet-platform/breeders/${rows[0].userId}/logo/${assetId}`,
    },
  });
  await db.breederMedia.create({
    data: {
      breederProfileId: profile.id,
      type: "LOGO",
      assetId: asset.id,
      url: "https://res.cloudinary.com/fixture/image/upload/phase14a-logo.png",
      position: 0,
    },
  });
  await db.pet.create({
    data: {
      ownerId: rows[0].userId,
      speciesId: species.id,
      name: "PRIVATE_PHASE14A_PET",
      healthNotes: "PRIVATE_PHASE14A_HEALTH",
    },
  });
  await page.route("https://res.cloudinary.com/fixture/**", (route) =>
    route.fulfill({ status: 404, body: "missing test logo" }),
  );
  await run("A", async () => {
    await go("/");
    const calls = [];
    const track = (r) => {
      if (r.url().includes("/api/v1/breeders?")) calls.push(r.url());
    };
    page.on("request", track);
    await page.getByRole("link", { name: "Розплідники", exact: true }).click();
    await page.waitForURL("**/breeders");
    await loaded();
    assert.equal(
      await page
        .getByRole("heading", { level: 1, name: "Розплідники" })
        .count(),
      1,
    );
    assert.equal(await page.locator(".breeder-directory-card").count(), 24);
    assert.equal(calls.length, 1);
    page.off("request", track);
    assert.equal(
      await page
        .locator('.desktop-navigation a[href="/breeders"]')
        .getAttribute("aria-current"),
      "page",
    );
  });
  await run("B", async () => {
    await go("/breeders");
    await loaded();
    const first = (await ids())[0];
    await page.locator("a.breeder-directory-card").first().click();
    await page.waitForURL("**" + first);
    await page
      .getByRole("heading", { level: 1, name: rows[0].kennelName, exact: true })
      .waitFor();
    assert.equal(
      await page
        .locator('.site-header a[href="/account"][aria-current="page"]')
        .count(),
      0,
    );
    await page.goBack();
    await page.waitForURL("**/breeders");
    await loaded();
  });
  await run("D", async () => {
    const a = await page.request.get(
      "http://localhost:4000/api/v1/breeders?limit=24",
    );
    assert.equal(a.status(), 200);
    anonymous = await a.json();
    assert.equal(anonymous.data.length, 24);
    const text = JSON.stringify(anonymous);
    for (const value of [
      "PRIVATE_PHASE14A",
      "passwordHash",
      "phone",
      "email",
      "healthNotes",
      "contactPerson",
    ])
      assert.ok(!text.includes(value));
    assert.ok(anonymous.data.some((p) => p.userId === rows[0].userId));
    assert.ok(
      !anonymous.data.some(
        (p) => p.userId === people[25].id || p.userId === people[26].id,
      ),
    );
  });
  await run("E", async () => {
    await go("/breeders");
    await loaded();
    await page.locator(".breeder-directory-avatar").first().waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow("cards " + width);
      assert.equal(await page.locator("select").count(), 0);
      const columns = await page
        .locator(".breeder-directory-grid")
        .evaluate(
          (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
        );
      assert.equal(columns, width <= 600 ? 1 : width <= 1023 ? 2 : 3);
      if ([320, 375, 768, 1440].includes(width))
        await page.screenshot({
          path: `test-results/phase14a-directory-${width}.png`,
        });
    }
    await page.locator("a.breeder-directory-card").first().focus();
    assert.notEqual(
      await page
        .locator("a.breeder-directory-card")
        .first()
        .evaluate((e) => getComputedStyle(e).outlineStyle),
      "none",
    );
  });
  await run("F", async () => {
    await go("/breeders");
    await loaded();
    const first = await ids();
    await page
      .getByRole("navigation", { name: "Сторінки розплідників" })
      .getByRole("link", { name: "Далі" })
      .click();
    await page.waitForURL("**/breeders?page=2");
    await loaded();
    const second = await ids();
    assert.equal(first.filter((id) => second.includes(id)).length, 0);
    await page.reload();
    await loaded();
    assert.deepEqual(await ids(), second);
    await page
      .getByRole("navigation", { name: "Сторінки розплідників" })
      .getByRole("link", { name: "Назад" })
      .click();
    await page.waitForURL("**/breeders");
    await loaded();
    assert.deepEqual(await ids(), first);
  });
  await run("G", async () => {
    await page.setViewportSize({ width: 375, height: 700 });
    await go("/");
    await page.getByRole("button", { name: "Відкрити меню" }).click();
    const menu = page.getByRole("dialog", { name: "Меню" });
    await menu.getByRole("link", { name: "Розплідники", exact: true }).click();
    await page.waitForURL("**/breeders");
    await loaded();
    assert.equal(
      await page
        .locator("dialog.mobile-navigation-dialog")
        .evaluate((e) => e.open),
      false,
    );
    assert.equal(
      await page.locator("body").evaluate((e) => e.style.overflow),
      "",
    );
    await page.getByRole("button", { name: "Відкрити меню" }).click();
    assert.equal(
      await page
        .getByRole("dialog", { name: "Меню" })
        .getByRole("link", { name: "Розплідники", exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    await page.keyboard.press("Escape");
  });
  await run("C", async () => {
    await go("/login");
    await page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(viewer.email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL("**/account");
    await go("/breeders");
    await loaded();
    const current = await (
      await page.request.get("http://localhost:4000/api/v1/breeders?limit=24")
    ).json();
    if (anonymous) assert.deepEqual(current, anonymous);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow("authenticated header " + width);
    }
    assert.equal(
      await page.getByRole("link", { name: /Повідомлення/ }).count(),
      1,
    );
  });
  await run("H", async () => {
    await go("/breeders");
    await loaded();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".breeder-directory-card")
        .first()
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await noOverflow("matrix " + width);
      assert.equal(await page.locator("select").count(), 0);
    }
    assert.deepEqual(errors, []);
  });
  await run("I", async () => {
    const extra = await browser.newContext(),
      p = await extra.newPage();
    try {
      let mode = "empty";
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      await p.route("**/api/v1/breeders?*", async (route) => {
        if (mode === "loading") await gate;
        if (mode === "success") return route.continue();
        return route.fulfill({
          status: mode === "error" ? 500 : 200,
          contentType: "application/json",
          body: JSON.stringify(
            mode === "error"
              ? { message: "PRIVATE SQL" }
              : { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
          ),
        });
      });
      await p.goto("http://localhost:3000/breeders");
      await p.getByText("Розплідників поки немає", { exact: true }).waitFor();
      mode = "loading";
      await p.reload({ waitUntil: "domcontentloaded" });
      await p
        .getByRole("status", { name: "Завантажуємо розплідники" })
        .waitFor();
      assert.equal(await p.locator(".breeder-directory-skeleton").count(), 6);
      mode = "error";
      release();
      await p
        .getByText("Не вдалося завантажити розплідники.", { exact: true })
        .waitFor({ timeout: 30000 });
      assert.ok(!(await p.locator("body").innerText()).includes("PRIVATE SQL"));
      mode = "success";
      await p.getByRole("button", { name: "Спробувати ще раз" }).click();
      await p.locator(".breeder-directory-card").first().waitFor();
    } finally {
      await extra.close();
    }
  });
} finally {
  await db.pet.deleteMany({ where: { ownerId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.breederMediaAsset.deleteMany({ where: { ownerId: { in: users } } });
  if (breed) await db.breed.delete({ where: { id: breed.id } });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
  await browser.close();
  await writeFile(
    "test-results/phase14a-browser" +
      (process.env.PHASE14A_SCENARIOS ? "-retry" : "") +
      ".json",
    JSON.stringify({ checks, failures, errors }, null, 2),
  );
}
if (failures.length || errors.length) process.exitCode = 1;
