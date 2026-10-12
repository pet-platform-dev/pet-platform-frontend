import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage();
const errors = [],
  checks = [];
const pass = (s) => {
  checks.push(s);
  console.log("PASS " + s);
};
page.on("pageerror", (e) => errors.push(e.message));
let f;
try {
  f = await matingFixtures();
  await page.goto("http://localhost:3000/mating");
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const mobile = width < 1024;
    if (mobile) await page.getByRole("button", { name: /^Фільтри/ }).click();
    const scope = mobile
      ? page.getByRole("dialog")
      : page.locator(".listing-filters-panel");
    assert.equal(await scope.locator(".filter-field").count(), 7);
    const headings = await scope
      .locator(".filter-field .field > label, .filter-field fieldset > legend")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const s = getComputedStyle(n);
          return [s.fontSize, s.fontWeight, s.lineHeight, s.marginBottom];
        }),
      );
    assert.equal(headings.length, 7);
    for (const style of headings)
      assert.deepEqual(style, ["14px", "600", "20px", "8px"]);
    for (const marker of await scope.locator(".optional").all()) {
      assert.deepEqual(
        await marker.evaluate((n) => {
          const s = getComputedStyle(n);
          return [s.fontSize, s.fontWeight, s.lineHeight];
        }),
        ["11px", "400", "16px"],
      );
      const box = await marker.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
    }
    const helperStyles = await scope
      .locator(".hint,.form-hint")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const s = getComputedStyle(n);
          return [s.fontSize, s.lineHeight, s.marginTop];
        }),
      );
    for (const style of helperStyles)
      assert.deepEqual(style, ["12px", "18px", "8px"]);
    assert.equal(await scope.locator("select").count(), 0);
    for (const label of ["Вік", "Оплата"]) {
      const combo = scope.getByRole("combobox", { name: label, exact: true });
      assert.equal(await combo.locator("svg").count(), 1);
      await combo.focus();
      await page.keyboard.press("End");
      await scope.getByRole("listbox", { name: label, exact: true }).waitFor();
      assert.ok(await combo.getAttribute("aria-activedescendant"));
      for (const option of await scope
        .getByRole("listbox", { name: label, exact: true })
        .getByRole("option")
        .all()) {
        const b = await option.boundingBox();
        assert.ok(b.height >= 44 && b.x >= 0 && b.x + b.width <= width);
      }
      await page.screenshot({
        path: `test-results/phase9c1-${label === "Вік" ? "age" : "fee"}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      assert.equal(await combo.getAttribute("aria-expanded"), "false");
      assert.equal(
        await combo.evaluate((n) => n === document.activeElement),
        true,
      );
    }
    for (const control of await scope
      .locator(".mating-gender-filter label")
      .all()) {
      const box = await control.boundingBox();
      assert.ok(box.height >= 44);
      await control.getByRole("checkbox").focus();
      assert.equal(
        await control.evaluate((n) => getComputedStyle(n).outlineStyle),
        "solid",
      );
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `test-results/phase9c1-filters-${width}.png`,
    });
    if (mobile)
      await scope
        .getByRole("button", { name: "Закрити фільтри", exact: true })
        .click();
    pass(
      "shared field typography/spacing, optional labels, custom dropdowns, keyboard, gender targets " +
        width,
    );
  }
  await page.goto("http://localhost:3000/mating?ageMinMonths=0");
  const legacyAge = page.getByRole("combobox", { name: "Вік", exact: true });
  await legacyAge.waitFor();
  assert.match(await legacyAge.innerText(), /Вік зазначено/);
  assert.equal(new URL(page.url()).searchParams.get("ageMinMonths"), "0");
  pass(
    "legacy zero-only URL keeps its bounds without a technical or undefined age label",
  );
  await page.goto("http://localhost:3000/mating");
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.getByRole("button", { name: /^Фільтри/ }).click();
  const dialog = page.getByRole("dialog");
  const age = dialog.getByRole("combobox", { name: "Вік", exact: true });
  await age.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.match(await age.innerText(), /2–4 роки/);
  assert.equal(new URL(page.url()).searchParams.get("ageMinMonths"), null);
  await dialog.getByRole("button", { name: /^(Застосувати|Показати)/ }).click();
  await page.waitForURL(
    (u) =>
      u.searchParams.get("ageMinMonths") === "24" &&
      u.searchParams.get("ageMaxMonths") === "48",
  );
  await page.reload();
  await page.getByRole("button", { name: /^Фільтри/ }).click();
  assert.match(
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Вік", exact: true })
      .innerText(),
    /2–4 роки/,
  );
  pass(
    "keyboard age selection commits only on mobile Apply and restores from URL after reload",
  );
  await page.goto("http://localhost:3000/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const card = page.locator(".dashboard-mating");
    const neutral = page.locator(".dashboard-card").first();
    const surface = (n) => {
      const s = getComputedStyle(n);
      return [s.backgroundColor, s.borderColor, s.borderRadius, s.padding];
    };
    assert.deepEqual(
      await card.evaluate(surface),
      await neutral.evaluate(surface),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `test-results/phase9c1-account-${width}.png`,
    });
    pass("neutral account mating surface " + width);
  }
  await page.goto("http://localhost:3000/mating/new");
  await page
    .getByText(
      "Переконайтеся, що вік і стан здоров’я тварини підходять для в’язки. За потреби проконсультуйтеся з ветеринаром.",
      { exact: true },
    )
    .waitFor();
  pass(
    "neutral age/health reminder in create form without an eligibility claim",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/phase9c1-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/phase9c1-failure.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/phase9c1-failure.txt",
    e.stack + "\n" + (await page.locator("body").innerText()),
  );
  throw e;
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
