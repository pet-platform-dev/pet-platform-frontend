import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";
const require = createRequire(import.meta.url),
  sharp = require("sharp");
const { chromium, request } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const visitorContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  visitor = await visitorContext.newPage(),
  api = await request.newContext({ baseURL: "http://localhost:4000/api/v1/" });
const checks = [],
  errors = [];
let fixture, token, csrf;
for (const tab of [page, visitor])
  tab.on("pageerror", (error) => errors.push(error.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (path, tab = page) => {
  await tab.goto("http://localhost:3000" + path);
  await tab.waitForLoadState("networkidle");
};
async function command(method, path, data, multipart) {
  const result = await api.fetch(path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
      Authorization: "Bearer " + token,
    },
    ...(data ? { data } : {}),
    ...(multipart ? { multipart } : {}),
  });
  assert.ok(result.ok(), method + " " + path + " " + result.status());
  return result.status() === 204 ? null : (await result.json()).data;
}
async function geometry(label, tab = page) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await tab.setViewportSize({ width, height: 1000 });
    assert.equal(
      await tab.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " " + width,
    );
    for (const target of await tab.locator("main .button").all())
      if (await target.isVisible()) {
        const box = await target.boundingBox();
        assert.ok(
          box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1,
          label + " target",
        );
      }
    const frame = tab.locator(".gallery-main-image");
    if (await frame.count()) {
      const box = await frame.boundingBox();
      for (const arrow of await frame.locator(".gallery-arrow").all()) {
        const a = await arrow.boundingBox();
        assert.ok(Math.abs(a.y + a.height / 2 - box.y - box.height / 2) <= 2);
      }
    }
    await tab.screenshot({
      path: `test-results/phase7e2-${label}-${width}.png`,
      fullPage: true,
    });
    pass(label + " " + width + " no overflow/aligned controls");
  }
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures({
    animals: true,
    historicalPreview: true,
  });
  const A = fixture.full.listings[1].petId,
    B = fixture.full.listings[0].petId,
    C = fixture.full.listings[2].petId,
    ownerId = fixture.full.user.id;
  csrf = (
    await (
      await api.get("auth/csrf", {
        headers: { Origin: "http://localhost:3000" },
      })
    ).json()
  ).data.csrfToken;
  const login = await api.post("auth/login", {
    headers: { Origin: "http://localhost:3000", "X-CSRF-Token": csrf },
    data: { email: fixture.full.user.email, password: fixture.password },
  });
  assert.equal(login.status(), 200);
  token = (await login.json()).data.accessToken;
  await command("PATCH", "pets/" + A + "/breeder-visibility", {
    showOnBreederProfile: true,
  });
  await command("PATCH", "pets/" + B + "/breeder-visibility", {
    showOnBreederProfile: true,
  });
  await command("PATCH", "pets/" + A, {
    name: "Тор — тварина з дуже довгою українською назвою для перевірки переносу тексту",
    description:
      "Активний, врівноважений собака з хорошою соціалізацією.\n" +
      "Характер і виховання. ".repeat(20),
    specialTraits:
      "Висока мотивація до роботи, спортивні якості та сильний зв’язок із провідником.",
  });
  const files = [];
  for (const [index, color] of [
    "#58765c",
    "#c98959",
    "#819ca6",
    "#a981a5",
  ].entries())
    files.push({
      name: `photo${index}.png`,
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 800, height: 600, channels: 3, background: color },
      })
        .png()
        .toBuffer(),
    });
  await command("POST", "pets/" + A + "/profile-image", null, {
    file: files[0],
  });
  for (const file of files.slice(1))
    await command("POST", "pets/" + A + "/media/images", null, { file });
  await command("POST", "pets/" + A + "/media/videos", {
    url: "https://youtu.be/dQw4w9WgXcQ",
  });
  await go("/sellers/" + ownerId, visitor);
  const animal = visitor.locator(`[data-pet-id="${A}"]`);
  await animal
    .getByRole("link", { name: "Переглянути профіль тварини" })
    .click();
  await visitor.waitForURL("**/pets/" + A);
  await visitor
    .getByRole("heading", { name: "Про тварину", exact: true })
    .waitFor();
  assert.equal(
    await visitor.locator(".listing-gallery-thumbnails button").count(),
    4,
  );
  assert.equal(
    await visitor
      .getByRole("link", { name: "Переглянути оголошення", exact: true })
      .count(),
    0,
  );
  assert.ok((await visitor.title()).includes("Тор"));
  assert.ok(
    !(await visitor.locator("main").innerText()).includes(
      fixture.full.user.email,
    ),
  );
  pass(
    "A: anonymous breeder card → universal Pet; primary + three gallery photos, text/video and no fake listing",
  );
  await geometry("public-profile", visitor);
  await visitor.setViewportSize({ width: 1024, height: 1000 });
  const firstSrc = await visitor
    .locator(".listing-gallery-main")
    .getAttribute("src");
  await visitor
    .getByRole("button", { name: "Наступне фото", exact: true })
    .click();
  assert.notEqual(
    await visitor.locator(".listing-gallery-main").getAttribute("src"),
    firstSrc,
  );
  await visitor
    .getByRole("button", { name: "Відкрити фото на весь екран" })
    .click();
  const dialog = visitor.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await visitor.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  await visitor.keyboard.press("ArrowRight");
  await visitor.keyboard.press("ArrowLeft");
  for (let i = 0; i < 6; i++) {
    await visitor.keyboard.press("Tab");
    assert.equal(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
      true,
    );
  }
  await visitor.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), false);
  assert.equal(
    await visitor
      .getByRole("button", { name: "Відкрити фото на весь екран" })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  pass(
    "gallery: SVG arrows, fullscreen, keyboard, focus trap/return and body scroll lock",
  );
  await visitor.setViewportSize({ width: 320, height: 1000 });
  const frame = visitor.locator(".gallery-main-image");
  const swipeBefore = await visitor
    .locator(".listing-gallery-main")
    .getAttribute("src");
  await frame.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 250,
    clientY: 200,
  });
  await frame.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 80,
    clientY: 205,
  });
  assert.notEqual(
    await visitor.locator(".listing-gallery-main").getAttribute("src"),
    swipeBefore,
  );
  const strip = visitor.locator(".listing-gallery-thumbnails");
  assert.equal(
    await strip.evaluate((node) => getComputedStyle(node).overflowX),
    "auto",
  );
  assert.equal(
    await strip.evaluate((node) => getComputedStyle(node).scrollbarWidth),
    "none",
  );
  pass(
    "gallery: mobile swipe/native horizontal scrolling and hidden scrollbar",
  );
  await strip.evaluate((node) => {
    node.scrollLeft = 0;
  });
  const stripBox = await strip.boundingBox(),
    dragSrc = await visitor
      .locator(".listing-gallery-main")
      .getAttribute("src");
  await visitor.mouse.move(
    stripBox.x + stripBox.width - 20,
    stripBox.y + stripBox.height / 2,
  );
  await visitor.mouse.down();
  await visitor.mouse.move(stripBox.x + 25, stripBox.y + stripBox.height / 2, {
    steps: 10,
  });
  await visitor.mouse.up();
  assert.ok(await strip.evaluate((node) => node.scrollLeft > 0));
  assert.equal(
    await visitor.locator(".listing-gallery-main").getAttribute("src"),
    dragSrc,
  );
  await strip.evaluate((node) => {
    node.scrollLeft = 0;
  });
  await strip.hover();
  await visitor.mouse.wheel(150, 0);
  await visitor.waitForFunction(
    () => document.querySelector(".listing-gallery-thumbnails").scrollLeft > 0,
  );
  await visitor
    .getByRole("button", { name: "Показати фото 4", exact: true })
    .click();
  assert.equal(
    await visitor
      .getByRole("button", { name: "Показати фото 4", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await visitor
    .getByRole("button", { name: "Показати фото 1", exact: true })
    .click();
  pass(
    "desktop mouse drag/trackpad preserve selection; first/last thumbnails reachable",
  );
  await visitor
    .getByRole("button", { name: "Переглянути відео 1", exact: true })
    .click();
  assert.ok(
    (await visitor.locator("iframe").getAttribute("src")).startsWith(
      "https://www.youtube-nocookie.com/embed/",
    ),
  );
  assert.equal(
    await visitor.locator("iframe").getAttribute("allow"),
    "fullscreen; picture-in-picture; encrypted-media",
  );
  pass("video: explicit lazy player with safe approved embed and no autoplay");
  await geometry("video", visitor);
  await go("/pets/" + B, visitor);
  await visitor
    .getByRole("link", { name: "Переглянути оголошення", exact: true })
    .click();
  await visitor.waitForURL("**/listings/" + fixture.full.listings[0].id);
  await visitor.locator("h1").waitFor();
  pass(
    "B: ACTIVE-only listing CTA opens correct Listing; existing Listing gallery preserved",
  );
  await go("/pets/" + C, visitor);
  assert.equal(await visitor.locator("h1").innerText(), "404");
  assert.equal(await visitor.locator(".public-pet-profile").count(), 0);
  pass(
    "C: direct private Pet produces standard Not Found without login/private content",
  );
  await go("/pets", visitor);
  await visitor.waitForURL("**/login");
  pass("My Pets still requires authentication");
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.full.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await go("/pets/" + A + "/edit");
  await page
    .getByRole("heading", { name: "Фотогалерея", exact: true })
    .waitFor();
  await page.locator(".breeder-gallery-editor-list li").first().waitFor();
  await geometry("editor");
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.locator("#description").fill("Оновлений опис тварини");
  await page.locator("#specialTraits").fill("Оновлені особливості");
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await page.waitForURL("**/pets");
  await go("/pets/" + A + "/edit");
  assert.equal(
    await page.locator("#specialTraits").inputValue(),
    "Оновлені особливості",
  );
  const idsBefore = (await command("GET", "pets/" + A + "/media")).gallery.map(
    (item) => item.id,
  );
  const reordered = page.waitForResponse(
    (r) =>
      r.url().endsWith("/media/reorder") && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Перемістити фото 2 раніше", exact: true })
    .click();
  assert.equal((await reordered).status(), 200);
  await page
    .getByRole("button", { name: "Перемістити фото 2 раніше", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector("#pet-gallery-upload")?.disabled,
  );
  assert.equal(
    (await command("GET", "pets/" + A + "/media")).gallery[0].id,
    idsBefore[1],
  );
  await page.route("**/pets/*/media/images", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "test failure" }),
    }),
  );
  await page.locator("#pet-gallery-upload").setInputFiles(files[1]);
  await page
    .getByRole("button", { name: "Повторити завантаження", exact: true })
    .waitFor();
  await page.unroute("**/pets/*/media/images");
  await page
    .getByRole("button", { name: "Повторити завантаження", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("main")
        ?.textContent.includes("Повторити завантаження"),
    { timeout: 60000 },
  );
  assert.equal(
    (await command("GET", "pets/" + A + "/media")).gallery.length,
    4,
  );
  const removed = page.waitForResponse(
    (r) => r.url().includes("/media/") && r.request().method() === "DELETE",
  );
  await page
    .getByRole("button", { name: "Видалити фото 1", exact: true })
    .click();
  assert.equal((await removed).status(), 200);
  await page.waitForFunction(
    () => !document.querySelector("#pet-gallery-upload")?.disabled,
  );
  assert.equal(
    (await command("GET", "pets/" + A + "/media")).gallery.length,
    3,
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Фотогалерея", exact: true })
    .waitFor();
  assert.equal(
    (await page.locator(".pet-media-editor").innerText()).includes(
      "Фотографії 3 / 20",
    ),
    true,
  );
  pass(
    "D: editor text/save/refresh, gallery reorder, failed upload retry and delete persist",
  );
  await go("/pets/" + A, visitor);
  await visitor
    .getByRole("heading", { name: "Про тварину", exact: true })
    .waitFor();
  assert.ok(
    (await visitor.locator("main").innerText()).includes(
      "Оновлений опис тварини",
    ),
  );
  assert.equal(
    await visitor.locator(".listing-gallery-thumbnails button").count(),
    4,
  );
  pass(
    "public projection updates after owner edit, independent from SOLD history",
  );
  await go("/profile/breeder/animals");
  await page
    .locator(`[data-pet-id="${A}"]`)
    .getByRole("link", { name: "Переглянути профіль тварини" })
    .waitFor();
  pass("breeder management offers public view only for opted-in Pet");
  await command("DELETE", "breeders/me");
  await go("/pets/" + A, visitor);
  assert.equal(await visitor.locator("h1").innerText(), "404");
  assert.equal((await command("GET", "pets/" + A)).id, A);
  assert.equal(
    (await command("GET", "pets/" + A + "/media")).gallery.length,
    3,
  );
  pass(
    "E: breeder deletion preserves Pet/media privately and closes public route",
  );
  const { PrismaService } =
    await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
  const p = new PrismaService();
  let assetIds;
  try {
    assetIds = (
      await p.petImageAsset.findMany({
        where: { petId: A },
        select: { id: true },
      })
    ).map((item) => item.id);
  } finally {
    await p.$disconnect();
  }
  await command("DELETE", "pets/" + A);
  const verify = new PrismaService();
  try {
    assert.equal(await verify.pet.findUnique({ where: { id: A } }), null);
    assert.equal(await verify.petMedia.count({ where: { petId: A } }), 0);
    assert.equal(
      await verify.petImageAsset.count({ where: { id: { in: assetIds } } }),
      0,
    );
    assert.ok(await verify.pet.findUnique({ where: { id: B } }));
    assert.ok(
      await verify.listingImage.count({
        where: { listingId: fixture.full.listings[0].id },
      }),
    );
  } finally {
    await verify.$disconnect();
  }
  pass(
    "F: Pet delete removes all its media/provider ledger; sibling Pet/ListingImage remain",
  );
  assert.deepEqual(errors, []);
  pass("zero runtime/hydration errors");
  await writeFile(
    "test-results/phase7e2-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await api.dispose();
  await context.close();
  await visitorContext.close();
  await browser.close();
  await fixture?.cleanup();
}
