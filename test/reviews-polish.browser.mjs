import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { reviewsFixtures } from "./helpers/reviews-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
const checks = [],
  errors = [],
  base = "http://localhost:3000";
let fixture;
page.on("pageerror", (e) => errors.push(e.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const own = () => page.locator(".own-review-card"),
  publicArea = () => page.locator(".public-reviews");
async function reload() {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await own().waitFor();
}
function luminance(rgb) {
  const channels = rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
async function widths(state) {
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await own().scrollIntoViewIfNeeded();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const result = await own().evaluate((card) => {
      const b = card.getBoundingClientRect(),
        badge = card.querySelector(".review-status").getBoundingClientRect(),
        title = card.querySelector("header h3").getBoundingClientRect();
      const nodes = [
        ...card.querySelectorAll("button,textarea,.review-rating-option"),
      ]
        .filter((n) => n.getClientRects().length)
        .map((n) => {
          const r = n.getBoundingClientRect();
          return { left: r.left, right: r.right, height: r.height };
        });
      return {
        padding: parseFloat(getComputedStyle(card).paddingLeft),
        left: b.left,
        right: b.right,
        badgeLeft: badge.left,
        badgeRight: badge.right,
        collides: !(
          title.right <= badge.left ||
          badge.right <= title.left ||
          title.bottom <= badge.top ||
          badge.bottom <= title.top
        ),
        nodes,
      };
    });
    assert.ok(result.padding >= 16);
    assert.ok(
      result.badgeLeft >= result.left + result.padding - 1 &&
        result.badgeRight <= result.right - result.padding + 1,
    );
    assert.equal(result.collides, false);
    assert.ok(result.nodes.every((n) => n.left >= 0 && n.right <= width + 1));
    if (width <= 430)
      assert.ok(
        result.nodes.filter((n) => n.height > 0).every((n) => n.height >= 40),
      );
    await page.locator(".seller-reviews").screenshot({
      path: `test-results/reviews-polish-${state}-${width}.png`,
    });
    pass(
      state +
        " " +
        width +
        " contained card/badge/actions, no overlap or overflow",
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await reviewsFixtures();
  const author = fixture.full.user.id,
    target = fixture.fallback.user.id,
    path = "/sellers/" + target;
  await fixture.setOwnReview(author, target, "PENDING");
  await page.goto(base + "/login?" + new URLSearchParams({ returnTo: path }));
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.full.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL(base + path);
  await own().waitFor();
  await publicArea()
    .getByRole("heading", { name: "Публічні відгуки", exact: true })
    .waitFor();
  await publicArea()
    .getByText("Публічних відгуків ще немає.", { exact: true })
    .waitFor();
  assert.equal(
    await own().locator(".review-status").innerText(),
    "На модерації",
  );
  await own()
    .getByText("Відгук перевіряється перед публікацією.", { exact: true })
    .waitFor();
  assert.doesNotMatch(
    await page.locator(".seller-reviews").innerText(),
    /Ваш відгук на модерації\.|Ще немає відгуків\./,
  );
  assert.equal(await publicArea().locator(".review-empty").count(), 1);
  pass(
    "empty public history clearly separated from existing own pending review; no duplicate copy",
  );
  assert.equal(
    await own()
      .locator(".review-card-meta")
      .evaluate((n) => getComputedStyle(n).gap),
    "16px",
  );
  assert.equal(
    await own()
      .locator(".review-delete-action")
      .evaluate((n) => getComputedStyle(n).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(
    await own()
      .locator(".review-delete-action")
      .evaluate((n) => n.classList.contains("danger")),
    false,
  );
  pass(
    "rating/date have clear aligned gap and delete uses destructive outline",
  );
  await widths("pending");
  await page.keyboard.press("Tab");
  await own().getByRole("button", { name: "Редагувати", exact: true }).focus();
  assert.equal(
    await own()
      .getByRole("button", { name: "Редагувати", exact: true })
      .evaluate((n) => getComputedStyle(n).outlineStyle),
    "solid",
  );
  pass("keyboard action focus visible");
  await own().getByRole("button", { name: "Редагувати", exact: true }).click();
  await widths("edit");
  await own().getByRole("button", { name: "Скасувати", exact: true }).click();
  assert.equal(
    await own()
      .getByRole("button", { name: "Редагувати", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  pass("edit cancel returns focus");
  for (const [status, label] of [
    ["PENDING", "На модерації"],
    ["APPROVED", "Опубліковано"],
    ["REJECTED", "Відхилено"],
    ["HIDDEN", "Приховано"],
  ]) {
    await fixture.setOwnReview(author, target, status);
    await reload();
    assert.equal(await own().locator(".review-status").innerText(), label);
    const colors = await own()
      .locator(".review-status")
      .evaluate((n) => ({
        text: getComputedStyle(n).color,
        bg: getComputedStyle(n).backgroundColor,
      }));
    const a = luminance(colors.text),
      b = luminance(colors.bg);
    assert.ok(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
      status + " contrast",
    );
    if (status === "APPROVED") {
      await publicArea().locator(".review-list .review-card").waitFor();
      await widths("approved");
    }
    if (status === "HIDDEN")
      assert.equal(
        await own()
          .getByRole("button", { name: "Редагувати", exact: true })
          .count(),
        0,
      );
    pass(status + " readable text badge, contrast >= 4.5:1, actions preserved");
  }
  await page.setViewportSize({ width: 320, height: 1000 });
  await own().getByRole("button", { name: "Видалити", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Скасувати", exact: true })
    .click();
  assert.equal(
    await own()
      .getByRole("button", { name: "Видалити", exact: true })
      .evaluate((n) => n === document.activeElement),
    true,
  );
  pass("mobile delete cancel and focus return preserved");
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/reviews-polish-browser.json",
    JSON.stringify({ checks }, null, 2),
  );
} finally {
  await context.close();
  await browser.close();
  if (fixture) await fixture.cleanup();
}
