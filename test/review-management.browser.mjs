import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { reviewsFixtures } from "./helpers/reviews-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  contexts = [],
  checks = [],
  errors = [];
const base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
let fixture;
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const section = (p) => p.locator(".seller-reviews"),
  own = (p) => p.locator(".own-review-card");
async function go(p, path) {
  await p.goto(base + path);
  await p.waitForLoadState("networkidle");
}
async function tab() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
async function login(p, actor, target) {
  await go(p, "/login?" + new URLSearchParams({ returnTo: target }));
  await p
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await p.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await p.getByRole("button", { name: "Увійти", exact: true }).click();
  await p.waitForURL(base + target);
  await p.waitForLoadState("networkidle");
}
async function badge(p, label) {
  await own(p).locator(".review-status").filter({ hasText: label }).waitFor();
}
async function summary(p, id) {
  return (
    await (
      await p.request.get(api + "/sellers/" + id + "/review-summary")
    ).json()
  ).data;
}
async function edit(p, label = "Редагувати") {
  await own(p).getByRole("button", { name: label, exact: true }).click();
  await own(p).getByRole("heading", { name: "Редагувати відгук" }).waitFor();
}
async function save(p, text, rating = 4) {
  await own(p)
    .getByRole("radio", { name: rating + " з 5", exact: true })
    .check();
  await own(p).getByLabel("Коментар", { exact: true }).fill(text);
  await own(p)
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await section(p)
    .getByText("Зміни збережено. Відгук повторно надіслано на модерацію.", {
      exact: true,
    })
    .waitFor();
  await badge(p, "На модерації");
  await p.waitForLoadState("networkidle");
}
async function remove(p) {
  await own(p).getByRole("button", { name: "Видалити", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Видалити", exact: true })
    .click();
  await section(p)
    .getByRole("heading", { name: "Залишити відгук", exact: true })
    .waitFor();
  await p.waitForLoadState("networkidle");
}
async function geometry(p, state, dialog = false) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      state + width,
    );
    const area = dialog ? p.getByRole("dialog") : own(p);
    await area.scrollIntoViewIfNeeded();
    const boxes = await area
      .locator("button,textarea,.review-rating-option")
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => n.getClientRects().length)
          .map((n) => {
            const b = n.getBoundingClientRect();
            return { left: b.left, right: b.right };
          }),
      );
    assert.ok(
      boxes.every((b) => b.left >= -1 && b.right <= width + 1),
      state + width,
    );
    if ([320, 768, 1440].includes(width))
      await area.screenshot({
        path: `test-results/phase8d-${state}-${width}.png`,
      });
    pass(state + " " + width + " no overflow");
  }
  await p.setViewportSize({ width: 1440, height: 1000 });
}
try {
  await mkdir("test-results", { recursive: true });
  fixture = await reviewsFixtures();
  const target = fixture.seller.user.id,
    path = "/sellers/" + target,
    p = await tab();
  await login(p, fixture.fallback, path);
  await section(p).getByRole("radio", { name: "5 з 5", exact: true }).check();
  await section(p)
    .getByLabel("Коментар", { exact: true })
    .fill("Початковий власний відгук про продавця.");
  await section(p)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  await badge(p, "На модерації");
  pass("create pending shows private owner content/actions");
  await edit(p);
  assert.equal(
    await own(p).getByLabel("Коментар", { exact: true }).inputValue(),
    "Початковий власний відгук про продавця.",
  );
  assert.equal(
    await own(p).getByRole("radio", { name: "5 з 5", exact: true }).isChecked(),
    true,
  );
  await own(p).getByLabel("Коментар", { exact: true }).fill("short");
  await own(p)
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await own(p).locator(".field-error").waitFor();
  assert.equal(
    await own(p)
      .getByLabel("Коментар", { exact: true })
      .evaluate((e) => document.activeElement === e),
    true,
  );
  pass("edit prefilled shared form; invalid comment focuses associated error");
  await save(p, "Оновлений власний відгук після редагування.");
  assert.equal(
    (await fixture.ownReview(fixture.fallback.user.id, target)).status,
    "PENDING",
  );
  pass("pending edit persists content and remains pending");
  await fixture.setOwnReview(fixture.fallback.user.id, target, "APPROVED");
  await go(p, path);
  await badge(p, "Опубліковано");
  const sibling = await p.context().newPage();
  sibling.on("pageerror", (error) => errors.push(error.message));
  await go(sibling, path);
  await badge(sibling, "Опубліковано");
  const before = await summary(p, target);
  assert.equal(before.reviewCount, 22);
  assert.equal(
    await p
      .locator(".review-list .review-card")
      .filter({ hasText: "Власний схвалений відгук для перевірки." })
      .count(),
    1,
  );
  await geometry(p, "owner-card");
  await edit(p);
  await own(p)
    .getByText(
      "Після редагування відгук знову буде надіслано на модерацію та тимчасово зникне з публічного списку.",
      { exact: true },
    )
    .waitFor();
  await geometry(p, "edit-form");
  await own(p).getByRole("button", { name: "Скасувати", exact: true }).click();
  await p.waitForFunction(
    () => document.activeElement?.textContent?.trim() === "Редагувати",
  );
  assert.equal(
    await own(p)
      .getByRole("button", { name: "Редагувати", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await edit(p);
  pass("approved owner edit warning at seven widths");
  await own(p)
    .getByLabel("Коментар", { exact: true })
    .fill("Змінений відгук збережеться після помилки.");
  await p.route("**/reviews/me", (route) =>
    route.request().method() === "PATCH" ? route.abort() : route.continue(),
  );
  await own(p)
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .click();
  await own(p).getByRole("alert").waitFor();
  assert.equal(
    await own(p).getByLabel("Коментар", { exact: true }).inputValue(),
    "Змінений відгук збережеться після помилки.",
  );
  await p.unroute("**/reviews/me");
  pass("failed edit preserves editable fields");
  let patches = 0;
  const listener = (r) => {
    if (r.method() === "PATCH" && r.url().endsWith("/reviews/me")) patches++;
  };
  p.on("request", listener);
  await own(p)
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await badge(p, "На модерації");
  await p.waitForLoadState("networkidle");
  assert.equal(patches, 1);
  p.off("request", listener);
  assert.equal((await summary(p, target)).reviewCount, 21);
  assert.equal(
    await p
      .locator(".review-list .review-card")
      .filter({ hasText: "Власний схвалений відгук для перевірки." })
      .count(),
    0,
  );
  assert.ok((await p.locator(".review-summary").innerText()).includes("21"));
  pass(
    "approved edit becomes pending, removed public card and DB summary, one PATCH only",
  );
  await badge(sibling, "На модерації");
  await sibling.waitForLoadState("networkidle");
  assert.ok(
    (await sibling.locator(".review-summary").innerText()).includes("21"),
  );
  assert.equal(
    await sibling
      .locator(".review-list .review-card")
      .filter({ hasText: "Власний схвалений відгук для перевірки." })
      .count(),
    0,
  );
  pass(
    "same-user tab refreshes owner and affected public summary/list after edit",
  );
  await go(p, path);
  await badge(p, "На модерації");
  pass("refresh preserves edited pending private state");
  await fixture.setOwnReview(fixture.fallback.user.id, target, "APPROVED");
  await go(p, path);
  await badge(p, "Опубліковано");
  await own(p).getByRole("button", { name: "Видалити", exact: true }).click();
  const dlg = p.getByRole("dialog");
  await dlg.waitFor();
  assert.equal(
    await dlg
      .getByRole("button", { name: "Скасувати", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await p.keyboard.press("Shift+Tab");
  assert.equal(
    await dlg
      .getByRole("button", { name: "Видалити", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await p.keyboard.press("Tab");
  assert.equal(
    await dlg
      .getByRole("button", { name: "Скасувати", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await geometry(p, "delete-dialog", true);
  await dlg.getByRole("button", { name: "Скасувати", exact: true }).click();
  assert.equal(
    await own(p)
      .getByRole("button", { name: "Видалити", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await badge(p, "Опубліковано");
  pass("delete confirmation cancel traps and returns focus without deleting");
  await own(p).getByRole("button", { name: "Видалити", exact: true }).click();
  await p.route("**/reviews/me", (route) =>
    route.request().method() === "DELETE" ? route.abort() : route.continue(),
  );
  await dlg.getByRole("button", { name: "Видалити", exact: true }).click();
  await dlg.getByRole("alert").waitFor();
  await p.unroute("**/reviews/me");
  await dlg.getByRole("button", { name: "Скасувати", exact: true }).click();
  pass("delete failure preserves card and retryable confirmation");
  await remove(p);
  assert.equal(await fixture.ownReview(fixture.fallback.user.id, target), null);
  assert.equal((await summary(p, target)).reviewCount, 21);
  assert.equal(
    await p
      .locator(".review-list .review-card")
      .filter({ hasText: "Власний схвалений відгук для перевірки." })
      .count(),
    0,
  );
  assert.equal(await own(p).count(), 0);
  pass(
    "approved permanent delete updates public list/summary and restores create form",
  );
  await section(p).getByRole("radio", { name: "3 з 5", exact: true }).check();
  await section(p)
    .getByLabel("Коментар", { exact: true })
    .fill("Новий відгук після видалення попереднього.");
  await section(p)
    .getByRole("button", { name: "Надіслати відгук", exact: true })
    .click();
  await badge(p, "На модерації");
  pass("new review allowed after hard delete");
  const rejected = await tab(),
    kennel = "/sellers/" + fixture.full.user.id;
  await login(rejected, fixture.seller, kennel);
  await badge(rejected, "Відхилено");
  await edit(rejected, "Відредагувати");
  await save(rejected, "Виправлений відгук про цей розплідник.");
  assert.equal(
    (await fixture.ownReview(fixture.seller.user.id, fixture.full.user.id))
      .status,
    "PENDING",
  );
  pass(
    "breeder rejected edit returns pending without invented moderation reason",
  );
  const hidden = await tab();
  await login(hidden, fixture.empty, path);
  await badge(hidden, "Приховано");
  assert.equal(
    await own(hidden)
      .getByRole("button", { name: "Редагувати", exact: true })
      .count(),
    0,
  );
  await remove(hidden);
  pass("hidden owner cannot edit; can explicitly delete and review anew");
  const foreign = await tab();
  await login(foreign, fixture.full, path);
  await badge(foreign, "На модерації");
  assert.equal(
    await foreign.locator(".review-list .review-card button").count(),
    0,
  );
  assert.equal(await own(foreign).count(), 1);
  assert.equal(
    await foreign.locator(".review-list .own-review-card").count(),
    0,
  );
  pass(
    "foreign public cards have no edit/delete actions; only own pending management",
  );
  await go(rejected, "/sellers/" + fixture.seller.user.id);
  await section(rejected)
    .getByText("Ви не можете залишити відгук самому собі.", { exact: true })
    .waitFor();
  assert.equal(await own(rejected).count(), 0);
  pass("self-review remains blocked");
  assert.deepEqual(errors, []);
  pass("zero runtime/hydration errors");
  await writeFile(
    "test-results/phase8d-browser.json",
    JSON.stringify({ checks }, null, 2),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
  if (fixture) await fixture.cleanup();
}
