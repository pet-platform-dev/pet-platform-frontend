import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { breederProfileFixtures } from "./helpers/breeder-profile-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const base = "http://localhost:3000",
  checks = [],
  errors = [];
let fixture;
page.on("pageerror", (error) => errors.push(error.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const go = async (path) => {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
};
const card = (id) => page.locator(`[data-pet-id="${id}"]`);
async function geometry(label) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    for (const el of await page
      .locator(".breeder-animal-card .button,.breeder-visibility")
      .all()) {
      const box = await el.boundingBox();
      assert.ok(
        box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1,
      );
    }
    await page.screenshot({
      path: `test-results/phase7e-${label}-${width}.png`,
      fullPage: true,
    });
    await page
      .locator(".breeder-animals-grid")
      .screenshot({ path: `test-results/phase7e-${label}-grid-${width}.png` });
    pass(`${label} ${width} no overflow/touch targets`);
  }
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await breederProfileFixtures({ animals: true });
  const [A, B, C] = fixture.full.listings.map((listing) => listing.petId);
  await go("/login");
  await page
    .getByLabel("Електронна адреса", { exact: true })
    .fill(fixture.full.user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await go("/profile/breeder/animals");
  await card(A).waitFor();
  assert.equal(await page.locator(".breeder-animal-card").count(), 3);
  await geometry("management");
  const toggle = async (id, enabled) => {
    const checkbox = card(id).getByRole("checkbox");
    await checkbox.click();
    await page.waitForFunction(
      ({ id, enabled }) => {
        const input = document.querySelector(
          `[data-pet-id="${id}"] input[type="checkbox"]`,
        );
        return input && input.checked === enabled && !input.disabled;
      },
      { id, enabled },
    );
    await page.waitForLoadState("networkidle");
    assert.equal(await checkbox.isChecked(), enabled);
    assert.equal(await checkbox.isDisabled(), false);
  };
  await toggle(A, true);
  await card(B).getByRole("checkbox").focus();
  await card(B).getByRole("checkbox").press("Space");
  await page.waitForFunction(
    (id) => document.querySelector(`[data-pet-id="${id}"] input`).checked,
    B,
  );
  await page.waitForLoadState("networkidle");
  assert.equal(await card(B).getByRole("checkbox").isChecked(), true);
  pass("owner ON and keyboard Space; confirmed state");
  await page.route("**/pets/*/breeder-visibility", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UNAVAILABLE" } }),
    });
  });
  await card(C).getByRole("checkbox").click();
  await page.waitForFunction(
    (id) => document.querySelector(`[data-pet-id="${id}"] input`).disabled,
    C,
  );
  assert.equal(await card(C).getByRole("checkbox").isDisabled(), true);
  await card(C).getByRole("alert").waitFor();
  assert.equal(await card(C).getByRole("checkbox").isChecked(), false);
  await page.unroute("**/pets/*/breeder-visibility");
  pass("failed mutation remains OFF; pending disables control");
  await go(`/sellers/${fixture.full.user.id}`);
  await card(B).waitFor();
  assert.equal(await page.locator(".breeder-animal-card").count(), 2);
  assert.equal(await card(C).count(), 0);
  assert.equal(
    await card(A)
      .getByRole("link", { name: "Переглянути профіль тварини" })
      .count(),
    1,
  );
  assert.equal(await card(A).locator("img").count(), 1);
  assert.equal(await card(B).locator("img").count(), 0);
  assert.equal(
    await card(B)
      .getByRole("link", { name: "Переглянути профіль тварини" })
      .getAttribute("href"),
    "/pets/" + B,
  );
  assert.equal(await card(B).locator(".breeder-animal-name").count(), 0);
  assert.equal(
    (await page.locator("main").innerText()).includes(fixture.full.user.email),
    false,
  );
  pass(
    "A: only A/B public; ACTIVE image/link, B placeholder, optional name absent/private C absent",
  );
  await geometry("public");
  await go("/profile/breeder/animals");
  await toggle(C, true);
  await go(`/sellers/${fixture.full.user.id}`);
  await card(C).waitFor();
  pass("B: enabling C updates public profile");
  await go("/profile/breeder/animals");
  await toggle(A, false);
  await go(`/sellers/${fixture.full.user.id}`);
  await card(B).waitFor();
  assert.equal(await card(A).count(), 0);
  assert.equal(
    (await fixture.domainSnapshot()).listings.find(
      (l) => l.id === fixture.full.listings[0].id,
    ).status,
    "ACTIVE",
  );
  pass("C: disabling A keeps ACTIVE marketplace listing");
  await go(`/listings/new?petId=${fixture.seller.listings[0].petId}`);
  await page.locator("#petId").waitFor();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("#petId").getAttribute("data-value"), "");
  pass("foreign preselection safely cleared");
  await go("/profile/breeder/animals");
  await card(B).getByRole("link", { name: "Створити оголошення" }).click();
  await page.locator("#petId").waitFor();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("#petId").getAttribute("data-value"), B);
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("#petId").getAttribute("data-value"), B);
  await page.getByRole("combobox", { name: "Місце" }).fill("Світловодськ");
  await page.locator('[role="option"]').first().click();
  await page
    .getByLabel("Заголовок", { exact: true })
    .fill("Тест Phase 7E існуюча тварина");
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Перевірка існуючої тварини без створення дубліката.");
  await page.locator('input[value="FREE"]').check();
  await page.getByLabel("Додати фото", { exact: true }).setInputFiles({
    name: "phase7e.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Опублікувати", exact: true })
    .waitFor();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await page
    .getByRole("heading", { name: "Оголошення створено", exact: true })
    .waitFor();
  const published = await fixture.domainSnapshot();
  assert.equal(published.pets.length, 3);
  assert.equal(published.listings.find((l) => l.petId === B).status, "ACTIVE");
  pass(
    "D: owned Pet prefilled across refresh; existing form real upload/publish; no duplicate Pet",
  );
  await go("/profile/breeder/animals");
  await card(B).getByRole("link", { name: "Переглянути оголошення" }).waitFor();
  pass("listing publication refreshes management status");
  await go("/profile/breeder");
  await page
    .getByRole("button", { name: "Видалити профіль розплідника", exact: true })
    .click();
  const deletion = page.waitForResponse(
    (response) =>
      response.url().endsWith("/breeders/me") &&
      response.request().method() === "DELETE",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Видалити профіль", exact: true })
    .click();
  assert.equal((await deletion).status(), 204);
  await page.waitForLoadState("networkidle");
  const after = await fixture.domainSnapshot();
  assert.deepEqual(after.listings, published.listings);
  assert.deepEqual(after.user, published.user);
  assert.deepEqual(after.contacts, published.contacts);
  const preservedPet = (value) => {
    const pet = { ...value };
    delete pet.showOnBreederProfile;
    delete pet.updatedAt;
    return pet;
  };
  assert.deepEqual(
    after.pets.map(preservedPet),
    published.pets.map(preservedPet),
  );
  assert.ok(after.pets.every((pet) => !pet.showOnBreederProfile));
  await go(`/sellers/${fixture.full.user.id}`);
  assert.equal(
    await page
      .getByRole("heading", { name: "Наші тварини", exact: true })
      .count(),
    0,
  );
  pass(
    "E: profile deletion resets visibility; preserves User/Pets/Listings/contacts; public section removed",
  );
  await go(`/sellers/${fixture.empty.user.id}`);
  assert.equal(
    await page
      .getByRole("heading", { name: "Наші тварини", exact: true })
      .count(),
    0,
  );
  await go(`/sellers/${fixture.seller.user.id}`);
  assert.equal(
    await page
      .getByRole("heading", { name: "Наші тварини", exact: true })
      .count(),
    0,
  );
  pass("zero visible animals and ordinary seller hide section");
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(base + "/profile/breeder/animals");
  await guestPage.waitForURL("**/login");
  pass("logged-out management uses existing login gate");
  for (const label of ["seller", "empty", "fallback"]) {
    const actorContext = await browser.newContext();
    const actorPage = await actorContext.newPage();
    await actorPage.goto(base + "/login");
    await actorPage
      .getByLabel("Електронна адреса", { exact: true })
      .fill(fixture[label].user.email);
    await actorPage
      .getByLabel("Пароль", { exact: true })
      .fill(fixture.password);
    await actorPage
      .getByRole("button", { name: "Увійти", exact: true })
      .click();
    await actorPage.waitForURL("**/account");
    await actorPage.goto(base + "/profile/breeder/animals");
    await actorPage
      .getByText(
        label === "seller"
          ? "Розділ доступний для акаунта заводчика."
          : label === "empty"
            ? "У вас ще немає тварин."
            : "Спочатку налаштуйте профіль розплідника",
        { exact: true },
      )
      .waitFor();
    assert.equal(await actorPage.getByRole("checkbox").count(), 0);
    if (label === "empty")
      assert.equal(
        await actorPage
          .getByRole("link", { name: "Додати тварину", exact: true })
          .getAttribute("href"),
        "/pets/new?returnTo=%2Fprofile%2Fbreeder%2Fanimals",
      );
    await actorContext.close();
    pass(label + " management gate/empty state");
  }
  await guest.close();
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase7e-browser.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/phase7e-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  if (fixture) await fixture.cleanup();
}
