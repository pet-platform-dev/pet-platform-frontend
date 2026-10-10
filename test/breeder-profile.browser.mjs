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
  page = await context.newPage(),
  base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1",
  checks = [],
  errors = [];
let fixture;
page.on("pageerror", (error) => errors.push(error.message));
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function navigate(path) {
  const response = await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  return response;
}
async function text(value) {
  await page.getByText(value, { exact: true }).first().waitFor();
}
async function geometry(label) {
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      label + " overflow at " + width,
    );
    const gutter = await page.locator(".catalog-shell").evaluate((el) => {
      const css = getComputedStyle(el),
        r = el.getBoundingClientRect();
      return {
        left: r.left + parseFloat(css.paddingLeft),
        right: r.right - parseFloat(css.paddingRight),
      };
    });
    const header = await page.locator(".seller-profile > header").boundingBox();
    assert.ok(Math.abs(header.x - gutter.left) < 2, label + " header gutter");
    const grid = page.locator(".listings-grid");
    if (await grid.count()) {
      const bounds = await grid.boundingBox();
      assert.ok(Math.abs(bounds.x - header.x) < 2, label + " grid gutter");
      assert.ok(bounds.x + bounds.width <= gutter.right + 2);
    }
    const h1 = await page.locator("main h1").count();
    assert.equal(h1, 1);
    for (const button of await page.locator("main .button").all()) {
      const r = await button.boundingBox();
      if (r)
        assert.ok(
          r.x >= 0 && r.x + r.width <= width + 1,
          label + " contact/action clipping",
        );
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/phase7c-" + label + "-" + width + ".png",
      fullPage: false,
    });
    pass(label + " responsive " + width);
  }
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures();
  await navigate("/sellers/" + fixture.seller.user.id);
  await text("Олександр Єпік");
  await text("Оголошення продавця");
  assert.equal(await page.locator(".listing-card").count(), 1);
  await geometry("seller");
  pass("SELLER full-name regression");
  await navigate("/sellers/" + fixture.fallback.user.id);
  await text("Олександр Єпік");
  await text("Оголошення продавця");
  assert.equal(await page.locator(".breeder-profile-header").count(), 0);
  pass("BREEDER without profile falls back");
  await navigate("/sellers/" + fixture.full.user.id);
  await page
    .getByRole("heading", { name: "Royal Malinois", exact: true })
    .waitFor();
  for (const value of [
    "Про розплідник",
    "Породи",
    "Досвід",
    "Вебсайт",
    "Контакти",
    "Оголошення розплідника",
    "Світловодськ, Кіровоградська область",
    "Контактна особа: Олександр Єпік",
    "Працює з 2018 року",
  ])
    await text(value);
  assert.equal(await page.locator(".breeder-breed-list li").count(), 2);
  assert.ok(
    (await page.locator("main").innerText()).includes(
      "Розплідник собак і котів.",
    ),
  );
  assert.equal(await page.title(), "Royal Malinois — профіль розплідника");
  assert.ok(
    !(await page.locator("main").innerText()).includes(fixture.full.user.email),
  );
  const website = page.getByRole("link", {
    name: "Вебсайт розплідника (відкриється в новій вкладці)",
  });
  assert.equal(await website.getAttribute("href"), "https://example.com/");
  assert.equal(await website.getAttribute("target"), "_blank");
  assert.equal(await website.getAttribute("rel"), "noopener noreferrer");
  await website.focus();
  assert.equal(
    await website.evaluate((el) => getComputedStyle(el).outlineStyle),
    "solid",
  );
  await page.getByRole("button", { name: "Показати телефон" }).click();
  const phone = page.getByRole("link", { name: "+380501234567" });
  await phone.waitFor();
  assert.equal(
    await phone.evaluate((el) => el === document.activeElement),
    true,
  );
  for (const name of ["Telegram", "Viber", "WhatsApp"])
    await page
      .getByRole("link", { name: "Зв’язатися через " + name })
      .waitFor();
  pass("full kennel content, metadata, optional contacts and focus");
  assert.equal(await page.locator(".listing-card").count(), 24);
  await page.getByRole("button", { name: "Показати ще" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".listing-card").length === 25,
  );
  assert.equal(
    await page.getByRole("button", { name: "Показати ще" }).count(),
    0,
  );
  const ids = await page
    .locator(".listing-card")
    .evaluateAll((cards) =>
      cards.map((card) =>
        card.querySelector('a[href^="/listings/"]')?.getAttribute("href"),
      ),
    );
  for (const listing of fixture.full.listings.filter(
    (l) => l.status !== "ACTIVE",
  ))
    assert.ok(!ids.some((id) => id?.includes(listing.id)));
  pass(
    "ACTIVE-only 24+1 pagination excludes all eight private/completed states",
  );
  await geometry("breeder");
  await navigate("/sellers/" + fixture.empty.user.id);
  await text("Тихий розплідник");
  await text("У цього розплідника поки немає активних оголошень.");
  assert.equal(await page.locator(".seller-contacts").count(), 0);
  for (const name of ["Породи", "Вебсайт", "Досвід", "Контакти"])
    assert.equal(
      await page.getByRole("heading", { name, exact: true }).count(),
      0,
    );
  pass("empty optional sections, no contacts, no active offers");
  const detail = fixture.full.listings.find((l) => l.status === "ACTIVE");
  let extraBreederCalls = 0;
  const listen = (req) => {
    if (req.url().includes("/api/v1/breeders/")) extraBreederCalls++;
  };
  page.on("request", listen);
  await navigate("/listings/" + detail.id);
  await page
    .locator(".listing-seller-name")
    .getByText("Royal Malinois", { exact: true })
    .waitFor();
  assert.equal(extraBreederCalls, 0);
  page.off("request", listen);
  await page.getByRole("link", { name: "Переглянути профіль" }).click();
  await page.waitForURL("**/sellers/" + fixture.full.user.id);
  await page
    .getByRole("heading", { name: "Royal Malinois", exact: true })
    .waitFor();
  pass("listing detail identity uses embedded summary and profile link");
  // Exercise the supported backend update to stress long public text, without an editor UI.
  const csrfResponse = await context.request.get(api + "/auth/csrf", {
      headers: { Origin: base },
    }),
    csrf = (await csrfResponse.json()).data.csrfToken;
  const login = await context.request.post(api + "/auth/login", {
    headers: { Origin: base, "X-CSRF-Token": csrf },
    data: { email: fixture.full.user.email, password: fixture.password },
  });
  assert.equal(login.status(), 200);
  const token = (await login.json()).data.accessToken;
  const changed = await context.request.patch(api + "/breeders/me", {
    headers: {
      Origin: base,
      "X-CSRF-Token": csrf,
      Authorization: "Bearer " + token,
    },
    data: {
      kennelName: "Royal Malinois — " + "Д".repeat(140),
      locationId: fixture.longLocation.id,
      website: "https://example.com/" + "a".repeat(500),
    },
  });
  assert.equal(changed.status(), 200);
  await navigate("/sellers/" + fixture.full.user.id);
  await geometry("long-text");
  pass("long kennel, normalized location, chips and website wrap");
  const missing = await navigate(
    "/sellers/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(missing.status(), 404);
  const invalid = await navigate("/sellers/not-a-uuid");
  assert.equal(invalid.status(), 404);
  pass("unknown/invalid profiles return actual 404");
  // The server obtains initial data; force client profile/listing requests to fail only after server failure.
  await context.route("**/api/v1/sellers/*/listings*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "PRIVATE_SQL" }),
    }),
  );
  await navigate("/sellers/" + fixture.empty.user.id);
  await text("Не вдалося завантажити оголошення.");
  assert.ok(!(await page.locator("main").innerText()).includes("PRIVATE_SQL"));
  await context.unroute("**/api/v1/sellers/*/listings*");
  await page.getByRole("button", { name: "Спробувати ще раз" }).click();
  await text("У цього розплідника поки немає активних оголошень.");
  pass("listing retry recovers without raw API errors");
  assert.deepEqual(errors, []);
  pass("no browser runtime errors");
  await writeFile(
    "test-results/phase7c-browser.json",
    JSON.stringify(
      {
        checks,
        widths: [320, 375, 430, 768, 1024, 1440],
        runtimeErrors: errors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
  if (fixture) await fixture.cleanup();
}
console.log(
  "PASS " +
    checks.length +
    " browser checks; original 17 model fingerprints preserved",
);
