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
const db = new PrismaService();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const marker = randomUUID(),
  users = [],
  checks = [],
  failures = [],
  errors = [],
  requests = [];
const selected = new Set(
  (process.env.PHASE14D_SCENARIOS || "A,B,C,D,E,F,G,H,I").split(","),
);
const base = "http://localhost:3000";
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.url().includes("/api/v1/")) requests.push(request.url());
});
const go = async (path) => {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
};
const noOverflow = async () =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
const active = () => page.locator('.desktop-navigation a[href="/breeders"]');
const logo = () => page.locator(".site-header > .brand img");
async function run(name, fn) {
  if (!selected.has(name)) return;
  try {
    await fn();
    checks.push(name);
    console.log("PASS " + name);
  } catch (error) {
    failures.push({ name, error: error.message });
    console.error("FAIL " + name + ": " + error.message);
    await page.screenshot({
      path: `test-results/phase14d-failure-${name}.png`,
    });
  }
}
let location, breed, full, sparse, normal, incomplete;
const listingIds = [],
  matingIds = [];
try {
  await mkdir("test-results", { recursive: true });
  const species = await db.species.findUniqueOrThrow({
    where: { slug: "dog" },
  });
  location = await db.location.create({
    data: {
      countryCode: "UA",
      city: "Світловодськ",
      region: "Кіровоградська область",
      slug: "phase14d-" + marker,
    },
  });
  breed = await db.breed.findFirstOrThrow({
    where: { speciesId: species.id, isActive: true },
  });
  const hash = await require("argon2").hash("Phase14D-local-only!");
  for (const [i, accountType] of [
    "BREEDER",
    "BREEDER",
    "SELLER",
    "BREEDER",
  ].entries()) {
    const user = await db.user.create({
      data: {
        email: `phase14d-${marker}-${i}@example.invalid`,
        passwordHash: hash,
        firstName: "Олександр",
        lastName: "Єпік",
        phone: i === 0 ? "+380" + String(Date.now()).slice(-9) : null,
        accountType,
      },
    });
    users.push(user.id);
  }
  [full, sparse, normal, incomplete] = users;
  const kennel = "Теплі лапи " + marker;
  await db.breederProfile.create({
    data: {
      userId: full,
      kennelName: kennel,
      description: "Публічний опис нашого розплідника.",
      locationId: location.id,
      breeds: { create: { breedId: breed.id } },
    },
  });
  await db.breederProfile.create({
    data: { userId: sparse, kennelName: "Тихий дім " + marker },
  });
  const pets = [];
  for (const [name, visibility, showOnBreederProfile] of [
    ["Публічна Луна", "PUBLIC", true],
    ["Публічний Рекс", "PUBLIC", true],
    ["PRIVATE_PET", "PRIVATE", false],
    ["NO_CONSENT_PET", "PUBLIC", false],
  ]) {
    pets.push(
      await db.pet.create({
        data: {
          ownerId: full,
          speciesId: species.id,
          breedId: breed.id,
          name,
          gender: "MALE",
          visibility,
          showOnBreederProfile,
          healthNotes: "PRIVATE_HEALTH",
          description: "Публічний опис тварини",
        },
      }),
    );
  }
  const assetId = randomUUID();
  const photo = await db.petImageAsset.create({
    data: {
      ownerId: full,
      petId: pets[0].id,
      id: assetId,
      publicId: `pet-platform/pets/${full}/profile/${assetId}`,
      url: "https://res.cloudinary.com/fixture/image/upload/pet-profile.png",
      status: "ATTACHED",
      expiresAt: new Date(),
    },
  });
  await db.pet.update({
    where: { id: pets[0].id },
    data: { profileImageAssetId: photo.id },
  });
  for (const [i, status, moderationStatus] of [
    [0, "ACTIVE", "APPROVED"],
    [1, "DRAFT", "NOT_SUBMITTED"],
    [2, "ACTIVE", "REJECTED"],
    [3, "HIDDEN", "APPROVED"],
    [4, "ARCHIVED", "APPROVED"],
  ]) {
    const pet =
      i === 0
        ? pets[1]
        : await db.pet.create({
            data: { ownerId: full, speciesId: species.id, gender: "MALE" },
          });
    const listing = await db.listing.create({
      data: {
        sellerId: full,
        petId: pet.id,
        locationId: location.id,
        type: "SALE",
        status,
        moderationStatus,
        title: i === 0 ? "Публічне оголошення" : "PRIVATE_LISTING_" + i,
        description: "Опис оголошення",
        price: 1000,
        publishedAt: new Date(),
        images: {
          create: {
            url: "https://res.cloudinary.com/fixture/image/upload/listing-cover.png",
          },
        },
      },
    });
    listingIds.push(listing.id);
    const mating = await db.matingListing.create({
      data: {
        ownerId: full,
        petId: pet.id,
        locationId: location.id,
        status,
        moderationStatus,
        title: i === 0 ? "Публічна в’язка" : "PRIVATE_MATING_" + i,
        description: "Опис пропозиції",
        publishedAt: new Date(),
      },
    });
    matingIds.push(mating.id);
  }
  await page.route("https://res.cloudinary.com/fixture/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#55755c"/></svg>',
    }),
  );
  const href =
    "/breeders?" +
    new URLSearchParams({
      q: marker,
      species: "dog",
      breedId: breed.id,
      locationId: location.id,
    });
  const detail = "/sellers/" + full;
  await run("A", async () => {
    await go(href);
    const card = page.locator(
      'a.breeder-directory-card[href="' + detail + '"]',
    );
    await card.waitFor();
    assert.ok((await card.innerText()).includes("Світловодськ"));
    await card.click();
    await page.waitForURL("**" + detail);
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("h1").innerText(), kennel);
    assert.equal(await page.locator(".breeder-identity").count(), 1);
    assert.equal(
      await page.locator(".breeder-profile-header .breeder-breed-list").count(),
      1,
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('.desktop-navigation a[href="/breeders"]')
          ?.getAttribute("aria-current") === "page",
    );
    assert.equal(
      await page
        .locator(
          '.site-header a[href="/account"][aria-current], .site-header a[href="/my-listings"][aria-current]',
        )
        .count(),
      0,
    );
  });
  await run("B", async () => {
    await page.goBack();
    await page.waitForLoadState("networkidle");
    assert.equal(page.url(), base + href);
    assert.equal(
      await page
        .locator('a.breeder-directory-card[href="' + detail + '"]')
        .count(),
      1,
    );
    await page.goForward();
    await page.waitForLoadState("networkidle");
    assert.equal(page.url(), base + detail);
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert.equal(await active().getAttribute("aria-current"), "page");
  });
  await run("C", async () => {
    await go(detail);
    assert.equal(await page.locator(".breeder-animal-card").count(), 2);
    assert.ok(
      (
        await page
          .locator('[data-pet-id="' + pets[0].id + '"] img')
          .getAttribute("src")
      ).includes("pet-profile.png"),
    );
    assert.ok(
      (
        await page
          .locator('[data-pet-id="' + pets[1].id + '"] img')
          .getAttribute("src")
      ).includes("listing-cover.png"),
    );
    assert.equal(
      await page
        .locator(".breeder-public-animals a[href^='/listings/']")
        .count(),
      0,
    );
    const html = await page.locator("main").innerText();
    for (const forbidden of [
      "PRIVATE_PET",
      "NO_CONSENT_PET",
      "PRIVATE_HEALTH",
      "PRIVATE_LISTING",
      "PRIVATE_MATING",
      "@example.invalid",
    ])
      assert.ok(!html.includes(forbidden), forbidden);
    assert.equal(
      await page
        .getByRole("button", { name: "Показати телефон", exact: true })
        .count(),
      0,
    );
  });
  await run("D", async () => {
    await go(detail);
    assert.equal(
      await page.locator(".seller-profile-listings .listing-card").count(),
      1,
    );
    assert.equal(
      await page
        .locator(
          `.seller-profile-listings a[href="/listings/${listingIds[0]}"]`,
        )
        .count(),
      1,
    );
    for (const id of listingIds.slice(1))
      assert.equal(await page.locator(`a[href="/listings/${id}"]`).count(), 0);
  });
  await run("E", async () => {
    await go(detail);
    assert.equal(
      await page
        .locator(`.profile-mating-section a[href^="/mating/${matingIds[0]}"]`)
        .count(),
      1,
    );
    for (const id of matingIds.slice(1))
      assert.equal(await page.locator(`a[href^="/mating/${id}"]`).count(), 0);
    const headings = await page.locator(".seller-profile h2").allTextContents();
    for (const [first, next] of [
      ["Наші тварини", "Оголошення розплідника"],
      ["Оголошення розплідника", "Оголошення про в’язку"],
      ["Оголошення про в’язку", "Відгуки"],
    ])
      assert.ok(
        headings.indexOf(first) < headings.indexOf(next),
        headings.join(" | "),
      );
    const sectionCalls = requests.filter((url) => url.includes(full));
    assert.ok(
      !sectionCalls.some((url) => /\/profile|\/my-|\/pet-care/.test(url)),
    );
    await page.screenshot({
      path: "test-results/phase14d-profile-1440.png",
      fullPage: true,
    });
  });
  await run("F", async () => {
    await go("/sellers/" + sparse);
    assert.equal(
      await page
        .locator(
          ".breeder-public-animals, .profile-mating-section, .breeder-contacts, .breeder-cover, .breeder-breed-list",
        )
        .count(),
      0,
    );
    assert.ok(
      (await page.locator("main").innerText()).includes(
        "поки немає активних оголошень",
      ),
    );
    for (const id of [normal, incomplete]) {
      await go("/sellers/" + id);
      assert.equal(await active().getAttribute("aria-current"), null);
      assert.equal(await page.locator("h1").innerText(), "Олександр Єпік");
    }
  });
  await run("G", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await go(detail);
    const trigger = page.getByRole("button", {
      name: "Відкрити меню",
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Меню", exact: true });
    await dialog.waitFor({ state: "visible" });
    assert.equal(
      await dialog.locator('a[href="/breeders"]').getAttribute("aria-current"),
      "page",
    );
    assert.equal(await dialog.locator(".brand-logo").count(), 1);
    await page.keyboard.press("Escape");
    assert.equal(
      await trigger.evaluate((node) => node === document.activeElement),
      true,
    );
  });
  await run("H", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/", "/login", detail]) {
      await go(path);
      assert.equal(await logo().getAttribute("alt"), "Лапа");
      assert.ok(
        await logo().evaluate((img) => img.complete && img.naturalWidth > 0),
      );
      assert.equal(await page.locator(".site-footer .brand-logo").count(), 1);
      assert.equal(await page.locator(".brand-mark, .brand-dot").count(), 0);
      const box = await logo().boundingBox();
      assert.ok(Math.abs(box.width / box.height - 1442 / 318) < 0.01);
    }
    for (const rel of ["icon", "apple-touch-icon"])
      assert.ok(await page.locator('link[rel="' + rel + '"]').count());
  });
  await run("I", async () => {
    for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
      await go(detail);
      await noOverflow();
      const box = await logo().boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      await page.screenshot({ path: `test-results/phase14d-${width}.png` });
      await go("/");
      await noOverflow();
      assert.ok(
        await page
          .locator(".site-footer")
          .evaluate(
            (node) => node.getBoundingClientRect().bottom <= innerHeight + 1,
          ),
        "homepage footer " + width,
      );
    }
    // Exercise authenticated header/menu using a real local session, without any profile edits.
    await go("/login");
    await page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(`phase14d-${marker}-2@example.invalid`);
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("Phase14D-local-only!");
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL("**/account");
    for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await go(detail);
      await noOverflow();
      assert.equal(await active().getAttribute("aria-current"), "page");
      if (width >= 1280) {
        const rects = await page
          .locator(".desktop-navigation > a")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getBoundingClientRect().y),
          );
        assert.ok(
          Math.max(...rects) - Math.min(...rects) < 15,
          "header wrap " + width,
        );
      }
    }
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `test-results/phase14d-browser${process.env.PHASE14D_SCENARIOS ? "-retry" : ""}.json`,
    JSON.stringify({ checks, failures, errors }, null, 2),
  );
  await browser.close();
  await db.listing.deleteMany({ where: { sellerId: { in: users } } });
  await db.matingListing.deleteMany({ where: { ownerId: { in: users } } });
  await db.pet.deleteMany({ where: { ownerId: { in: users } } });
  await db.petImageAsset.deleteMany({ where: { ownerId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
}
assert.deepEqual(failures, []);
