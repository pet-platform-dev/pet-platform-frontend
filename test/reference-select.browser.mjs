import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
await (
  await import("node:fs/promises")
).mkdir("test-results", { recursive: true });
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
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage(),
  base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
const requests = [],
  errors = [],
  checks = [];
const pass = (text) => {
  checks.push(text);
  console.log("PASS " + text);
};
const until = async (work) => {
  const deadline = Date.now() + 15000;
  let last;
  while (Date.now() < deadline) {
    try {
      return await work();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw last;
};
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url()));
try {
  await page.goto(base + "/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill("demo.owner1@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("DemoPass123!");
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.goto(base + "/listings/new");
  await page.getByRole("heading", { name: "Створити оголошення" }).waitFor();
  let input = page.getByRole("combobox", { name: "Місце", exact: true });
  await input.focus();
  const initial = requests.filter((url) => url.includes("/locations?")).length;
  await input.fill("с");
  await page.waitForTimeout(350);
  assert.equal(
    requests.filter((url) => url.includes("/locations?")).length,
    initial,
  );
  pass("Location minimum 2 characters prevents requests");
  await input.fill("сві");
  await page.waitForTimeout(120);
  assert.equal(
    requests.filter((url) => url.includes("/locations?")).length,
    initial,
  );
  await until(async () =>
    assert.ok(
      requests.some(
        (url) =>
          url.includes("/locations?") &&
          new URL(url).searchParams.get("search") === "сві",
      ),
    ),
  );
  pass("Location 250 ms debounce");
  const list = page.getByRole("listbox");
  async function scrollForText(text, max = 120) {
    for (let i = 0; i < max; i++) {
      const option = page
        .locator(".reference-results [role=option]")
        .filter({ has: page.getByText(text, { exact: true }) })
        .first();
      if (await option.count()) return option;
      await list.evaluate((el) => {
        el.scrollTop += el.clientHeight - 40;
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await page.waitForTimeout(180);
    }
    throw Error("Option not found: " + text);
  }
  await until(async () =>
    assert.ok(await page.locator(".reference-results [role=option]").count()),
  );
  const svit = await scrollForText("Світловодськ");
  assert.ok((await svit.innerText()).includes("Кіровоградська область"));
  await svit.getByRole("button").click();
  assert.ok(
    (await page.locator(".selected-breed").innerText()).includes(
      "Світловодськ",
    ),
  );
  pass("Svitlovodsk contextual selection and clear");
  await page.getByRole("button", { name: "Очистити місце" }).click();
  await input.fill("світле");
  await page.waitForTimeout(450);
  await until(async () =>
    assert.ok(await page.locator(".reference-results [role=option]").count()),
  );
  await until(async () =>
    assert.ok((await list.innerText()).includes("область")),
  );
  const duplicateContext = await list.innerText();
  assert.ok(duplicateContext.includes("область"));
  assert.ok(
    new Set(
      (
        await page.locator(".reference-results [role=option]").allTextContents()
      ).map((text) => text.trim()),
    ).size > 1,
  );
  pass("Duplicate settlement names display region/district/community context");
  assert.equal(
    await input.getAttribute("placeholder"),
    "Введіть назву міста або села",
  );
  await input.fill("Кіровоградська область");
  await page.getByText("Нічого не знайдено. Спробуйте іншу назву.").waitFor();
  assert.equal(
    await page.locator(".reference-results [role=option]").count(),
    0,
  );
  pass("Oblast-only text does not act as a region filter");
  await page.route(api + "/locations?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("search") === "ів" && params.get("page") === "2")
      await page.waitForTimeout(700);
    await route.continue();
  });
  await input.fill("ів");
  await page.waitForTimeout(400);
  await until(async () =>
    assert.ok(await page.locator(".reference-results [role=option]").count()),
  );
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await until(async () =>
    assert.ok(
      requests.some(
        (url) =>
          url.includes("/locations?") &&
          new URL(url).searchParams.get("search") === "ів" &&
          new URL(url).searchParams.get("page") === "2",
      ),
    ),
  );
  await page.getByText("Завантажуємо…", { exact: true }).waitFor();
  assert.ok(
    (await page.locator(".reference-results [role=option]").count()) > 0,
  );
  pass("Loading another page preserves existing choices and keeps form usable");
  await page.waitForTimeout(850);
  await page.unroute(api + "/locations?*");
  const positions = await page
    .locator(".reference-results [role=option]")
    .evaluateAll((rows) =>
      rows.map((row) => Number(row.getAttribute("aria-posinset"))),
    );
  assert.ok(Math.min(...positions) <= 50 && Math.max(...positions) > 50);
  assert.ok(
    (await page.locator(".reference-results [role=option]").count()) <= 14,
  );
  assert.ok(await list.evaluate((el) => el.scrollHeight > el.clientHeight));
  pass("Location infinite scroll fetches page 2 and virtualizes DOM");
  for (let pageNumber = 3; pageNumber <= 12; pageNumber++) {
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/locations?") &&
        new URL(r.url()).searchParams.get("search") === "ів" &&
        new URL(r.url()).searchParams.get("page") === String(pageNumber),
    );
    await list.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await response;
    await page.waitForTimeout(100);
  }
  assert.ok(
    (await page.locator(".reference-results [role=option]").count()) <= 14,
  );
  assert.ok((await list.evaluate((el) => el.scrollHeight)) <= 500 * 88);
  const previousRequests = requests.filter(
    (url) =>
      url.includes("/locations?") &&
      new URL(url).searchParams.get("search") === "ів" &&
      new URL(url).searchParams.get("page") === "2",
  ).length;
  await list.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await until(async () =>
    assert.ok(
      requests.filter(
        (url) =>
          url.includes("/locations?") &&
          new URL(url).searchParams.get("search") === "ів" &&
          new URL(url).searchParams.get("page") === "2",
      ).length > previousRequests,
    ),
  );
  await page.waitForTimeout(150);
  pass(
    "Long scroll keeps at most 10 cached pages/14 DOM rows and reloads previous window",
  );
  const locationRoute = api + "/locations?*";
  await page.route(locationRoute, async (route) => {
    const term = new URL(route.request().url()).searchParams.get("search");
    if (term === "стара") {
      await page.waitForTimeout(900);
      await route.fulfill({
        json: {
          data: [
            {
              id: randomUUID(),
              city: "СТАРИЙ РЕЗУЛЬТАТ",
              region: "Тест",
              countryCode: "UA",
              district: null,
              community: null,
              settlementType: "CITY",
              katottgCode: null,
            },
          ],
          meta: { page: 1, limit: 50, total: 1, pages: 1 },
        },
      });
    } else await route.continue();
  });
  await input.fill("стара");
  await page.waitForTimeout(350);
  await input.fill("київ");
  assert.equal(
    await page.locator(".reference-results [role=option]").count(),
    0,
  );
  await page.waitForTimeout(1150);
  assert.ok(!(await list.innerText()).includes("СТАРИЙ"));
  assert.ok((await list.innerText()).includes("Київ"));
  pass("Slow old request cannot flash over newer search");
  await page.unroute(locationRoute);
  const keyboardChoice = await page
    .locator(".reference-results [role=option] strong")
    .first()
    .textContent();
  await input.press("ArrowDown");
  await input.press("Enter");
  assert.equal(
    await page.locator(".selected-breed strong").textContent(),
    keyboardChoice,
  );
  pass("Location arrows/Enter select");
  await input.focus();
  await input.press("Escape");
  assert.equal(await list.count(), 0);
  pass("Escape closes listbox");
  const visibleLocationRows = new Map();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await input.fill("сві");
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const box = await list.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
    const density = await list.evaluate((el) => {
      const bounds = el.getBoundingClientRect();
      const rows = [...el.querySelectorAll('[role="option"]')];
      return {
        rowHeight: rows[0].getBoundingClientRect().height,
        visible: rows.filter((row) => {
          const rect = row.getBoundingClientRect();
          return rect.top >= bounds.top && rect.bottom <= bounds.bottom + 1;
        }).length,
        overflow: el.scrollWidth > el.clientWidth,
        contentFits: rows.every((row) => {
          const button = row.querySelector("button");
          return button.scrollHeight <= button.clientHeight;
        }),
      };
    });
    assert.equal(density.rowHeight, width >= 768 ? 88 : 128);
    assert.equal(density.overflow, false);
    assert.equal(density.contentFits, true);
    visibleLocationRows.set(width, density.visible);
    await input.press("ArrowDown");
    const activeId = await input.getAttribute("aria-activedescendant");
    const activeButton = page.locator(`[id="${activeId}"] button`);
    const activeColor = await activeButton.evaluate(
      (el) => getComputedStyle(el.parentElement).backgroundColor,
    );
    await page
      .locator(".reference-results [role=option] button")
      .nth(1)
      .hover();
    assert.equal(
      await page
        .locator(".reference-results [role=option] button")
        .nth(1)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      activeColor,
    );
    await page.screenshot({
      path: `test-results/reference-location-${width}.png`,
      fullPage: true,
    });
  }
  assert.ok(visibleLocationRows.get(1024) > visibleLocationRows.get(320));
  assert.ok(visibleLocationRows.get(1440) > visibleLocationRows.get(320));
  await list.evaluate((el) => {
    el.scrollTop = 20 * 88;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.setViewportSize({ width: 320, height: 1100 });
  await until(async () =>
    assert.equal(await list.evaluate((el) => el.scrollTop), 20 * 128),
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await until(async () =>
    assert.equal(await list.evaluate((el) => el.scrollTop), 20 * 88),
  );
  await input.fill("світле");
  await page.waitForTimeout(450);
  for (let index = 0; index < 10; index++) await input.press("ArrowDown");
  const navigatedId = await input.getAttribute("aria-activedescendant");
  const navigatedBounds = await page
    .locator(`[id="${navigatedId}"]`)
    .boundingBox();
  const listBounds = await list.boundingBox();
  assert.ok(navigatedBounds.y >= listBounds.y);
  assert.ok(
    navigatedBounds.y + navigatedBounds.height <=
      listBounds.y + listBounds.height + 1,
  );
  pass(
    "320/375/768/1024/1440px Location density preserves readable context, states and no overflow; desktop fits more rows",
  );
  await input.press("Escape");
  if (await page.getByRole("button", { name: "Очистити місце" }).count())
    await page.getByRole("button", { name: "Очистити місце" }).click();
  await input.fill("світловодськ");
  await page.waitForTimeout(400);
  await until(async () =>
    assert.ok(await page.locator(".reference-results [role=option]").count()),
  );
  await page
    .locator(".reference-results [role=option]")
    .filter({ has: page.getByText("Світловодськ", { exact: true }) })
    .first()
    .getByRole("button")
    .click();
  await page
    .getByRole("radio", { name: "Вибрати з моїх тварин", exact: true })
    .check();
  await page.getByLabel("Тварина", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Безкоштовно", { exact: true }).check();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill("Перевірка вибраного місця");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Локальна перевірка форми");
  let submitted;
  await page.route(api + "/listings", async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { data: { id: randomUUID(), status: "DRAFT" } },
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Створити чернетку" }).click();
  await page.getByRole("heading", { name: "Оголошення створено" }).waitFor();
  const officialResponse = await context.request.get(
    api + "/locations?search=" + encodeURIComponent("Світловодськ"),
  );
  const officialCity = (await officialResponse.json()).data.find(
    (row) => row.katottgCode === "UA35080170010073614",
  );
  assert.equal(submitted.locationId, officialCity.id);
  pass("Listing form submits selected persisted Location UUID");
  await page.unroute(api + "/listings");
  await page.goto(base + "/pets/new");
  await page
    .getByLabel("Вид тварини", { exact: true })
    .selectOption({ label: "Собака" });
  input = page.getByRole("combobox", { name: "Порода" });
  await input.focus();
  await until(async () =>
    assert.ok(await page.locator(".reference-results [role=option]").count()),
  );
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await until(async () =>
    assert.ok(
      requests.some(
        (url) =>
          url.includes("/breeds?") &&
          new URL(url).searchParams.get("page") === "2",
      ),
    ),
  );
  pass("Breed scroll auto-loads page 2 without pagination controls");
  await input.fill("mal");
  await page.waitForTimeout(450);
  await until(async () =>
    assert.ok((await list.innerText()).includes("Belgian Malinois")),
  );
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("Enter");
  assert.ok(
    (await page.locator(".selected-breed").innerText()).includes(
      "Belgian Malinois",
    ),
  );
  pass("Breed search mal and keyboard selection");
  await page
    .getByLabel("Вид тварини", { exact: true })
    .selectOption({ label: "Кіт" });
  input = page.getByRole("combobox", { name: "Порода" });
  assert.equal(await input.inputValue(), "");
  assert.equal(await page.locator(".selected-breed").count(), 0);
  await input.fill("maine");
  await page.waitForTimeout(450);
  await until(async () =>
    assert.ok((await list.innerText()).includes("Maine Coon")),
  );
  await input.press("ArrowDown");
  await input.press("Enter");
  assert.ok(
    (await page.locator(".selected-breed").innerText()).includes("Maine Coon"),
  );
  pass("Dog to Cat resets Breed selection/search/pages and cat search works");
  await input.focus();
  await input.press("Escape");
  assert.equal(await list.count(), 0);
  await input.fill("zzzzzzzzzz");
  await page.waitForTimeout(450);
  await page.getByText("Нічого не знайдено. Спробуйте іншу назву.").waitFor();
  pass("Empty reference search state");
  await page
    .getByLabel("Вид тварини", { exact: true })
    .selectOption({ label: "Собака" });
  input = page.getByRole("combobox", { name: "Порода" });
  await input.focus();
  await until(async () =>
    assert.ok(
      await page
        .locator('.reference-results [role=option][aria-posinset="1"]')
        .count(),
    ),
  );
  pass(
    "Returning to Dog starts at page 1 rather than reusing previously loaded pages",
  );
  await page.route(api + "/breeds?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("search") === "fail")
      await route.fulfill({ status: 503, json: { message: "PRIVATE_ERROR" } });
    else await route.continue();
  });
  await input.fill("fail");
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .waitFor({ timeout: 20000 });
  assert.ok(
    !(await page.locator("body").innerText()).includes("PRIVATE_ERROR"),
  );
  await page.unroute(api + "/breeds?*");
  await page
    .getByRole("button", { name: "Спробувати ще раз", exact: true })
    .click();
  await page.getByText("Нічого не знайдено. Спробуйте іншу назву.").waitFor();
  pass("Reference error and retry remain local to selector");
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await input.fill("");
    await input.focus();
    await until(async () =>
      assert.ok(await page.locator(".reference-results [role=option]").count()),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.ok(
      !(await page.locator(".reference-results").innerText()).match(
        /Наступна сторінка|Назад|Далі/,
      ),
    );
    await page.screenshot({
      path: `test-results/reference-breed-${width}.png`,
      fullPage: true,
    });
  }
  pass("320/375/768/1024/1440px Breed dropdown has no pagination or overflow");
  assert.deepEqual(errors, []);
  assert.ok(
    requests.every((url) =>
      ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
    ),
  );
  pass("No hydration/runtime errors or external provider requests");
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (error) {
  console.log(
    "DEBUG " +
      JSON.stringify({
        input: await page.getByRole("combobox").allTextContents(),
        list: await page.getByRole("listbox").allTextContents(),
      }),
  );
  await page.screenshot({
    path: "test-results/reference-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
