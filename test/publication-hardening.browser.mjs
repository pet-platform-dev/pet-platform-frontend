import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  ownerContext = await browser.newContext(),
  adminContext = await browser.newContext(),
  publicContext = await browser.newContext();
const owner = await ownerContext.newPage(),
  admin = await adminContext.newPage(),
  publicPage = await publicContext.newPage();
const checks = [],
  errors = [];
let f,
  ids = [],
  beforeReports;
for (const page of [owner, admin, publicPage])
  page.on("pageerror", (e) => errors.push(e.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function go(p, path) {
  await p.goto("http://localhost:3000" + path);
  await p.waitForLoadState("networkidle");
}
async function login(p, actor) {
  await go(p, "/login");
  await p
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await p.getByLabel("Пароль", { exact: true }).fill(f.password);
  await p.getByRole("button", { name: "Увійти", exact: true }).click();
  await p.waitForURL("**/account");
  await p.waitForLoadState("networkidle");
}
async function action(p, name) {
  await p.getByRole("button", { name, exact: true }).click();
  await p.waitForLoadState("networkidle");
}
async function inspect(type, row) {
  await go(admin, "/admin/moderation/" + type + "/" + row.id);
  await admin.locator(".admin-detail-sidebar").waitFor();
}
async function decide(name, reason) {
  await action(admin, name);
  if (reason) {
    const d = admin.getByRole("dialog");
    await d.getByRole("textbox").fill(reason);
    await d.getByRole("button", { name, exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await admin.waitForLoadState("networkidle");
  }
}
async function absent(path) {
  const r = await publicPage.request.get("http://localhost:4000/api/v1" + path);
  assert.equal(r.status(), 404);
  const body = await r.text();
  assert.doesNotMatch(
    body,
    /moderation|PENDING|REJECTED|HIDDEN|Prisma|SELECT|stack/,
  );
}
async function submit(row) {
  await go(owner, "/listings/" + row.id + "/edit");
  await owner
    .getByRole("button", { name: "Надіслати на модерацію", exact: true })
    .waitFor();
  await action(owner, "Надіслати на модерацію");
  await owner.getByText("На модерації", { exact: true }).waitFor();
}
async function edit(row, text) {
  await go(owner, "/listings/" + row.id + "/edit");
  await owner.getByLabel("Опис", { exact: true }).fill(text);
  await action(owner, "Зберегти зміни");
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  ids = [f.seller.user.id, f.full.user.id, f.fallback.user.id, f.empty.user.id];
  beforeReports = await f.db.report.findMany({ orderBy: { id: "asc" } });
  await f.db.user.update({
    where: { id: f.empty.user.id },
    data: { role: "ADMIN" },
  });
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const pet = await f.db.pet.create({
      data: {
        ownerId: f.seller.user.id,
        speciesId: f.breeds[0].speciesId,
        breedId: f.breeds[0].id,
        gender: "MALE",
      },
    });
    rows.push(
      await f.db.listing.create({
        data: {
          sellerId: f.seller.user.id,
          petId: pet.id,
          locationId: f.location.id,
          type: "FREE",
          title: "10E Оголошення " + i,
          description: "Опис для перевірки життєвого циклу.",
          images: {
            create: {
              url: "https://res.cloudinary.com/fixture/image/upload/sample.jpg",
            },
          },
        },
      }),
    );
  }
  await login(owner, f.seller);
  await login(admin, f.empty);
  await submit(rows[0]);
  await absent("/listings/" + rows[0].id);
  await inspect("listings", rows[0]);
  await decide("Схвалити");
  await admin.getByText("Оголошення схвалено.", { exact: true }).waitFor();
  await go(publicPage, "/listings/" + rows[0].id);
  await publicPage.locator(".listing-description-text").waitFor();
  for (const width of [375, 768, 1440]) {
    await publicPage.setViewportSize({ width, height: 1000 });
    assert.equal(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await publicPage.screenshot({
      path: "test-results/phase10e-public-detail-" + width + ".png",
    });
  }
  await f.db.favorite.create({
    data: { userId: f.full.user.id, listingId: rows[0].id },
  });
  await edit(rows[0], "Оновлений опис потребує повторної модерації.");
  await owner.getByText("На модерації", { exact: true }).waitFor();
  await absent("/listings/" + rows[0].id);
  assert.equal(
    await f.db.favorite.count({
      where: { userId: f.full.user.id, listingId: rows[0].id },
    }),
    1,
  );
  pass(
    "A Listing draft→submit→private→approve→public→owner edit→private; favorite retained",
  );
  await inspect("listings", rows[0]);
  await decide("Відхилити", "Опис потребує уточнення перед публікацією.");
  await go(owner, "/listings/" + rows[0].id + "/edit");
  await owner.getByText("Відхилено", { exact: true }).waitFor();
  await owner
    .getByLabel("Опис", { exact: true })
    .fill("Виправлений опис для повторного розгляду.");
  await action(owner, "Надіслати на модерацію");
  await owner.getByText("На модерації", { exact: true }).waitFor();
  await absent("/listings/" + rows[0].id);
  pass("B reject→owner corrects→resubmit remains private");
  await inspect("listings", rows[0]);
  await decide("Схвалити");
  await inspect("listings", rows[0]);
  await decide("Приховати", "Матеріал приховано після перевірки модератором.");
  await absent("/listings/" + rows[0].id);
  await go(owner, "/listings/" + rows[0].id + "/edit");
  await owner.getByText("Приховано", { exact: true }).waitFor();
  assert.equal(
    await owner
      .getByRole("button", { name: "Надіслати на модерацію", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await owner
      .getByRole("button", { name: "Зберегти зміни", exact: true })
      .count(),
    0,
  );
  pass("C hide removes public content and owner reactivation/edit controls");
  const mates = [];
  for (let i = 0; i < 2; i++)
    mates.push(
      await f.db.matingListing.create({
        data: {
          ownerId: f.seller.user.id,
          petId: f.known.id,
          locationId: f.location.id,
          title: "10E В’язка " + i,
          description: "Умови для перевірки двох заявок.",
          moderationStatus: "PENDING",
        },
      }),
    );
  await inspect("mating-listings", mates[0]);
  await decide("Схвалити");
  await inspect("mating-listings", mates[1]);
  await decide("Схвалити");
  await admin.locator(".admin-conflict").waitFor();
  assert.equal(
    await f.db.matingListing.count({
      where: { petId: f.known.id, status: "ACTIVE" },
    }),
    1,
  );
  pass("D two PENDING same Pet: first approval wins; second409; one ACTIVE");
  await submit(rows[1]);
  await inspect("listings", rows[1]);
  await edit(rows[1], "Власник змінив опис після інспекції адміністратором.");
  await decide("Схвалити");
  await admin.locator(".admin-conflict").waitFor();
  await admin
    .locator(".admin-conflict")
    .getByRole("button", { name: "Оновити", exact: true })
    .click();
  await admin
    .getByText("Дані оновлено. Перегляньте зміст перед новим рішенням.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    (await f.db.listing.findUnique({ where: { id: rows[1].id } }))
      .moderationStatus,
    "PENDING",
  );
  pass(
    "E owner edit invalidates admin revision; explicit refetch, no approval replay",
  );
  const report = await f.db.report.create({
    data: {
      reporterId: f.full.user.id,
      reporterName: "Заявник",
      targetType: "MATING_LISTING",
      targetId: mates[0].id,
      targetPreview: mates[0].title,
      reason: "SPAM",
    },
  });
  await go(admin, "/admin/moderation/reports/" + report.id);
  await admin
    .getByLabel("Примітка до рішення")
    .fill("Перевірено скаргу, контент не змінюється.");
  await action(admin, "Опрацювати");
  await admin.getByText("Скаргу опрацьовано.", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: mates[0].id } }))
      .moderationStatus,
    "APPROVED",
  );
  pass("F report resolution has no publication side effect");
  const dismissReport = await f.db.report.create({
    data: {
      reporterId: f.full.user.id,
      reporterName: "Заявник",
      targetType: "MATING_LISTING",
      targetId: mates[0].id,
      targetPreview: mates[0].title,
      reason: "OTHER",
      details: "Повторна скарга для перевірки незалежності.",
    },
  });
  await go(admin, "/admin/moderation/reports/" + dismissReport.id);
  await admin
    .getByLabel("Примітка до рішення")
    .fill("Підстав не знайдено; контент не змінюється.");
  await action(admin, "Відхилити скаргу");
  await admin.getByText("Скаргу відхилено.", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: mates[0].id } }))
      .moderationStatus,
    "APPROVED",
  );
  pass("F report dismissal also leaves publication unchanged");
  // Exercise the new stale owner recovery on the actual lifecycle action, without replay.
  await go(owner, "/mating/" + mates[0].id + "/edit");
  await owner
    .getByRole("button", { name: "Завершити пошук", exact: true })
    .waitFor();
  await action(owner, "Завершити пошук");
  await f.db.matingListing.update({
    where: { id: mates[0].id },
    data: { moderationStatus: "HIDDEN" },
  });
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Підтвердити", exact: true })
    .click();
  await owner.getByText("Приховано", { exact: true }).waitFor();
  assert.equal(
    (await f.db.matingListing.findUnique({ where: { id: mates[0].id } }))
      .status,
    "ACTIVE",
  );
  pass("stale owner409 refreshes current state, never replays action");
  // A held client revalidation must conceal an earlier public DTO immediately.
  const current = await f.db.listing.update({
    where: { id: rows[2].id },
    data: {
      status: "ACTIVE",
      moderationStatus: "APPROVED",
      publishedAt: new Date(),
    },
  });
  await go(publicPage, "/listings/" + current.id);
  await publicPage.locator(".listing-description-text").waitFor();
  let release;
  const held = new Promise((r) => {
    release = r;
  });
  await publicPage.route("**/api/v1/listings/" + current.id, async (route) => {
    await held;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "Оголошення не знайдено" }),
    });
  });
  await f.db.listing.update({
    where: { id: current.id },
    data: { moderationStatus: "HIDDEN" },
  });
  await publicPage.bringToFront();
  await publicPage.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await publicPage.evaluate(() => window.dispatchEvent(new Event("focus")));
  await publicPage.locator(".listing-detail-skeleton").waitFor();
  assert.equal(
    await publicPage.locator(".listing-description-text").count(),
    0,
  );
  release();
  await publicPage
    .getByText("Оголошення недоступне", { exact: false })
    .waitFor();
  await publicPage.unroute("**/api/v1/listings/" + current.id);
  pass("public Listing revalidation conceals cached DTO then safe404");
  await go(admin, "/admin/moderation/listings/" + rows[1].id);
  await admin.locator(".admin-detail-sidebar").waitFor();
  for (const width of [375, 768, 1440]) {
    await admin.setViewportSize({ width, height: 1000 });
    assert.equal(
      await admin.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await admin.screenshot({
      path: "test-results/phase10e-detail-" + width + ".png",
    });
  }
  pass("touched surfaces fit375/768/1440 without layout changes");
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase10e-browser.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (e) {
  console.error(
    "BROWSER FAILURE",
    owner.url(),
    admin.url(),
    publicPage.url(),
    e,
  );
  await admin.screenshot({ path: "test-results/phase10e-failure.png" });
  throw e;
} finally {
  await browser.close();
  if (f) {
    await f.db.report.deleteMany({ where: { reporterId: { in: ids } } });
    if (beforeReports)
      assert.deepEqual(
        await f.db.report.findMany({ orderBy: { id: "asc" } }),
        beforeReports,
      );
    await f.cleanup();
  }
}
