import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "msedge",
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const base = "http://localhost:3000",
  checks = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let fixture;
let png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J9sAAAAASUVORK5CYII=",
  "base64",
);
const file = (index) => ({
  name: "breeder-" + index + ".png",
  mimeType: "image/png",
  buffer: png,
});
function pass(label) {
  checks.push(label);
  console.log("PASS " + label);
}
async function go(path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
}
async function geometry(label) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " " + width + " overflow",
    );
    if (label.endsWith("editor")) {
      const geometry = await page
        .locator(".breeder-media-editor")
        .evaluate((root) => {
          const sections = [...root.querySelectorAll(".breeder-media-section")];
          return {
            padding: sections.map((el) => getComputedStyle(el).padding),
            headingSizes: sections.map(
              (el) => getComputedStyle(el.querySelector("h2")).fontSize,
            ),
            buttons: [...root.querySelectorAll("button:not(:disabled)")].map(
              (el) => ({
                height: el.getBoundingClientRect().height,
                width: el.getBoundingClientRect().width,
                available: el.parentElement.getBoundingClientRect().width,
              }),
            ),
            cover: root
              .querySelector(".breeder-editor-preview-cover")
              ?.getBoundingClientRect()
              .toJSON(),
          };
        });
      assert.equal(new Set(geometry.padding).size, 1);
      assert.equal(new Set(geometry.headingSizes).size, 1);
      for (const button of geometry.buttons) {
        assert.ok(button.height >= 44);
        assert.ok(button.width <= button.available + 1);
      }
      if (geometry.cover)
        assert.ok(
          Math.abs(geometry.cover.width / geometry.cover.height - 3) < 0.05,
        );
    }
    await page.screenshot({
      path: `test-results/phase7d1-${label}-${width}.png`,
      fullPage: true,
    });
    pass(label + " " + width);
  }
}
async function upload(selector, files) {
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/breeders/me/media/images/") &&
      r.request().method() === "POST",
  );
  await page.locator(selector).setInputFiles(files);
  const result = await response;
  assert.equal(result.status(), 201);
  await page.waitForFunction(
    () => !document.querySelector(".breeder-upload-list li"),
  );
  await page.waitForLoadState("networkidle");
}
async function mutation(action, path) {
  const response = page
    .waitForResponse(
      (r) =>
        r.url().includes(path) &&
        ["PATCH", "POST", "DELETE"].includes(r.request().method()),
    )
    .catch((error) => ({ error }));
  await action();
  const result = await response;
  if (result.error) throw result.error;
  assert.ok(result.ok());
  await page.waitForLoadState("networkidle");
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures();
  const snapshot = await fixture.domainSnapshot();
  await go("/sellers/" + fixture.empty.user.id);
  assert.equal(
    await page
      .locator(
        ".breeder-cover,.breeder-logo,.listing-gallery,.breeder-video-player",
      )
      .count(),
    0,
  );
  await geometry("empty-public");
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.full.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await go("/profile/breeder");
  png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#dedfcd";
      ctx.fillRect(0, 0, 900, 300);
      ctx.fillStyle = "#46654e";
      ctx.fillRect(40, 40, 220, 220);
      ctx.fillStyle = "#f9f7f2";
      ctx.font = "bold 48px Arial";
      ctx.fillText("KENNEL", 300, 175);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  for (const id of ["logo", "cover", "gallery"]) {
    const input = page.locator("#breeder-" + id + "-upload");
    assert.equal(
      await input.evaluate((el) => {
        const s = getComputedStyle(el);
        return (
          s.clipPath === "inset(50%)" && el.getBoundingClientRect().width === 1
        );
      }),
      true,
    );
    const trigger = page.locator('[aria-controls="breeder-' + id + '-upload"]');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    const chooser = await chooserPromise;
    assert.equal(
      await chooser.element().getAttribute("id"),
      "breeder-" + id + "-upload",
    );
    await chooser.setFiles([]);
    pass("hidden accessible input and keyboard file chooser " + id);
  }
  await geometry("empty-editor");
  await page.locator("#breeder-logo-upload").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await page.locator("#breeder-logo-feedback [role=alert]").waitFor();
  assert.equal(
    await page.locator("#breeder-cover-feedback [role=alert]").count(),
    0,
  );
  await page.screenshot({
    path: "test-results/phase7d1-local-validation-error.png",
    fullPage: true,
  });
  pass("file validation stays inside logo section");
  await upload("#breeder-logo-upload", file("logo"));
  pass("real Cloudinary logo upload");
  await upload("#breeder-cover-upload", file("cover"));
  pass("real Cloudinary cover upload");
  await upload("#breeder-gallery-upload", file("single"));
  await go("/sellers/" + fixture.full.user.id);
  assert.equal(
    await page.locator(".gallery-arrow,.listing-gallery-thumbnails").count(),
    0,
  );
  await page.locator(".gallery-open").click();
  await page.locator("dialog[open]").waitFor();
  assert.equal(await page.locator("dialog .gallery-arrow").count(), 0);
  await page.keyboard.press("Escape");
  pass("one-image gallery fullscreen without redundant arrows");
  const mainUrl = await page
    .locator(".listing-gallery-main")
    .getAttribute("src");
  await page.route(mainUrl, (route) => route.abort());
  await page.reload();
  await page.locator(".breeder-public-gallery .image-fallback").waitFor();
  pass("broken provider image uses readable fallback");
  await page.unroute(mainUrl);
  await go("/profile/breeder");
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Видалити фото 1", exact: true })
        .click(),
    "/media/",
  );
  // One controlled failure proves later files continue, retry avoids duplicating successful uploads.
  let failOnce = true;
  await page.route("**/breeders/me/media/images/IMAGE", async (route) => {
    if (failOnce) {
      failOnce = false;
      await page
        .getByRole("progressbar")
        .waitFor()
        .catch((error) => errors.push(error.message));
      await page.screenshot({
        path: "test-results/phase7d1-upload-loading.png",
        fullPage: true,
      });
      pass("upload preview and indeterminate progress");
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "fixture failure" } }),
      });
    } else await route.continue();
  });
  await page
    .locator("#breeder-gallery-upload")
    .setInputFiles(Array.from({ length: 4 }, (_, i) => file(i)));
  await page.getByRole("button", { name: "Повторити", exact: true }).waitFor();
  assert.equal(
    await page
      .locator("#breeder-gallery-feedback .breeder-upload-list")
      .count(),
    1,
  );
  await page.screenshot({
    path: "test-results/phase7d1-upload-error.png",
    fullPage: true,
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".breeder-gallery-editor-list li").length === 3,
  );
  pass("partial gallery failure preserves three successes and retry control");
  await page.unroute("**/breeders/me/media/images/IMAGE");
  await page.getByRole("button", { name: "Повторити", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".breeder-gallery-editor-list li").length ===
        4 && !document.querySelector(".breeder-upload-list li"),
  );
  pass("retry persists only failed file");
  await upload(
    "#breeder-gallery-upload",
    Array.from({ length: 6 }, (_, i) => file(i + 4)),
  );
  assert.equal(
    await page.locator(".breeder-gallery-editor-list li").count(),
    10,
  );
  pass("ten real Cloudinary gallery images");
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.locator(".breeder-gallery-editor-list li").count(),
    10,
  );
  assert.equal(await page.locator(".breeder-editor-preview-logo").count(), 1);
  pass("logo cover gallery survive refresh");
  const images = page.locator(".breeder-gallery-editor-list img"),
    before = await images.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("src")),
    );
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Перемістити фото 2 раніше", exact: true })
        .click(),
    "/media/reorder",
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  const after = await images.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("src")),
  );
  assert.equal(after[0], before[1]);
  pass("accessible reorder survives refresh");
  const cards = page.locator(".breeder-gallery-editor-list li");
  await mutation(() => cards.nth(0).dragTo(cards.nth(2)), "/media/reorder");
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(
    (
      await images.evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("src")),
      )
    )[2],
    after[0],
  );
  pass("desktop drag/drop order persists after refresh");
  await page.locator("#breeder-video-url").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Додати відео", exact: true }).click();
  assert.ok(await page.locator("#breeder-video-error").textContent());
  await page.locator("#breeder-video-url").fill("https://youtu.be/dQw4w9WgXcQ");
  await mutation(
    () =>
      page.getByRole("button", { name: "Додати відео", exact: true }).click(),
    "/media/videos",
  );
  pass("video validation and supported URL persistence");
  const oldLogo = await page
    .locator(".breeder-editor-preview-logo")
    .getAttribute("src");
  await upload("#breeder-logo-upload", file("new-logo"));
  assert.notEqual(
    await page.locator(".breeder-editor-preview-logo").getAttribute("src"),
    oldLogo,
  );
  await upload("#breeder-cover-upload", file("new-cover"));
  pass("logo and cover replacement");
  await geometry("populated-editor");
  await go("/sellers/" + fixture.full.user.id);
  await geometry("populated-public");
  assert.equal(await page.locator("iframe").count(), 0);
  pass("no third-party iframe before playback");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const open = page.locator(".gallery-open");
  await open.click();
  const dialog = page.locator("dialog.gallery-lightbox");
  await dialog.waitFor({ state: "visible" });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await open.evaluate((n) => n === document.activeElement), true);
  pass("shared fullscreen keyboard Escape body lock focus return");
  await page.setViewportSize({ width: 320, height: 1000 });
  await open.click();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      Boolean(document.activeElement.closest("dialog")),
    ),
    true,
  );
  await page.keyboard.press("Escape");
  pass("mobile fullscreen focus stays in dialog");
  await page.setViewportSize({ width: 1024, height: 1000 });
  const strip = page.locator(".listing-gallery-thumbnails");
  assert.ok(
    await strip.evaluate((n) => getComputedStyle(n).overflowX === "auto"),
  );
  assert.ok(
    await strip.evaluate((n) => getComputedStyle(n).scrollbarWidth === "none"),
  );
  await strip.scrollIntoViewIfNeeded();
  const wheelArea = await strip.boundingBox();
  await page.mouse.move(wheelArea.x + 30, wheelArea.y + 30);
  await page.mouse.wheel(250, 0);
  await page.waitForFunction(
    () => document.querySelector(".listing-gallery-thumbnails").scrollLeft > 0,
  );
  await strip.evaluate((n) => (n.scrollLeft = 0));
  pass("native horizontal wheel/trackpad path remains scrollable");
  const selectedBeforeDrag = await strip
    .locator("button[aria-pressed=true]")
    .getAttribute("aria-label");
  await strip.scrollIntoViewIfNeeded();
  const area = await strip.boundingBox();
  await page.mouse.move(area.x + area.width - 20, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + 20, area.y + area.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.ok((await strip.evaluate((n) => n.scrollLeft)) > 0);
  assert.equal(
    await strip.locator("button[aria-pressed=true]").getAttribute("aria-label"),
    selectedBeforeDrag,
  );
  pass(
    "desktop drag suppresses thumbnail activation, native scrolling and hidden scrollbar",
  );
  await strip.evaluate((n) => (n.scrollLeft = n.scrollWidth));
  await strip.locator("button").last().click();
  assert.equal(
    await strip.locator("button[aria-pressed=true]").getAttribute("aria-label"),
    "Показати фото 10",
  );
  await strip.evaluate((n) => (n.scrollLeft = 0));
  await strip.locator("button").first().click();
  pass("first and last thumbnails reachable");
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.locator(".gallery-main-image").dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 240,
    clientY: 120,
  });
  await page.locator(".gallery-main-image").dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 80,
    clientY: 120,
  });
  await page.waitForFunction(() =>
    document.querySelector(".gallery-counter").textContent.includes("2 / 10"),
  );
  pass("touch swipe advances gallery");
  await page
    .getByRole("button", { name: "Переглянути відео 1", exact: true })
    .click();
  assert.match(
    await page.locator("iframe").getAttribute("src"),
    /^https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?autoplay=0/,
  );
  pass("fixed safe privacy embed on explicit playback");
  await go("/profile/breeder");
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Видалити фото 1", exact: true })
        .click(),
    "/media/",
  );
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Видалити відео 1", exact: true })
        .click(),
    "/media/",
  );
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Видалити логотип", exact: true })
        .click(),
    "/media/",
  );
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Видалити обкладинку", exact: true })
        .click(),
    "/media/",
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.locator(".breeder-gallery-editor-list li").count(),
    9,
  );
  assert.equal(
    await page
      .locator(
        ".breeder-editor-preview-logo,.breeder-editor-preview-cover,.breeder-video-editor-list li",
      )
      .count(),
    0,
  );
  pass("individual image logo cover video deletion survives refresh");
  await page
    .getByRole("button", { name: "Видалити профіль розплідника", exact: true })
    .click();
  await mutation(
    () =>
      page
        .getByRole("button", { name: "Видалити профіль", exact: true })
        .click(),
    "/breeders/me",
  );
  await page.waitForURL("**/account");
  assert.deepEqual(await fixture.domainSnapshot(), snapshot);
  pass("profile deletion preserves User contacts Pets Listings");
  await go("/sellers/" + fixture.full.user.id);
  assert.ok(
    await page
      .getByRole("heading", { name: "Олександр Єпік", exact: true })
      .isVisible(),
  );
  pass("deleted breeder profile falls back to personal seller identity");
  assert.deepEqual(errors, []);
  pass("no browser runtime errors");
} catch (error) {
  console.error(
    JSON.stringify({
      failedUrl: page.url(),
      runtimeErrors: errors,
      visibleText: (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 2000),
    }),
  );
  await page
    .screenshot({ path: "test-results/phase7d1-failure.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
  await fixture?.cleanup();
  await writeFile(
    "test-results/phase7d1-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
