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
const ownerContext = await browser.newContext(),
  otherContext = await browser.newContext();
const page = await ownerContext.newPage(),
  otherPage = await otherContext.newPage();
const users = [],
  pets = [],
  assets = [],
  checks = [],
  errors = [],
  requests = [];
let location;
for (const p of [page, otherPage]) {
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route(/res\.cloudinary\.com\/fixture\/image\/upload\//, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#dfe8d8"/><circle cx="48" cy="40" r="19" fill="#68795e"/><path d="M22 85Q22 56 48 56Q74 56 74 85" fill="#68795e"/></svg>',
    }),
  );
}
page.on("request", (r) => {
  if (r.method() === "GET" && /\/api\/v1\/pets\/[^/]+\/care$/.test(r.url()))
    requests.push(r.url());
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (p, path) => {
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
async function responsive(label) {
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
    await page.screenshot({
      path: `test-results/phase12a-${label}-${width}.png`,
      fullPage: true,
    });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  const password = "Fixture-" + randomUUID(),
    passwordHash = await require("argon2").hash(password);
  for (const firstName of ["Власник", "Інший"])
    users.push(
      await db.user.create({
        data: {
          email: "pet-care-browser-" + randomUUID() + "@example.invalid",
          firstName,
          lastName: "Фікстура",
          passwordHash,
        },
      }),
    );
  const [owner, other] = users;
  const species = await db.species.findUniqueOrThrow({
      where: { slug: "dog" },
    }),
    breed = await db.breed.findFirst({
      where: { speciesId: species.id, isActive: true },
      orderBy: { id: "asc" },
    });
  for (const data of [
    {
      ownerId: owner.id,
      name: "Локі PRIVATE_12A_A",
      gender: "MALE",
      birthDate: new Date("2025-07-14"),
      breedId: breed?.id,
      healthNotes: "PRIVATE_HEALTH_NOT_DASHBOARD",
      chipNumber: randomUUID(),
      vaccinated: true,
    },
    { ownerId: owner.id, name: "Сімба PRIVATE_12A_ARCHIVED", gender: "MALE" },
    { ownerId: owner.id, name: null, gender: "UNKNOWN" },
    { ownerId: other.id, name: "Міра PRIVATE_12A_B", gender: "FEMALE" },
  ])
    pets.push(
      await db.pet.create({ data: { speciesId: species.id, ...data } }),
    );
  const [named, archived, minimal, otherPet] = pets;
  location = await db.location.create({
    data: { city: "Догляд", region: "Тест", slug: randomUUID() },
  });
  await db.listing.create({
    data: {
      sellerId: owner.id,
      petId: archived.id,
      locationId: location.id,
      type: "FREE",
      title: "Архівна пропозиція",
      description: "Опис",
      status: "ARCHIVED",
      moderationStatus: "HIDDEN",
    },
  });
  const imageId = randomUUID();
  const asset = await db.petImageAsset.create({
    data: {
      id: imageId,
      ownerId: owner.id,
      petId: named.id,
      publicId: `pet-platform/pets/${owner.id}/profile/${imageId}`,
      url: "https://res.cloudinary.com/fixture/image/upload/care.jpg",
      status: "ATTACHED",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  assets.push(asset.id);
  await db.pet.update({
    where: { id: named.id },
    data: { profileImageAssetId: asset.id },
  });
  if (process.env.PHASE12A_BROWSER_RESUME !== "after-anonymous") {
    // Anonymous return is private and preserves only the safe existing route.
    await go(page, "/pets/" + named.id + "/care");
    await page.waitForURL("**/login?*");
    assert.equal(
      new URL(page.url()).searchParams.get("returnTo"),
      "/pets/" + named.id + "/care",
    );
    assert.equal(await page.getByText(named.name, { exact: true }).count(), 0);
    await page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(owner.email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL("**/pets/" + named.id + "/care");
    await page
      .getByRole("heading", { name: named.name, exact: true })
      .waitFor();
    pass(
      "anonymous → login with exact safe care return; owner restoration loads private identity",
    );
  } else {
    await login(page, owner, password);
  }
  await go(page, "/pets");
  await page.bringToFront();
  const card = page.locator("article.pet-card").filter({
    has: page.getByRole("heading", { name: named.name, exact: true }),
  });
  await card.waitFor();
  const careLink = card.getByRole("link", { name: "Догляд", exact: true });
  assert.ok((await careLink.boundingBox()).height >= 43.5);
  const before = requests.length;
  await careLink.click();
  await page.waitForURL("**/pets/" + named.id + "/care");
  const main = page.locator("main.pet-care-page");
  await main.getByRole("heading", { name: named.name, exact: true }).waitFor();
  assert.equal(requests.length - before, 1);
  assert.equal(
    await main.getByRole("img", { name: named.name, exact: true }).count(),
    1,
  );
  assert.equal(
    await main
      .getByText("PRIVATE_HEALTH_NOT_DASHBOARD", { exact: true })
      .count(),
    0,
  );
  assert.equal(
    await main
      .getByText("Записів про вакцинацію ще немає", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await main
      .locator(
        'a[href*="reminder"],a[href*="vaccination"],a[href*="medication"]',
      )
      .count(),
    0,
  );
  await responsive("named");
  await main
    .getByRole("link", { name: "Редагувати профіль", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Редагувати тварину", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Догляд", exact: true }).click();
  await page.getByRole("heading", { name: named.name, exact: true }).waitFor();
  pass(
    "A: My Pets/editor owner actions → dashboard; one care request, attached photo, breed/name/age and no health/chip/medical records;375/768/1440",
  );
  assert.equal(await db.listing.count({ where: { petId: named.id } }), 0);
  assert.equal(await db.matingListing.count({ where: { petId: named.id } }), 0);
  await go(page, "/pets/" + archived.id + "/care");
  await page
    .getByRole("heading", { name: archived.name, exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Історія догляду", exact: true })
      .count(),
    1,
  );
  pass(
    "B: completely private Pet without Listing and Pet with archived/hidden offer both accessible; no publication dependency",
  );
  await go(page, "/pets/" + minimal.id + "/care");
  await page.getByRole("heading", { name: "Собака", exact: true }).waitFor();
  assert.equal(
    await page
      .locator("main")
      .getByRole("img", { name: /Фото тварини відсутнє/ })
      .count(),
    1,
  );
  const optionalText = await page.locator("main").innerText();
  assert.ok(optionalText.includes("Не вказано"));
  assert.ok(!/Без імені|undefined|\bnull\b/.test(optionalText));
  await responsive("optional");
  pass(
    "E: missing name/photo/birthDate/breed remains clean with natural species fallback, no invented name or data;375/768/1440",
  );
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const careUrl = "**/api/v1/pets/" + named.id + "/care";
  await page.route(careUrl, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("http://localhost:3000/pets/" + named.id + "/care");
  await page
    .getByRole("status", { name: "Завантажуємо догляд за твариною" })
    .waitFor();
  assert.equal(
    await page.getByRole("heading", { name: named.name, exact: true }).count(),
    0,
  );
  release();
  await page.getByRole("heading", { name: named.name, exact: true }).waitFor();
  await page.unroute(careUrl);
  await page.route(careUrl, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "PRIVATE RAW ERROR" }),
    }),
  );
  await go(page, "/pets/" + named.id + "/care");
  await page
    .getByRole("heading", {
      name: "Не вдалося завантажити дані тварини.",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByText("PRIVATE RAW ERROR", { exact: true }).count(),
    0,
  );
  await page.unroute(careUrl);
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await page.getByRole("heading", { name: named.name, exact: true }).waitFor();
  const back = page.getByRole("link", { name: "До моїх тварин", exact: true });
  await back.focus();
  assert.equal(
    await back.evaluate((el) => el === document.activeElement),
    true,
  );
  assert.equal(await back.locator('svg[aria-hidden="true"]').count(), 1);
  pass(
    "loading skeleton → identity; safe error/retry hides raw content; labelled SVG back link and keyboard focus",
  );
  await login(otherPage, other, password);
  await go(otherPage, "/pets/" + named.id + "/care");
  await otherPage
    .getByRole("heading", {
      name: "Тварину не знайдено або у вас немає доступу.",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await otherPage.getByText(named.name, { exact: true }).count(),
    0,
  );
  assert.equal(
    await otherPage
      .getByRole("heading", { name: "Нагадування", exact: true })
      .count(),
    0,
  );
  pass(
    "C: non-owner direct URL conceals existence/metadata and all care content",
  );
  await go(page, "/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await login(page, other, password);
  await go(page, "/pets/" + otherPet.id + "/care");
  await page
    .getByRole("heading", { name: otherPet.name, exact: true })
    .waitFor();
  assert.equal(await page.getByText(named.name, { exact: true }).count(), 0);
  await go(page, "/pets/" + named.id + "/care");
  await page
    .getByRole("heading", {
      name: "Тварину не знайдено або у вас немає доступу.",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByText(named.name, { exact: true }).count(), 0);
  pass(
    "D: owner A Care → logout → B own Care → A direct denial; no previous-owner identity/cache remains",
  );
  assert.deepEqual(errors, []);
  pass("F: no runtime/hydration errors, native selects or horizontal overflow");
} finally {
  await ownerContext.close();
  await otherContext.close();
  await browser.close();
  const petIds = pets.map((p) => p.id),
    userIds = users.map((u) => u.id);
  await db.pet.updateMany({
    where: { id: { in: petIds } },
    data: { profileImageAssetId: null },
  });
  await db.petImageAsset.deleteMany({ where: { id: { in: assets } } });
  await db.listing.deleteMany({ where: { petId: { in: petIds } } });
  await db.matingListing.deleteMany({ where: { petId: { in: petIds } } });
  await db.pet.deleteMany({ where: { id: { in: petIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
  await writeFile(
    "test-results/phase12a-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
