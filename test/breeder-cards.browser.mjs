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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const marker = randomUUID(),
  name = "000 Phase14C " + marker.slice(0, 8),
  users = [],
  breedIds = [],
  errors = [],
  checks = [],
  failures = [];
const scenarios = new Set(
  (process.env.PHASE14C_SCENARIOS || "A,B,C,D,E,F,G,H,I,X").split(","),
);
const href = "/breeders?" + new URLSearchParams({ q: name });
let location, rows, releaseImage;
const imageGate = new Promise((r) => {
  releaseImage = r;
});
page.on("pageerror", (e) => errors.push(e.message));
const apiRequests = [];
page.on("request", (r) => {
  if (r.url().includes("/api/v1/")) apiRequests.push(new URL(r.url()).pathname);
});
await page.route("**/fixture/image/upload/**", async (route) => {
  if (route.request().url().includes("phase14c-broken"))
    return route.fulfill({ status: 404, body: "" });
  await imageGate;
  return route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="#46654e"/></svg>',
  });
});
const cards = () => page.locator("a.breeder-directory-card");
const card = (index) =>
  page.locator(`a.breeder-directory-card[href='/sellers/${users[index]}']`);
const go = async (path = href) => {
  await page.goto("http://localhost:3000" + path, {
    waitUntil: "domcontentloaded",
  });
  await card(0).waitFor();
};
async function run(scenario, fn) {
  if (!scenarios.has(scenario)) return;
  try {
    await fn();
    checks.push(scenario);
    console.log("PASS " + scenario);
  } catch (e) {
    failures.push({ scenario, error: e.message });
    console.error("FAIL " + scenario + ": " + e.message);
    await page.screenshot({
      path: `test-results/phase14c-failure-${scenario}.png`,
    });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  const species = await db.species.findMany({
    where: { slug: { in: ["dog", "cat"] } },
  });
  location = await db.location.create({
    data: {
      countryCode: "UA",
      city: "Світловодськ",
      region: "Кіровоградська область",
      slug: "phase14c-" + marker,
    },
  });
  for (let i = 0; i < 6; i++) {
    const id = String(i === 5 ? "f" : i + 1) + randomUUID().slice(1);
    breedIds.push(id);
    await db.breed.create({
      data: {
        id,
        name: "Card breed " + i,
        nameUk:
          i === 1
            ? "НадзвичайноДовгаНазваПороди".repeat(5).slice(0, 150)
            : [
                "Малінуа",
                "",
                "Німецька вівчарка",
                "Лабрадор",
                "Пудель",
                "Мейн-кун",
              ][i],
        slug: `phase14c-${marker}-${i}`,
        speciesId: species.find((s) => s.slug === (i === 5 ? "cat" : "dog")).id,
      },
    });
  }
  for (let i = 0; i < 6; i++) {
    const userId = randomUUID();
    users.push(userId);
    await db.user.create({
      data: {
        id: userId,
        email: `phase14c-${marker}-${i}@example.invalid`,
        passwordHash: "fixture-only",
        firstName: "Тест",
        lastName: "Приватне",
        accountType: "BREEDER",
      },
    });
    await db.breederProfile.create({
      data: {
        userId,
        kennelName:
          i === 1
            ? (name + " НадзвичайноДовгаНазваРозплідника".repeat(8)).slice(
                0,
                160,
              )
            : name +
              " " +
              [
                "Теплі лапи",
                "",
                "Новий дім",
                "Вірний друг",
                "Дружні лапи",
                "Котячий світ",
              ][i],
        description:
          i === 2
            ? null
            : i === 0
              ? "Любов до тварин і відповідальне ставлення. ".repeat(25)
              : "Знайомтеся з нашим розплідником та його тваринами.",
        locationId: i === 2 ? null : location.id,
        breeds: {
          create: (i === 2
            ? []
            : i === 0
              ? breedIds
              : [breedIds[i === 5 ? 5 : 0]]
          ).map((breedId) => ({ breedId })),
        },
      },
    });
  }
  rows = await db.breederProfile.findMany({ where: { userId: { in: users } } });
  for (const index of [0, 3]) {
    const assetId = randomUUID(),
      profile = rows.find((r) => r.userId === users[index]);
    await db.breederMediaAsset.create({
      data: {
        id: assetId,
        ownerId: users[index],
        breederProfileId: profile.id,
        type: "LOGO",
        status: "ATTACHED",
        expiresAt: new Date(),
        publicId: `pet-platform/breeders/${users[index]}/logo/${assetId}`,
      },
    });
    await db.breederMedia.create({
      data: {
        breederProfileId: profile.id,
        assetId,
        type: "LOGO",
        url: `https://res.cloudinary.com/fixture/image/upload/phase14c-${index === 3 ? "broken" : "logo"}.png`,
        position: 0,
      },
    });
  }
  await run("A", async () => {
    await go("/breeders");
    const logo = card(0).locator(".breeder-directory-logo"),
      before = await logo.boundingBox();
    assert.equal(before.width, 56);
    assert.equal(before.height, 56);
    releaseImage();
    await page.waitForFunction((id) => {
      const img = document.querySelector(
        `a[href='/sellers/${id}'] .breeder-directory-logo img`,
      );
      return img?.complete && img.naturalWidth > 0;
    }, users[0]);
    assert.deepEqual(await logo.boundingBox(), before);
    assert.equal(await card(0).locator("img").getAttribute("loading"), "lazy");
    assert.equal(await card(0).locator("img").getAttribute("alt"), "");
    assert.ok(apiRequests.filter((p) => p === "/api/v1/breeders").length === 1);
    assert.equal(
      apiRequests.some((p) => /^\/api\/v1\/(breeders|sellers)\/[^/]+$/.test(p)),
      false,
      "no per-card API requests",
    );
  });
  releaseImage();
  await run("B", async () => {
    await go();
    const title = card(1).locator("h2");
    assert.equal((await title.textContent()).length, 160);
    assert.equal(
      await title.evaluate((el) => getComputedStyle(el).webkitLineClamp),
      "2",
    );
    assert.ok((await title.boundingBox()).height <= 55);
    assert.ok(
      (await card(1).getAttribute("aria-label")).includes(
        await title.textContent(),
      ),
    );
  });
  await run("C", async () => {
    assert.equal(
      await card(0).locator(".breeder-directory-species").textContent(),
      "Собаки та коти",
    );
    assert.equal(
      await card(0).locator(".breeder-directory-breeds li").count(),
      3,
    );
    assert.equal(
      await card(0).locator(".breeder-directory-more").textContent(),
      "+4",
    );
    assert.equal(
      await card(0)
        .locator(".breeder-directory-description")
        .evaluate((el) => getComputedStyle(el).webkitLineClamp),
      "3",
    );
    assert.ok(
      (await card(0).locator(".breeder-directory-description").boundingBox())
        .height <= 68,
    );
    assert.ok(
      (await page.locator(".breeder-directory-summary").textContent()).includes(
        "Знайдено 6 розплідників",
      ),
    );
  });
  await run("D", async () => {
    await card(3).scrollIntoViewIfNeeded();
    await card(3).locator(".breeder-directory-avatar").waitFor();
    for (const i of [2, 3]) {
      assert.equal(await card(i).locator("img").count(), 0);
      assert.equal(
        (await card(i).locator(".breeder-directory-logo").boundingBox()).width,
        56,
      );
    }
  });
  await run("E", async () => {
    for (const selector of [
      ".breeder-directory-description",
      ".breeder-directory-location",
      ".breeder-directory-breeds",
    ])
      assert.equal(await card(2).locator(selector).count(), 0);
    assert.ok(await card(2).locator(".breeder-directory-cta").isVisible());
    assert.equal(
      await page
        .locator("a.breeder-directory-card a, a.breeder-directory-card button")
        .count(),
      0,
    );
  });
  await run("F", async () => {
    await page
      .getByRole("combobox", { name: "Вид тварини", exact: true })
      .click();
    await page.getByRole("option", { name: "Кіт", exact: true }).click();
    await page.waitForURL((u) => u.searchParams.get("species") === "cat");
    await page.waitForFunction(
      () => document.querySelectorAll("a.breeder-directory-card").length === 2,
    );
    assert.ok(await card(0).isVisible());
    assert.ok(await card(5).isVisible());
    await go();
  });
  await run("G", async () => {
    await card(0).click();
    await page.waitForURL("**/sellers/" + users[0]);
    await page
      .getByRole("heading", {
        name: rows.find((r) => r.userId === users[0]).kennelName,
        exact: true,
      })
      .waitFor();
    await page.goBack();
    await card(0).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("q"), name);
  });
  await run("H", async () => {
    await go();
    for (let n = 0; n < 30; n++) {
      await page.keyboard.press("Tab");
      if (
        await page.evaluate(() =>
          document.activeElement?.classList.contains("breeder-directory-card"),
        )
      )
        break;
    }
    const focused = page.locator("a.breeder-directory-card:focus");
    assert.equal(await focused.count(), 1);
    assert.ok(
      await focused.evaluate(
        (el) => parseFloat(getComputedStyle(el).outlineWidth) >= 3,
      ),
    );
    const target = await focused.getAttribute("href");
    await page.keyboard.press("Enter");
    await page.waitForURL("**" + target);
    await page.goBack();
    await card(0).waitFor();
  });
  await run("I", async () => {
    for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await go();
      const grid = page.locator(".breeder-directory-grid");
      assert.equal(
        await grid.evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
        width <= 600 ? 1 : width < 1024 ? 2 : 3,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow ${width}`,
      );
      const heights = await cards().evaluateAll((items) =>
        items.map((el) => el.getBoundingClientRect().height),
      );
      assert.ok(
        Math.max(...heights) - Math.min(...heights) < 100,
        `unbalanced cards ${width}`,
      );
      const before = await card(0).evaluate(
        (el) => el.getBoundingClientRect().y + scrollY,
      );
      const breedInput = page.getByRole("combobox", {
        name: "Порода",
        exact: true,
      });
      await breedInput.click();
      await page.locator(".reference-results[data-motion='open']").waitFor();
      assert.equal(
        await card(0).evaluate((el) => el.getBoundingClientRect().y + scrollY),
        before,
        "overlay must not push cards",
      );
      await breedInput.press("Escape");
      await page.waitForTimeout(180);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/phase14c-${width}.png`,
        fullPage: false,
      });
      if ([320, 1440].includes(width))
        await card(0).screenshot({
          path: `test-results/phase14c-card-${width}.png`,
        });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await card(0).evaluate((el) => getComputedStyle(el).transitionProperty),
      "none",
    );
  });
  await run("X", async () => {
    await page.goto("http://localhost:3000/breeders?q=missing-" + marker);
    await page
      .getByRole("heading", {
        name: "Розплідників за цими параметрами не знайдено",
      })
      .waitFor();
    const handler = (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: {
            page: 1,
            limit: 24,
            total: 0,
            pages: 0,
            hasPublicBreeders: false,
          },
        }),
      });
    await page.route("**/api/v1/breeders?**", handler);
    await page.goto("http://localhost:3000/breeders");
    await page
      .getByRole("heading", { name: "Розплідників поки немає" })
      .waitFor();
    await page.unroute("**/api/v1/breeders?**", handler);
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    const slow = async (route) => {
      await gate;
      await route.continue();
    };
    await page.route("**/api/v1/breeders?**", slow);
    try {
      await page.goto("http://localhost:3000" + href, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".breeder-directory-skeleton").first().waitFor();
      assert.equal(
        await page.locator(".breeder-directory-skeleton").count(),
        6,
      );
      const height = (
        await page.locator(".breeder-directory-skeleton").first().boundingBox()
      ).height;
      release();
      await card(0).waitFor();
      assert.ok(Math.abs((await card(0).boundingBox()).height - height) < 90);
    } finally {
      release();
      await page.unroute("**/api/v1/breeders?**", slow);
    }
  });
  assert.deepEqual(errors, []);
} finally {
  releaseImage();
  await writeFile(
    `test-results/phase14c-browser${process.env.PHASE14C_SCENARIOS ? "-retry" : ""}.json`,
    JSON.stringify({ checks, failures, errors }, null, 2),
  );
  await browser.close();
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.breederMediaAsset.deleteMany({ where: { ownerId: { in: users } } });
  await db.breed.deleteMany({ where: { id: { in: breedIds } } });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
}
assert.deepEqual(failures, []);
