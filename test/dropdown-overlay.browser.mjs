import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_URL);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const id = "11111111-1111-4111-8111-111111111111";
const speciesId = "22222222-2222-4222-8222-222222222222";
const breed = { id, name: "Malinois", nameUk: "Малінуа", speciesId };
const location = {
  id,
  countryCode: "UA",
  city: "Світловодськ",
  region: "Кіровоградська область",
  district: null,
  community: null,
  settlementType: "CITY",
  katottgCode: null,
};
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const envelope = (data, total = data.length, current = 1) => ({
  data,
  meta: { page: current, limit: 50, total, pages: Math.ceil(total / 50) },
});
await page.route("**/api/v1/**", async (route) => {
  const url = new URL(route.request().url());
  let body;
  if (url.pathname === "/api/v1/breeders")
    body = {
      data: [
        {
          userId: id,
          kennelName: "Тестовий розплідник",
          description: null,
          logo: null,
          location: null,
          breeds: [],
        },
      ],
      meta: { page: 1, limit: 24, total: 1, pages: 1, hasPublicBreeders: true },
    };
  else if (url.pathname === "/api/v1/species")
    body = {
      data: [
        { id: speciesId, slug: "dog", name: "Dog" },
        { id, slug: "cat", name: "Cat" },
      ],
    };
  else if (url.pathname === "/api/v1/breeds") {
    const current = Number(url.searchParams.get("page") || 1);
    body = envelope(
      Array.from({ length: current === 1 ? 50 : 5 }, (_, i) => ({
        ...breed,
        id: `33333333-3333-4333-8333-${String(i + (current - 1) * 50).padStart(12, "0")}`,
        nameUk: `Малінуа ${i + (current - 1) * 50}`,
      })),
      55,
      current,
    );
  } else if (url.pathname === "/api/v1/locations") body = envelope([location]);
  else if (url.pathname === "/api/v1/breeders/filters")
    body = {
      data: {
        breed: url.searchParams.has("breedId") ? breed : null,
        location: url.searchParams.has("locationId") ? location : null,
      },
    };
  else return route.continue();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});
const snapshot = () =>
  page.evaluate(() => {
    const box = document
      .querySelector(".breeder-directory-filters")
      .getBoundingClientRect();
    const card = document
      .querySelector("a.breeder-directory-card")
      .getBoundingClientRect();
    return {
      height: box.height,
      cardY: card.y + scrollY,
      cardViewportY: card.y,
      scrollY,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
async function stationary(before) {
  assert.deepEqual(
    await snapshot(),
    before,
    "opening/closing must not reflow filter block or cards",
  );
}
try {
  await mkdir("test-results", { recursive: true });
  for (const width of process.env.OVERLAY_REPRO
    ? [1440]
    : [320, 375, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://localhost:3000/breeders");
    await page.locator("a.breeder-directory-card").waitFor();
    for (const label of process.env.OVERLAY_REPRO
      ? ["Порода"]
      : ["Вид тварини", "Порода", "Місто"]) {
      await page.setViewportSize({ width, height: 900 });
      const control = page.getByRole("combobox", { name: label, exact: true });
      await control.scrollIntoViewIfNeeded();
      const before = await snapshot();
      await control.click();
      if (label === "Місто") await control.fill("сві");
      const menu =
        label === "Вид тварини"
          ? page.locator(".select-dropdown-options")
          : page.locator(".reference-results[data-motion='open']");
      await menu.getByRole("option").first().waitFor();
      await stationary(before);
      let box = await menu.boundingBox();
      assert.ok(
        box.x >= 0 &&
          box.x + box.width <= width + 1 &&
          box.y >= 0 &&
          box.y + box.height <= 901,
        `viewport clipping ${label} ${width}`,
      );
      const point = await page.evaluate(() => {
        const menu = document.querySelector('[role="listbox"]');
        const r = menu.getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: Math.max(1, r.y + Math.min(20, r.height / 2)),
          id: menu.id,
        };
      });
      assert.equal(
        await page.evaluate(
          ({ x, y, id }) =>
            document.elementFromPoint(x, y)?.closest('[role="listbox"]')?.id ===
            id,
          point,
        ),
        true,
        "menu must be above adjacent content",
      );
      await control.press("ArrowDown");
      await control.press("Escape");
      assert.equal(await control.getAttribute("aria-expanded"), "false");
      assert.equal(
        await control.evaluate((el) => document.activeElement === el),
        true,
      );
      await page.waitForTimeout(180);
      await stationary(before);
      await control.click();
      await menu.waitFor();
      await page.mouse.click(2, 150);
      assert.equal(await control.getAttribute("aria-expanded"), "false");
      await page.waitForTimeout(180);
      await stationary(before);
      // Place the anchor near the bottom without adding page content.
      const edgeAnchor = await control.boundingBox();
      await page.setViewportSize({
        width,
        height: Math.ceil(edgeAnchor.y + edgeAnchor.height + 65),
      });
      const edgeBefore = await snapshot();
      await control.click();
      await menu.waitFor();
      await stationary(edgeBefore);
      box = await menu.boundingBox();
      const anchor = await control.boundingBox();
      assert.ok(
        box.y + box.height <= anchor.y + 1,
        `upward opening ${label} ${width}`,
      );
      assert.ok(box.y >= 0 && box.x >= 0 && box.x + box.width <= width + 1);
      assert.equal(
        await menu.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(
              r.x + r.width / 2,
              r.y + Math.min(20, r.height / 2),
            ),
          );
        }),
        true,
        "upward menu must not hide behind sticky navigation",
      );
      await control.press("Escape");
      await page.waitForTimeout(180);
      checks.push(`${width}:${label}`);
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.goto("http://localhost:3000/breeders");
  await page.locator("a.breeder-directory-card").waitFor();
  const input = page.getByRole("combobox", { name: "Порода", exact: true });
  await input.fill("мал");
  const list = page.getByRole("listbox", {
    name: "Доступні: Порода",
    exact: true,
  });
  await list.getByRole("option").first().waitFor();
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.getByRole("option", { name: "Малінуа 50", exact: true }).waitFor();
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.getByRole("option", { name: "Малінуа 54", exact: true }).waitFor();
  await page.getByRole("option", { name: "Малінуа 54", exact: true }).click();
  assert.equal(await input.getAttribute("aria-expanded"), "false");
  assert.equal(
    await input.evaluate((el) => document.activeElement === el),
    true,
  );
  await page.locator(".selected-breed strong").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await input.click();
  await input.press("Escape");
  checks.push("search/infinite-scroll/selection/reduced-motion");
  assert.deepEqual(errors, []);
  // The shared reference adapter must also remain usable in the catalog's
  // native modal/scroll container, without portalling outside its focus tree.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("http://localhost:3000/listings?species=dog");
  await page.getByRole("button", { name: /^Фільтри/ }).click();
  const dialog = page.locator("dialog[open]");
  const sharedBreed = dialog.getByRole("combobox", { name: /^Породи/ });
  await sharedBreed.scrollIntoViewIfNeeded();
  await sharedBreed.fill("мал");
  const sharedMenu = dialog.locator(".reference-results[data-motion='open']");
  await sharedMenu.getByRole("option").first().waitFor();
  const menuBounds = await sharedMenu.boundingBox(),
    drawerBounds = await dialog.boundingBox();
  assert.ok(
    menuBounds.y >= drawerBounds.y &&
      menuBounds.y + menuBounds.height <= drawerBounds.y + drawerBounds.height,
  );
  assert.equal(
    await sharedMenu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + 20, r.y + 20));
    }),
    true,
  );
  await sharedBreed.press("Escape");
  assert.equal(await sharedBreed.getAttribute("aria-expanded"), "false");
  checks.push("shared-mobile-catalog-dialog");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await writeFile(
    "test-results/dropdown-overlay.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
