import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
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
});
const page = await context.newPage();
const marker = randomUUID(),
  name = "Роял14Б" + marker.slice(0, 8),
  users = [],
  checks = [],
  failures = [],
  errors = [];
const scenarios = new Set(
  (process.env.PHASE14B_SCENARIOS || "A,B,C,D,E,F,G,H,I").split(","),
);
let breed, catBreed, location, filteredUrl;
const cards = () => page.locator("a.breeder-directory-card");
const search = () =>
  page.getByRole("searchbox", { name: "Пошук", exact: true });
const loaded = () => cards().first().waitFor();
const go = async (path) => {
  await page.goto("http://localhost:3000" + path);
  await loaded();
};
const selected = (text) =>
  page.locator(".selected-breed strong").filter({ hasText: text }).waitFor();
const waitParam = (key, value) =>
  page.waitForURL((url) => url.searchParams.get(key) === value);
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
      path: `test-results/phase14b-failure-${scenario}.png`,
    });
  }
}
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mkdir("test-results", { recursive: true });
  const dog = await db.species.findUniqueOrThrow({ where: { slug: "dog" } });
  const cat = await db.species.findUniqueOrThrow({ where: { slug: "cat" } });
  breed = await db.breed.create({
    data: {
      name: "Phase14B " + marker,
      nameUk: "Порода14Б" + marker.slice(0, 8) + " довга назва ".repeat(7),
      slug: "phase14b-" + marker,
      speciesId: dog.id,
    },
  });
  catBreed = await db.breed.create({
    data: {
      name: "Cat14B " + marker,
      nameUk: "Котяча14Б" + marker.slice(0, 8),
      slug: "phase14b-cat-" + marker,
      speciesId: cat.id,
    },
  });
  location = await db.location.create({
    data: {
      city: "Світло14Б" + marker.slice(0, 8) + " довга назва ".repeat(7),
      region: "Тестова область",
      district: "Контекстний",
      community: "Контекстна",
      slug: "phase14b-" + marker,
      countryCode: "UA",
    },
  });
  const people = Array.from({ length: 26 }, (_, i) => ({
    id: randomUUID(),
    email: `phase14b-${marker}-${i}@example.invalid`,
    passwordHash: "fixture-no-login",
    firstName: "Тест",
    lastName: "Приватне",
    accountType: "BREEDER",
  }));
  users.push(...people.map((p) => p.id));
  await db.user.createMany({ data: people });
  for (const [i, user] of people.entries())
    await db.breederProfile.create({
      data: {
        userId: user.id,
        kennelName: `${name} ${String(i).padStart(2, "0")}`,
        locationId: location.id,
        breeds: { create: { breedId: i === 25 ? catBreed.id : breed.id } },
      },
    });
  filteredUrl = `/breeders?${new URLSearchParams({ q: name, species: "dog", breedId: breed.id, locationId: location.id })}`;
  await run("A", async () => {
    await go("/breeders");
    const requests = [];
    const onRequest = (req) => {
      if (
        new URL(req.url()).pathname === "/api/v1/breeders" &&
        req.method() === "GET"
      )
        requests.push(req.url());
    };
    await page.waitForLoadState("networkidle");
    page.on("request", onRequest);
    try {
      await search().pressSequentially(name, { delay: 20 });
      assert.equal(requests.length, 0, "search must debounce");
      await waitParam("q", name);
      await loaded();
      await page.waitForLoadState("networkidle");
      assert.equal(requests.length, 1);
      assert.equal(await cards().count(), 24);
      assert.ok(
        (await cards().allTextContents()).every((t) => t.includes(name)),
      );
    } finally {
      page.off("request", onRequest);
    }
  });
  await run("B", async () => {
    await go(`/breeders?q=${encodeURIComponent(name)}`);
    await page
      .getByRole("combobox", { name: "Вид тварини", exact: true })
      .click();
    await page.getByRole("option", { name: "Собака", exact: true }).click();
    await waitParam("species", "dog");
    const breedRequests = [];
    const handler = (req) => {
      if (new URL(req.url()).pathname === "/api/v1/breeds")
        breedRequests.push(req.url());
    };
    page.on("request", handler);
    try {
      await page
        .getByRole("combobox", { name: "Порода", exact: true })
        .fill("Порода14Б" + marker.slice(0, 8));
      await page.getByRole("option").filter({ hasText: breed.nameUk }).click();
      await waitParam("breedId", breed.id);
      await selected(breed.nameUk);
      assert.ok(
        breedRequests.length &&
          breedRequests.every(
            (url) => new URL(url).searchParams.get("species") === "dog",
          ),
      );
    } finally {
      page.off("request", handler);
    }
    await page
      .getByRole("combobox", { name: "Вид тварини", exact: true })
      .click();
    await page.getByRole("option", { name: "Кіт", exact: true }).click();
    await waitParam("species", "cat");
    assert.equal(new URL(page.url()).searchParams.has("breedId"), false);
    await loaded();
    assert.equal(await cards().count(), 1);
  });
  await run("C", async () => {
    await go(
      `/breeders?${new URLSearchParams({ q: name, species: "dog", breedId: breed.id })}`,
    );
    await page
      .getByRole("combobox", { name: "Місто", exact: true })
      .fill("Світло14Б" + marker.slice(0, 8));
    await page.getByRole("option").filter({ hasText: location.city }).click();
    await waitParam("locationId", location.id);
    await selected(location.city);
    await loaded();
    assert.equal(await cards().count(), 24);
    await page.getByRole("link", { name: "Далі", exact: true }).click();
    await waitParam("page", "2");
    await loaded();
    assert.equal(await cards().count(), 1);
    for (const key of ["q", "species", "breedId", "locationId"])
      assert.equal(
        new URL(page.url()).searchParams.get(key),
        new URL(filteredUrl, "http://localhost").searchParams.get(key),
      );
    await page.reload();
    await loaded();
    await selected(breed.nameUk);
    await selected(location.city);
  });
  await run("D", async () => {
    const fresh = await browser.newContext();
    try {
      const p = await fresh.newPage();
      await p.goto("http://localhost:3000" + filteredUrl);
      await p.locator("a.breeder-directory-card").first().waitFor();
      assert.equal(
        await p
          .getByRole("searchbox", { name: "Пошук", exact: true })
          .inputValue(),
        name,
      );
      await p
        .locator(".selected-breed strong")
        .filter({ hasText: breed.nameUk })
        .waitFor();
      await p
        .locator(".selected-breed strong")
        .filter({ hasText: location.city })
        .waitFor();
      assert.equal(await p.locator("a.breeder-directory-card").count(), 24);
    } finally {
      await fresh.close();
    }
  });
  await run("E", async () => {
    await go(filteredUrl);
    await selected(breed.nameUk);
    const href = await cards().first().getAttribute("href");
    await cards().first().click();
    await page.waitForURL("**" + href);
    await page.goBack();
    await loaded();
    assert.equal(
      new URL(page.url()).search,
      new URL(filteredUrl, "http://localhost").search,
    );
    await page
      .getByRole("combobox", { name: "Вид тварини", exact: true })
      .click();
    await page.getByRole("option", { name: "Кіт", exact: true }).click();
    await waitParam("species", "cat");
    await page.goBack();
    await waitParam("species", "dog");
    await selected(breed.nameUk);
    await page.goForward();
    await waitParam("species", "cat");
    assert.equal(new URL(page.url()).searchParams.has("breedId"), false);
  });
  await run("F", async () => {
    await go(filteredUrl);
    await page
      .getByRole("button", { name: "Скинути фільтри", exact: true })
      .first()
      .click();
    await page.waitForURL("http://localhost:3000/breeders");
    await loaded();
    assert.equal(await search().inputValue(), "");
    await search().fill("NoMatch" + marker);
    await waitParam("q", "NoMatch" + marker);
    await page
      .getByRole("heading", {
        name: "Розплідників за цими параметрами не знайдено",
      })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Скинути фільтри", exact: true })
        .count(),
      2,
    );
  });
  const responsive = async (widths) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await go(filteredUrl);
      await selected(location.city);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `page overflow ${width}`,
      );
      assert.equal(await page.locator("select").count(), 0);
      const control = page.getByRole("combobox", {
        name: "Місто",
        exact: true,
      });
      await control.fill("Світло14Б" + marker.slice(0, 8));
      await page
        .getByRole("option")
        .filter({ hasText: location.city })
        .waitFor();
      const box = await page
        .locator(".reference-results[data-motion='open']")
        .boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width + 1,
        `dropdown clipping ${width}`,
      );
      await control.press("ArrowDown");
      await control.press("Enter");
      await selected(location.city);
      await control.press("Escape");
      assert.equal(await control.getAttribute("aria-expanded"), "false");
      assert.equal(
        await control.evaluate((el) => document.activeElement === el),
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(180);
      await page.screenshot({
        path: `test-results/phase14b-${width}.png`,
        fullPage: false,
      });
    }
  };
  await run("G", () => responsive([320, 375, 430]));
  await run("H", async () => {
    await responsive([768, 1024, 1280, 1440]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const control = page.getByRole("combobox", {
      name: "Вид тварини",
      exact: true,
    });
    await control.focus();
    await control.press("ArrowDown");
    await control.press("Escape");
    assert.equal(await control.getAttribute("aria-expanded"), "false");
  });
  await run("I", async () => {
    await go("/breeders");
    let release;
    let slowStarted;
    const gate = new Promise((r) => {
      release = r;
    });
    const started = new Promise((r) => {
      slowStarted = r;
    });
    const routeHandler = async (route) => {
      const term = new URL(route.request().url()).searchParams.get("q");
      if (term === "slow14b") {
        slowStarted();
        await gate;
      }
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                userId: users[0],
                kennelName: term === "slow14b" ? "STALE" : "LATEST",
                description: null,
                location: null,
                logo: null,
                breeds: [],
              },
            ],
            meta: {
              page: 1,
              limit: 24,
              total: 1,
              pages: 1,
              hasPublicBreeders: true,
            },
          }),
        })
        .catch(() => {});
    };
    await page.route("**/api/v1/breeders?**", routeHandler);
    try {
      await search().fill("slow14b");
      await started;
      await search().fill("latest14b");
      await waitParam("q", "latest14b");
      await cards().filter({ hasText: "LATEST" }).waitFor();
      release();
      await page.waitForTimeout(450);
      assert.equal(await cards().filter({ hasText: "STALE" }).count(), 0);
      assert.equal(await cards().filter({ hasText: "LATEST" }).count(), 1);
    } finally {
      release();
      await page.unroute("**/api/v1/breeders?**", routeHandler);
    }
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    process.env.PHASE14B_SCENARIOS
      ? "test-results/phase14b-browser-retry.json"
      : "test-results/phase14b-browser.json",
    JSON.stringify({ checks, failures, errors }, null, 2),
  );
  await browser.close();
  await db.user.deleteMany({ where: { id: { in: users } } });
  if (breed || catBreed)
    await db.breed.deleteMany({
      where: { id: { in: [breed?.id, catBreed?.id].filter(Boolean) } },
    });
  if (location) await db.location.delete({ where: { id: location.id } });
  await db.$disconnect();
}
assert.deepEqual(failures, []);
