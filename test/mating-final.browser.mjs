import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingCatalogFixtures } from "./helpers/mating-catalog-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [],
  errors = [],
  network = {};
let f,
  currentRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    r.method() !== "OPTIONS" &&
    r.url().startsWith("http://localhost:4000/api/v1/")
  )
    currentRequests.push(new URL(r.url()).pathname);
});
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function go(path, label) {
  // Dispose the previous document before measuring a fresh route mount.
  // This excludes its focus/refetch/cancellation work from the next page count.
  await page.goto("about:blank");
  currentRequests = [];
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
  if (label)
    network[label] = currentRequests.reduce(
      (counts, path) => ({ ...counts, [path]: (counts[path] ?? 0) + 1 }),
      {},
    );
}
async function geometry(path, label) {
  await go(path, label);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      label + " overflow " + width,
    );
    assert.equal(await page.locator("main select").count(), 0);
    for (const control of await page.locator("main .button").all()) {
      if (!(await control.isVisible())) continue;
      const box = await control.boundingBox();
      assert.ok(
        box.height >= 44 && box.x >= -1 && box.x + box.width <= width + 1,
        label + " target " + width,
      );
    }
    for (const badge of await page
      .locator(".mating-card .listing-status")
      .all()) {
      const badgeBox = await badge.boundingBox();
      const cardBox = await badge.locator("..").boundingBox();
      assert.ok(badgeBox.width < cardBox.width - 40, "compact status badge");
    }
    pass(label + " responsive " + width);
    if ([320, 1440].includes(width))
      await page.screenshot({
        path: `test-results/phase9f-${label}-${width}.png`,
        fullPage: false,
      });
  }
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingCatalogFixtures();
  await f.db.breederProfile.create({
    data: { userId: f.full.user.id, kennelName: "Розплідник Світанок" },
  });
  await f.db.pet.update({
    where: { id: f.breeder.id },
    data: { showOnBreederProfile: true },
  });
  const breederRow = await f.db.matingListing.create({
    data: {
      ownerId: f.full.user.id,
      petId: f.breeder.id,
      locationId: f.longLocation.id,
      title: "В’язка",
      description: "Умови обговорюються з власником.",
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  await geometry("/mating", "catalog");
  const card = page.locator(".mating-public-card").first();
  const link = card.locator(".listing-card-link");
  assert.equal(await link.count(), 1);
  assert.equal(await link.locator("a").count(), 0);
  await link.focus();
  assert.ok(await link.evaluate((el) => el.matches(":focus-visible")));
  const target = await link.getAttribute("href");
  await link.locator(".listing-visual, .listing-cover").click();
  await page.waitForURL("**" + target);
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page.locator(".listing-back-link").getAttribute("href"),
    "/mating",
  );
  pass(
    "image click opens detail with visible keyboard focus and safe catalog return",
  );
  await geometry("/mating/" + breederRow.id, "detail");
  const noScript = await browser.newPage({ javaScriptEnabled: false });
  try {
    const serverResponse = await noScript.goto(
      "http://localhost:3000/mating/" + breederRow.id,
    );
    const serverHtml = await serverResponse.text();
    // Next's route loading boundary reveals streamed HTML using JavaScript.
    // Inspect the real server DOM, independent of that framework reveal script.
    assert.ok(serverHtml.includes('<h2 id="mating-about">'));
    assert.equal(
      await noScript.locator("#mating-about").textContent(),
      "Про тварину та умови в’язки",
    );
    assert.equal(
      await noScript
        .locator(".mating-detail-grid .listing-detail-skeleton")
        .count(),
      0,
    );
    assert.equal(
      await noScript
        .getByRole("button", { name: "Показати телефон", exact: true })
        .count(),
      0,
    );
    pass(
      "fresh detail supplies server HTML while contacts await session hydration",
    );
  } finally {
    await noScript.close();
  }
  await geometry("/pets/" + f.breeder.id, "public-pet");
  await geometry("/sellers/" + f.seller.user.id, "seller");
  await geometry("/sellers/" + f.full.user.id, "breeder");
  const profileCards = page.locator(
    ".profile-mating-section .mating-public-card",
  );
  assert.equal(await profileCards.locator(".mating-public-seller").count(), 0);
  assert.equal(await profileCards.locator('a[href^="/sellers/"]').count(), 0);
  pass("profile cards omit redundant publisher identity and self-navigation");
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(f.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
  await geometry("/mating/my", "management");
  await geometry("/mating/new?petId=" + f.known.id, "create");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Тварина", exact: true })
      .getAttribute("data-value"),
    f.known.id,
  );
  assert.ok(
    await page
      .getByText("Оберіть свою тварину, для якої шукаєте пару.", {
        exact: true,
      })
      .isVisible(),
  );
  await geometry("/mating/" + f.active.id + "/edit", "edit");
  await geometry("/pets", "owned-pets");
  await writeFile(
    "test-results/phase9f-request-counts.json",
    JSON.stringify(network, null, 2),
  );
  for (const key of [
    "catalog",
    "detail",
    "public-pet",
    "seller",
    "breeder",
    "management",
  ])
    for (const [path, count] of Object.entries(network[key]))
      assert.equal(count, 1, key + " duplicate client request " + path);
  pass(
    "representative production client requests have no duplicate endpoint calls",
  );
  assert.deepEqual(errors, []);
  pass("zero browser runtime errors");
  await writeFile(
    "test-results/phase9f-browser.json",
    JSON.stringify({ checks, errors, clientRequests: network }, null, 2),
  );
} finally {
  await browser.close();
  if (f) await f.cleanup();
}
