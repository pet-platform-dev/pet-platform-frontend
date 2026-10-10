import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
const marker = randomUUID(),
  email = `browser-deletion-${marker}@example.invalid`,
  password = "Test-fixture-only-1234";
let actor, token, csrf;
const listingIds = [],
  petIds = [],
  checks = [],
  errors = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXcAAAAASUVORK5CYII=",
  "base64",
);
await mkdir("test-results", { recursive: true });
const manifest = () =>
  writeFile(
    `test-results/deletion-fixtures-${marker}.json`,
    JSON.stringify({ userId: actor, email, listingIds, petIds }, null, 2),
  );
const headers = () => ({
  Origin: base,
  "X-CSRF-Token": csrf,
  Authorization: `Bearer ${token}`,
});
const call = (method, path, body) =>
  context.request.fetch(api + path, {
    method,
    headers: headers(),
    ...(body ? { data: body } : {}),
  });
async function data(response, status = 200) {
  assert.equal(response.status(), status, await response.text());
  return (await response.json()).data;
}
function pass(name) {
  checks.push(name);
  console.log("PASS " + name);
}
async function navigate(path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
}
async function layout(width, name) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name} overflow at ${width}`,
  );
  await page.screenshot({
    path: `test-results/deletion-${width}-${name}.png`,
    fullPage: true,
  });
}
page.on("pageerror", (error) => errors.push(error.message));
try {
  csrf = (
    await data(
      await context.request.get(api + "/auth/csrf", {
        headers: { Origin: base },
      }),
    )
  ).csrfToken;
  const account = await data(
    await context.request.post(api + "/auth/register", {
      headers: { Origin: base, "X-CSRF-Token": csrf },
      data: { email, password, firstName: "Тест", lastName: "Видалення" },
    }),
    201,
  );
  actor = account.user.id;
  token = account.accessToken;
  await manifest();
  await navigate("/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const login = page.waitForResponse((r) => r.url().endsWith("/auth/login"));
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  token = (await data(await login)).accessToken;
  await page.waitForURL("**/account");
  const dog = (await data(await context.request.get(api + "/species"))).find(
    (row) => row.slug === "dog",
  );
  const location = (
    await data(
      await context.request.get(
        api + "/locations?search=" + encodeURIComponent("світловодськ"),
      ),
    )
  )[0];
  async function create(name, petId, extra = {}) {
    const listing = await data(
      await call("POST", petId ? "/listings" : "/listings/with-pet", {
        ...(petId
          ? { petId }
          : {
              pet: {
                speciesId: dog.id,
                name,
                gender: "MALE",
                birthDate: "2024-01-01",
              },
            }),
        locationId: location.id,
        type: "FREE",
        title: `Тест видалення ${name}`,
        description: "Ізольований browser fixture",
        ...extra,
      }),
      201,
    );
    listingIds.push(listing.id);
    if (!petIds.includes(listing.pet.id)) petIds.push(listing.pet.id);
    await manifest();
    return listing;
  }
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const name = `G-${width}-A`,
      historical = await create(name);
    await data(
      await call("PATCH", `/listings/${historical.id}/status`, {
        status: "ARCHIVED",
      }),
    );
    const historical2 = await create(name, historical.pet.id);
    await data(
      await call("PATCH", `/listings/${historical2.id}/status`, {
        status: "ARCHIVED",
      }),
    );
    const session = await data(
        await call("POST", "/uploads/listings/session", {}),
        201,
      ),
      images = [];
    for (let i = 0; i < 2; i++)
      images.push(
        (
          await data(
            await context.request.post(
              api + `/uploads/listings/${session.uploadSessionId}/images`,
              {
                headers: headers(),
                multipart: {
                  file: {
                    name: "photo.png",
                    mimeType: "image/png",
                    buffer: png,
                  },
                },
                timeout: 120000,
              },
            ),
            201,
          )
        ).id,
      );
    const active = await create(name, historical.pet.id, {
      uploadSessionId: session.uploadSessionId,
      imageIds: images,
    });
    await data(
      await call("PATCH", `/listings/${active.id}/status`, {
        status: "ACTIVE",
      }),
    );
    const unrelated = await create(`G-${width}-unrelated`);
    await navigate("/pets");
    const petCard = page
      .locator(".pet-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await petCard.waitFor();
    assert.equal(
      await petCard.locator(".pet-preview img").getAttribute("src"),
      active.images[0].thumbnailUrl,
    );
    assert.ok(
      await petCard
        .locator(".pet-preview img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    );
    const empty = page
      .locator(".pet-card")
      .filter({
        has: page.getByRole("heading", {
          name: `G-${width}-unrelated`,
          exact: true,
        }),
      });
    await empty.locator(".listing-no-photo").waitFor();
    await layout(width, "pets");
    pass(`${width}: ACTIVE preview, neutral fallback and no page overflow`);
    await navigate(
      width === 320 ? `/listings/${historical.id}/edit` : "/my-listings",
    );
    const deletion =
      width === 320
        ? page.getByRole("button", { name: "Видалити оголошення", exact: true })
        : page
            .locator(".owner-listing-card")
            .filter({
              has: page.locator(`a[href="/listings/${historical.id}/edit"]`),
            })
            .getByRole("button", { name: "Видалити оголошення", exact: true });
    await deletion.click();
    let dialog = page.locator("dialog[open]");
    await dialog
      .getByRole("heading", { name: "Видалити оголошення?", exact: true })
      .waitFor();
    assert.ok(
      (await dialog.innerText()).includes(
        "Профіль тварини залишиться. Буде видалено лише це оголошення.",
      ),
    );
    assert.equal(
      await dialog
        .getByRole("button", { name: "Скасувати" })
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await layout(width, "listing-confirm");
    await dialog.getByRole("button", { name: "Скасувати" }).click();
    assert.equal(
      (await call("GET", `/listings/${historical.id}`)).status(),
      200,
    );
    await deletion.click();
    const deleted = page.waitForResponse(
      (r) =>
        r.url() === api + `/listings/${historical.id}` &&
        r.request().method() === "DELETE",
    );
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Видалити оголошення", exact: true })
      .click();
    assert.equal((await deleted).status(), 204);
    if (width === 320) await page.waitForURL("**/my-listings");
    await page
      .locator(`.owner-listing-card a[href="/listings/${historical.id}/edit"]`)
      .waitFor({ state: "detached" });
    assert.equal(
      (await call("GET", `/pets/${historical.pet.id}`)).status(),
      200,
    );
    assert.equal(
      (await call("GET", `/listings/${historical2.id}`)).status(),
      200,
    );
    assert.equal((await call("GET", `/listings/${active.id}`)).status(), 200);
    pass(
      `${width}: listing delete removes one offer, keeps Pet and sibling; cancel safe${width === 320 ? "; editor redirects" : ""}`,
    );
    await navigate("/pets");
    await petCard
      .getByRole("button", { name: `Видалити профіль: ${name}`, exact: true })
      .click();
    dialog = page.locator("dialog[open]");
    await dialog
      .getByRole("heading", { name: "Видалити профіль тварини?" })
      .waitFor();
    assert.ok(
      (await dialog.innerText()).includes(
        "Буде видалено профіль тварини та всі пов’язані з нею оголошення. Цю дію не можна скасувати.",
      ),
    );
    await layout(width, "pet-confirm");
    const petDeleted = page.waitForResponse(
      (r) =>
        r.url() === api + `/pets/${historical.pet.id}` &&
        r.request().method() === "DELETE",
    );
    await dialog
      .getByRole("button", { name: "Видалити тварину", exact: true })
      .click();
    assert.equal((await petDeleted).status(), 204);
    await petCard.waitFor({ state: "detached" });
    await empty.waitFor();
    for (const id of [historical2.id, active.id])
      assert.equal((await call("GET", `/listings/${id}`)).status(), 404);
    assert.equal(
      (await call("GET", `/pets/${unrelated.pet.id}`)).status(),
      200,
    );
    assert.equal(
      (await call("GET", `/listings/${unrelated.id}`)).status(),
      200,
    );
    await navigate("/my-listings");
    for (const id of [historical2.id, active.id])
      assert.equal(
        await page.locator(`a[href="/listings/${id}/edit"]`).count(),
        0,
      );
    await page.locator(`a[href="/listings/${unrelated.id}/edit"]`).waitFor();
    await layout(width, "remaining-listings");
    pass(
      `${width}: Pet cascade removes all linked offers; unrelated Pet/listing preserved`,
    );
    assert.equal(
      (await call("DELETE", `/pets/${unrelated.pet.id}`)).status(),
      204,
    );
  }
  assert.deepEqual(errors, []);
  pass("No browser runtime/hydration errors");
  await writeFile(
    "test-results/deletion-validation.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/deletion-error.png",
    fullPage: true,
  });
  throw error;
} finally {
  if (actor) await manifest();
  await browser.close();
}
