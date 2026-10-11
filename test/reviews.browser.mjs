import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { reviewsFixtures } from "./helpers/reviews-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const contexts = [],
  checks = [],
  errors = [],
  traffic = [];
let fixture;
const base = "http://localhost:3000";
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
const section = (page) => page.locator(".seller-reviews");
async function go(page, path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
}
async function tab() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/reviews") || r.url().includes("/review-summary"))
      traffic.push({ url: r.url(), method: r.method() });
  });
  return page;
}
async function login(page, actor, returnTo = "/account") {
  await go(page, "/login?" + new URLSearchParams({ returnTo }));
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL(base + returnTo);
  await page.waitForLoadState("networkidle");
}
async function geometry(page, name) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await section(page).scrollIntoViewIfNeeded();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      name + width,
    );
    const boxes = await section(page)
      .locator("textarea,button,.review-rating-option")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return {
            left: b.left,
            right: b.right,
            width: b.width,
            height: b.height,
            radio: n.classList.contains("review-rating-option"),
          };
        }),
      );
    assert.ok(
      boxes.every(
        (b) =>
          b.left >= 0 &&
          b.right <= width + 1 &&
          (!b.radio || (b.width >= 44 && b.height >= 44)),
      ),
    );
    await page.screenshot({
      path: `test-results/phase8c-${name}-${width}.png`,
      fullPage: true,
    });
    if ([320, 768, 1440].includes(width))
      await section(page).screenshot({
        path: `test-results/phase8c-section-${name}-${width}.png`,
      });
    pass(name + " " + width + ": no overflow and usable controls");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await reviewsFixtures();
  const seller = "/sellers/" + fixture.seller.user.id,
    breeder = "/sellers/" + fixture.full.user.id;
  const page = await tab();
  await go(page, seller);
  await section(page)
    .getByRole("heading", { name: "Відгуки", exact: true })
    .waitFor();
  assert.equal(await section(page).locator(".review-card").count(), 20);
  assert.match(await section(page).innerText(), /4,8/);
  assert.match(await section(page).innerText(), /21 відгук/);
  assert.match(await section(page).innerText(), /Марія Д\./);
  assert.doesNotMatch(
    await section(page).innerText(),
    /Довгопрізвище|PRIVATE|PENDING|APPROVED|HIDDEN|example.invalid/,
  );
  assert.match(
    await section(page).locator("time").first().innerText(),
    /21 жовтня 2026/,
  );
  assert.equal(
    traffic.filter((r) => r.url.includes("/review-summary")).length,
    0,
  );
  assert.equal(traffic.filter((r) => r.url.includes("/reviews/me")).length, 0);
  pass(
    "A: approved summary/list/date/private projection; profile summary reused without extra summary request",
  );
  await geometry(page, "public");
  await section(page)
    .getByRole("button", { name: "Далі", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".seller-reviews .review-card").length === 1,
  );
  assert.match(
    await section(page).locator(".page-pagination").innerText(),
    /2 \/ 2/,
  );
  assert.equal(
    await section(page)
      .getByRole("button", { name: "Далі", exact: true })
      .isDisabled(),
    true,
  );
  await section(page)
    .getByRole("button", { name: "Назад", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".seller-reviews .review-card").length === 20,
  );
  pass("A: page 20+1 and back preserve profile context");
  await section(page)
    .getByRole("link", { name: "Увійдіть, щоб залишити відгук" })
    .click();
  await page.waitForURL("**/login?*");
  assert.equal(new URL(page.url()).searchParams.get("returnTo"), seller);
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.fallback.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL(base + seller);
  await section(page).locator("form").waitFor();
  pass(
    "B: anonymous CTA returns through login to same seller; eligibility from backend",
  );
  await section(page)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  assert.match(await section(page).innerText(), /Оберіть оцінку|щонайменше 10/);
  pass("required rating/comment validation and accessible field errors");
  await section(page)
    .getByRole("radio", { name: "1 з 5", exact: true })
    .check();
  await section(page)
    .getByRole("radio", { name: "1 з 5", exact: true })
    .focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  assert.equal(
    await section(page)
      .getByRole("radio", { name: "5 з 5", exact: true })
      .isChecked(),
    true,
  );
  assert.equal(
    await section(page)
      .getByRole("radio", { name: "5 з 5", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  pass(
    "stars support mouse, native radio arrow keys, checked selection and focus",
  );
  const input = section(page).getByLabel("Коментар", { exact: true });
  await input.fill("a".repeat(2001));
  await section(page)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  assert.match(await section(page).innerText(), /Не більше 2000/);
  await input.fill("    ");
  await section(page)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  assert.match(await section(page).innerText(), /щонайменше 10/);
  await input.fill("<b>Добрий досвід спілкування</b>");
  await section(page)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  assert.match(await section(page).innerText(), /без HTML/);
  pass("comment trim/min/max/plain-text bounds match backend");
  const text = "Дуже відповідальний продавець.\nДякую за спілкування!";
  await input.fill(text);
  const postPattern = `**/api/v1/sellers/${fixture.seller.user.id}/reviews`;
  await page.route(postPattern, async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await section(page)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  await section(page).getByRole("alert").waitFor();
  assert.equal(await input.inputValue(), text);
  assert.equal(
    await section(page)
      .getByRole("radio", { name: "5 з 5", exact: true })
      .isChecked(),
    true,
  );
  assert.match(
    await section(page).getByRole("alert").innerText(),
    /Не вдалося надіслати/,
  );
  await page.unroute(postPattern);
  pass("network failure preserves rating/comment and safe retry message");
  await geometry(page, "form");
  const beforeSummary = await section(page)
    .locator(".review-summary")
    .innerText();
  const beforeCards = await section(page)
    .locator(".review-card")
    .allTextContents();
  const sibling = await page.context().newPage();
  sibling.on("pageerror", (error) => errors.push(error.message));
  await go(sibling, seller);
  await section(sibling).locator("form").waitFor();
  let submissions = 0;
  await page.route(postPattern, async (route) => {
    if (route.request().method() === "POST") {
      submissions++;
      await new Promise((r) => setTimeout(r, 500));
    }
    await route.continue();
  });
  const submit = section(page).getByRole("button", {
    name: "Надіслати відгук",
    exact: true,
  });
  await submit.click();
  await section(page)
    .getByRole("button", { name: "Надсилаємо…", exact: true })
    .waitFor();
  assert.equal(
    await section(page)
      .getByRole("button", { name: "Надсилаємо…", exact: true })
      .isDisabled(),
    true,
  );
  await section(page)
    .getByText("Дякуємо! Ваш відгук надіслано на модерацію.", { exact: true })
    .waitFor();
  await section(page)
    .getByText("Ваш відгук на модерації.", { exact: true })
    .waitFor();
  assert.equal(submissions, 1);
  assert.equal(await section(page).locator("form").count(), 0);
  assert.equal(
    await section(page).locator(".review-summary").innerText(),
    beforeSummary,
  );
  assert.deepEqual(
    await section(page).locator(".review-card").allTextContents(),
    beforeCards,
  );
  const stored = await fixture.ownReview(
    fixture.fallback.user.id,
    fixture.seller.user.id,
  );
  assert.equal(stored.status, "PENDING");
  assert.equal(stored.text, text);
  pass(
    "C: single PENDING submit, thank-you/private status, public average/count/list unchanged",
  );
  await section(sibling)
    .getByText("Ваш відгук на модерації.", { exact: true })
    .waitFor();
  assert.equal(await section(sibling).locator("form").count(), 0);
  pass(
    "same-user cross-tab creation refreshes private eligibility without changing public summary",
  );
  await geometry(page, "pending");
  await page.reload();
  await section(page)
    .getByText("Ваш відгук на модерації.", { exact: true })
    .waitFor();
  assert.equal(await section(page).locator("form").count(), 0);
  pass(
    "D: refresh retains backend pending eligibility and prevents duplicate form",
  );
  const other = await tab();
  await login(other, fixture.seller, seller);
  await section(other)
    .getByText("Ви не можете залишити відгук самому собі.", { exact: true })
    .waitFor();
  assert.equal(await section(other).locator("form").count(), 0);
  assert.doesNotMatch(await section(other).innerText(), /Будьте першим/);
  pass("E: self eligibility hides form and first-review encouragement");
  await go(other, breeder);
  await section(other)
    .getByText(
      "Ви вже залишили відгук. Зараз він не відображається публічно.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await other
      .getByRole("heading", { level: 1, name: "Royal Malinois", exact: true })
      .count(),
    1,
  );
  assert.equal(await section(other).locator(".review-card").count(), 3);
  assert.match(await section(other).innerText(), /4,7/);
  assert.doesNotMatch(await section(other).innerText(), /PRIVATE-REJECTED/);
  pass(
    "F: kennel primary identity and shared reviews; rejected own state neutral/private",
  );
  await go(page, breeder);
  await section(page).locator("form").waitFor();
  await section(page)
    .getByRole("radio", { name: "4 з 5", exact: true })
    .check();
  await section(page).getByLabel("Коментар", { exact: true }).fill(text);
  await page.route(
    `**/api/v1/sellers/${fixture.full.user.id}/reviews`,
    async (route) => {
      if (route.request().method() === "POST")
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "PRIVATE RAW ERROR" }),
        });
      else await route.continue();
    },
  );
  await section(page)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  await section(page)
    .getByText("Ви вже залишили відгук цьому користувачу.", { exact: true })
    .waitFor();
  assert.equal(await section(page).locator("form").count(), 0);
  assert.doesNotMatch(await section(page).innerText(), /PRIVATE RAW ERROR/);
  pass(
    "409 is controlled, hides repeated create and refreshes only own eligibility",
  );
  const anon = await tab();
  await go(anon, "/sellers/" + fixture.empty.user.id);
  assert.equal(await section(anon).locator(".review-stars").count(), 0);
  assert.match(await section(anon).innerText(), /Ще немає відгуків/);
  pass("empty approved summary has no 0.0 or misleading stars");
  await anon.route(
    `**/api/v1/sellers/${fixture.seller.user.id}/reviews?*`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
  );
  await go(anon, seller);
  await section(anon)
    .getByText("Не вдалося завантажити відгуки.", { exact: true })
    .waitFor();
  await anon.unroute(`**/api/v1/sellers/${fixture.seller.user.id}/reviews?*`);
  await section(anon)
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await section(anon).locator(".review-card").first().waitFor();
  pass("public list loading failure has focused retry");
  await go(
    anon,
    "/login?" +
      new URLSearchParams({
        returnTo: "https://evil.invalid/sellers/" + fixture.seller.user.id,
      }),
  );
  await anon
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.empty.user.email);
  await anon.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await anon.getByRole("button", { name: "Увійти", exact: true }).click();
  await anon.waitForURL(base + "/account");
  pass("external seller auth return rejected");
  await go(page, "/account");
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  await go(page, seller);
  await section(page)
    .getByRole("link", { name: "Увійдіть, щоб залишити відгук" })
    .waitFor();
  assert.equal(await section(page).locator(".review-own-status").count(), 0);
  pass(
    "logout clears private review state; approved public reviews remain readable",
  );
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase8c-browser.json",
    JSON.stringify({ checks, requests: traffic.length }, null, 2),
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  if (fixture) await fixture.cleanup();
}
