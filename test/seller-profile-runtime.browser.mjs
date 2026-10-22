import assert from "node:assert/strict";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "msedge",
});
let fixture;
try {
  fixture = await breederProfileFixtures({ animals: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      /same key|No queryFn|hydrated but|hydration failed/i.test(message.text())
    )
      errors.push(message.text());
  });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://localhost:3000/sellers/${fixture.full.user.id}`);
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator(".seller-reviews").count(), 1);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.goto("http://localhost:3000/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.seller.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  const ownListing = fixture.seller.listings.find(
    (listing) => listing.status === "ACTIVE",
  );
  await page.goto(`http://localhost:3000/listings/${ownListing.id}`);
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page
      .getByRole("button", { name: "Поскаржитися", exact: true })
      .count(),
    0,
  );
  const foreignListing = fixture.full.listings.find(
    (listing) => listing.status === "ACTIVE",
  );
  await page.goto(`http://localhost:3000/listings/${foreignListing.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Поскаржитися", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const favorite = page.locator(`[data-favorite-id="${foreignListing.id}"]`);
  await favorite.press("Enter");
  await page.waitForFunction((id) => {
    const button = document.querySelector(`[data-favorite-id="${id}"]`);
    return (
      button?.getAttribute("aria-pressed") === "true" &&
      button.getAttribute("aria-disabled") === "false"
    );
  }, foreignListing.id);
  await page.reload();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-favorite-id="${id}"]`)
        ?.getAttribute("aria-pressed") === "true",
    foreignListing.id,
  );
  assert.deepEqual(
    errors,
    [],
    "public breeder profile must reconcile without duplicate sibling keys or query/hydration errors",
  );
  console.log(
    "PASS seller profile runtime at 375/1440: unique keys, no query/hydration errors or overflow",
  );
} finally {
  await browser.close();
  if (fixture) await fixture.cleanup();
}
