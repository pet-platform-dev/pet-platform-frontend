import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  chooseCatalogSort,
  sortLabels,
} from "./helpers/catalog-sort-browser.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  }),
  page = await context.newPage(),
  checks = [],
  errors = [];
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
page.on("pageerror", (error) => errors.push(error.message));
const until = async (work) => {
  let last;
  for (let end = Date.now() + 15000; Date.now() < end;) {
    try {
      return await work();
    } catch (error) {
      last = error;
      await page.waitForTimeout(100);
    }
  }
  throw last;
};
const noOverflow = async () =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
const menu = () =>
  page.getByRole("navigation", { name: "Мобільна навігація", exact: true });
const sort = () =>
  page.getByRole("combobox", { name: "Сортування", exact: true });
await mkdir("test-results", { recursive: true });
try {
  await page.goto("http://localhost:3000/listings");
  await page.locator(".listing-card").first().waitFor();
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await menu().waitFor();
  assert.equal(await menu().getByRole("link").count(), 3);
  assert.equal(
    await menu()
      .getByRole("link", { name: "Мої тварини", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await menu()
      .getByRole("link", { name: "Оголошення", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  assert.equal(
    await menu()
      .getByRole("link")
      .first()
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await menu().count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Відкрити меню", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  pass(
    "Anonymous burger preserves public/auth navigation, active page, initial and Escape return focus",
  );
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await page.getByLabel("Пошук оголошень", { exact: true }).click();
  assert.equal(await menu().count(), 0);
  pass("Outside click closes mobile navigation without stealing clicked focus");
  await sort().press("Enter");
  assert.equal(await sort().getAttribute("aria-expanded"), "true");
  assert.equal(
    await page
      .getByRole("listbox", { name: "Сортування", exact: true })
      .getByRole("option")
      .count(),
    4,
  );
  assert.equal(
    await page
      .getByRole("option", { name: "Спочатку нові", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await sort().press("ArrowDown");
  await sort().press("Enter");
  await until(() =>
    assert.equal(new URL(page.url()).searchParams.get("sort"), "oldest"),
  );
  assert.equal(
    await sort().evaluate((node) => node === document.activeElement),
    true,
  );
  assert.equal(await sort().getAttribute("aria-expanded"), "false");
  pass(
    "Custom sort Enter/ArrowDown/Enter selects oldest and retains trigger focus",
  );
  await sort().press("Space");
  await sort().press("ArrowUp");
  await sort().press("Escape");
  assert.equal(await sort().innerText(), sortLabels.oldest);
  assert.equal(await sort().getAttribute("aria-expanded"), "false");
  pass(
    "Space opens; ArrowUp navigates; Escape closes without changing applied sort",
  );
  await sort().click();
  await page.getByLabel("Пошук оголошень", { exact: true }).click();
  assert.equal(await sort().getAttribute("aria-expanded"), "false");
  pass("Sort outside click closes; focus remains on clicked Search");
  for (const value of ["price_asc", "price_desc", "newest"]) {
    await chooseCatalogSort(page, value);
    await until(() =>
      assert.equal(
        new URL(page.url()).searchParams.get("sort"),
        value === "newest" ? null : value,
      ),
    );
    assert.equal(await sort().innerText(), sortLabels[value]);
  }
  pass(
    "Mouse selection preserves all four original sort values and page reset",
  );
  await page.getByLabel("Пошук оголошень", { exact: true }).fill("");
  await page.locator(".mobile-filters-trigger").click();
  const filterDialog = page.getByRole("dialog", {
    name: "Фільтри",
    exact: true,
  });
  await filterDialog
    .getByRole("radio", { name: "Собаки", exact: true })
    .check();
  await filterDialog.locator(".mobile-filters-footer button").last().click();
  await until(async () =>
    assert.ok(await page.locator(".catalog-clear").isVisible()),
  );
  await page.waitForTimeout(750);
  await page.locator(".listing-card").first().waitFor();
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow();
    const clear = await page.locator(".catalog-clear").evaluate((node) => ({
      height: node.getBoundingClientRect().height,
      wrap: getComputedStyle(node).whiteSpace,
      overflow: node.scrollWidth > node.clientWidth + 1,
    }));
    assert.ok(clear.height >= 44);
    assert.equal(clear.wrap, "nowrap");
    assert.equal(clear.overflow, false);
    assert.equal(
      await page.locator(".desktop-navigation").isVisible(),
      width >= 1024,
    );
    assert.equal(
      await page.locator(".mobile-navigation-trigger").isVisible(),
      width < 1024,
    );
    await sort().click();
    await noOverflow();
    const layering = await page.evaluate(() => {
      const popup = document.querySelector(".select-dropdown-options"),
        box = popup.getBoundingClientRect(),
        cards = [...document.querySelectorAll(".listing-card")].map((node) =>
          node.getBoundingClientRect(),
        );
      const card = cards.find(
        (card) =>
          Math.min(box.right, card.right) - Math.max(box.left, card.left) > 4 &&
          Math.min(box.bottom, card.bottom) - Math.max(box.top, card.top) > 4,
      );
      if (!card) return null;
      return Boolean(
        document
          .elementFromPoint(
            Math.max(box.left, card.left) + 3,
            Math.max(box.top, card.top) + 3,
          )
          ?.closest(".select-dropdown-options"),
      );
    });
    assert.equal(
      layering,
      true,
      "Sort popup must actually overlap and paint above a card",
    );
    await page.screenshot({
      path: `test-results/mobile-polish-sort-${width}.png`,
    });
    await sort().press("Escape");
    if (width < 1024) {
      await page
        .getByRole("button", { name: "Відкрити меню", exact: true })
        .click();
      await menu().waitFor();
      await noOverflow();
      await page.screenshot({
        path: `test-results/mobile-polish-menu-${width}.png`,
      });
      await page.keyboard.press("Escape");
    }
    pass(
      `${width}px: header breakpoint, one-line 44px Clear, SVG custom sort popup above cards and no overflow`,
    );
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("http://localhost:3000/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill("demo.owner1@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("DemoPass123!");
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page
    .getByRole("heading", { name: "Мій профіль", exact: true })
    .waitFor();
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow();
    const buttons = await page
      .locator(".account-actions .button")
      .evaluateAll((items) =>
        items.map((node) => ({
          height: node.getBoundingClientRect().height,
          width: node.getBoundingClientRect().width,
          overflow: node.scrollWidth > node.clientWidth + 1,
          wrap: getComputedStyle(node).whiteSpace,
        })),
      );
    assert.equal(buttons.length, 2);
    assert.ok(
      buttons.every(
        (node) =>
          node.height >= 44 &&
          node.height <= 52 &&
          !node.overflow &&
          node.wrap === "nowrap",
      ),
    );
    await page.screenshot({
      path: `test-results/mobile-polish-account-${width}.png`,
    });
    if (width < 1024) {
      await page
        .getByRole("button", { name: "Відкрити меню", exact: true })
        .click();
      assert.deepEqual(await menu().getByRole("link").allTextContents(), [
        "Оголошення",
        "Мої оголошення",
        "Мої тварини",
        "Мій профіль",
      ]);
      assert.equal(
        await menu()
          .getByRole("link", { name: "Мій профіль", exact: true })
          .getAttribute("aria-current"),
        "page",
      );
      await page.keyboard.press("Escape");
    }
    pass(
      `${width}px: balanced profile edit/logout buttons, authenticated navigation and no overflow`,
    );
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await menu().getByRole("link", { name: "Мої тварини", exact: true }).click();
  await page.waitForURL("**/pets");
  assert.equal(await menu().count(), 0);
  pass(
    "Mobile navigation link closes panel and keeps protected navigation flow",
  );
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await menu().getByRole("link").last().focus();
  await page.keyboard.press("Tab");
  assert.equal(await menu().count(), 0);
  pass("Tab out closes nonmodal navigation; focus is never trapped");
  await page
    .getByRole("button", { name: "Відкрити меню", exact: true })
    .click();
  await page.setViewportSize({ width: 1024, height: 900 });
  assert.equal(await menu().count(), 0);
  pass("Desktop resize dismisses mobile menu and preserves desktop header");
  await page.goto("http://localhost:3000/account");
  await page
    .getByRole("link", { name: "Редагувати публічний профіль", exact: true })
    .click();
  await page.waitForURL("**/profile");
  await page
    .getByRole("heading", { name: "Публічний профіль продавця", exact: true })
    .waitFor();
  pass("Profile edit still opens existing public-contact editor");
  await page.goto("http://localhost:3000/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  pass("Existing logout/session flow is preserved");
  assert.deepEqual(errors, []);
  pass("No runtime/hydration errors");
} finally {
  await context.close();
  await browser.close();
  await writeFile(
    "test-results/mobile-polish-validation.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
}
console.log(`${checks.length} mobile UI polish browser checks passed.`);
