import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { matingFixtures } from "./helpers/mating-fixtures.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  }),
  page = await context.newPage(),
  publicPage = await browser.newPage(),
  ownerContext = await browser.newContext(),
  ownerPage = await ownerContext.newPage(),
  secondContext = await browser.newContext(),
  secondPage = await secondContext.newPage();
const checks = [],
  errors = [],
  requests = [],
  httpResponses = [];
page.on("response", (response) => {
  if (response.url().startsWith("http://localhost:4000/api/v1/"))
    httpResponses.push({
      path: new URL(response.url()).pathname,
      status: response.status(),
    });
});
for (const target of [page, publicPage, ownerPage, secondPage])
  target.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (
    request.method() !== "OPTIONS" &&
    request.url().startsWith("http://localhost:4000/api/v1/admin/moderation")
  )
    requests.push({
      path: new URL(request.url()).pathname,
      query: new URL(request.url()).search,
      method: request.method(),
    });
});
let f;
let fixtureUserIds = [];
const pass = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function go(path, target = page) {
  await target.goto("http://localhost:3000" + path);
  await target.waitForLoadState("networkidle");
}
async function login(actor, target = page) {
  await go("/login", target);
  await target
    .getByLabel("Електронна адреса", { exact: true })
    .fill(actor.user.email);
  await target.getByLabel("Пароль", { exact: true }).fill(f.password);
  await target.getByRole("button", { name: "Увійти", exact: true }).click();
  await target.waitForURL("**/account");
  await target.waitForLoadState("networkidle");
}
async function choose(label, value) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
  const key = label === "Тип матеріалу" ? "type" : "status";
  const expected = {
    Усі: null,
    Оголошення: "LISTING",
    "В’язка": "MATING_LISTING",
    Відгуки: "REVIEW",
    "На модерації": null,
    Схвалено: "APPROVED",
    Відхилено: "REJECTED",
    Приховано: "HIDDEN",
  }[value];
  await page.waitForURL((url) => url.searchParams.get(key) === expected);
  await page.waitForLoadState("networkidle");
}
async function detail(
  kind,
  row,
  target = page,
  returnTo = "/admin/moderation",
) {
  await go(
    "/admin/moderation/" +
      kind +
      "/" +
      row.id +
      "?" +
      new URLSearchParams({ returnTo }),
    target,
  );
  await target.locator(".admin-detail-sidebar").waitFor();
}
async function action(name, target = page) {
  await target.getByRole("button", { name, exact: true }).click();
  await target.waitForLoadState("networkidle");
}
async function expectDenied() {
  const denied = page.getByRole("heading", {
    name: "Доступ до модерації недоступний",
  });
  for (let attempt = 0; attempt < 3 && !(await denied.isVisible()); attempt++) {
    const latest = httpResponses.at(-1);
    if (latest?.path !== "/api/v1/auth/refresh" || latest.status !== 429) break;
    console.log(
      "INFO Waiting20s for existing auth refresh rate-limit window; security guard unchanged.",
    );
    await new Promise((resolve) => setTimeout(resolve, 20000));
    if (await denied.isVisible()) break;
    await action("Спробувати ще раз");
  }
  await denied.waitFor();
}
async function reason(name, text, target = page) {
  await action(name, target);
  const dialog = target.getByRole("dialog");
  await dialog.getByRole("textbox").fill(text);
  await dialog.getByRole("button", { name, exact: true }).click();
  await target.waitForLoadState("networkidle");
}
async function geometry(path, label, { dialog = false } = {}) {
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await go(path);
    await page.locator(".admin-moderation").waitFor();
    if (dialog) {
      await action("Відхилити");
      await page
        .getByRole("dialog")
        .getByRole("textbox")
        .fill("Довга причина: " + "Деталі".repeat(140));
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false, label + " overflow " + width);
    assert.equal(await page.locator("select").count(), 0);
    if (dialog) {
      const bounds = await page.getByRole("dialog").boundingBox();
      assert.ok(
        bounds.x >= 15 &&
          bounds.x + bounds.width <= width - 15 &&
          bounds.y >= 15,
        "centered dialog gutters " + width,
      );
    }
    const target = dialog
      ? page.getByRole("dialog")
      : page.locator(".admin-moderation");
    const boxes = await target
      .locator("button:visible,a.button:visible,.admin-card-link:visible")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          label: node.getAttribute("aria-label") ?? node.textContent,
          height: node.getBoundingClientRect().height,
          width: node.getBoundingClientRect().width,
        })),
      );
    assert.ok(
      boxes.every((box) => box.height >= 43.5 && box.width >= 43.5),
      label + " touch targets " + width + " " + JSON.stringify(boxes),
    );
    if ([320, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "test-results/phase10c-" + label + "-" + width + ".png",
        fullPage: false,
      });
    }
    if (dialog) {
      await page.keyboard.press("Escape");
    }
    pass(label + " responsive " + width);
  }
}
try {
  await mkdir("test-results", { recursive: true });
  f = await matingFixtures();
  const db = f.db;
  const admin = f.empty;
  await db.user.update({
    where: { id: admin.user.id },
    data: { role: "ADMIN" },
  });
  const donor = await db.user.findUniqueOrThrow({
    where: { id: f.seller.user.id },
    select: { passwordHash: true },
  });
  const admin2 = await db.user.create({
    data: {
      email: "admin2-" + f.marker + "@example.invalid",
      passwordHash: donor.passwordHash,
      firstName: "Інший",
      lastName: "Адміністратор",
      role: "ADMIN",
    },
  });
  f.trackUser(admin2);
  fixtureUserIds = [
    f.seller.user.id,
    f.full.user.id,
    f.empty.user.id,
    admin2.id,
  ];
  await db.breederProfile.upsert({
    where: { userId: f.full.user.id },
    create: { userId: f.full.user.id, kennelName: "Royal Moderation" },
    update: {},
  });
  const rows = [];
  for (let i = 0; i < 26; i++) {
    const pet = await db.pet.create({
      data: {
        ownerId: f.seller.user.id,
        speciesId: f.breeds[0].speciesId,
        breedId: f.breeds[0].id,
        gender: "MALE",
        name: "Рекс " + i,
        healthNotes: "PRIVATE-CARE-DO-NOT-RENDER",
      },
    });
    rows.push(
      await db.listing.create({
        data: {
          sellerId: f.seller.user.id,
          petId: pet.id,
          locationId: f.location.id,
          type: "FREE",
          title: "UI Модерація " + String(i).padStart(2, "0"),
          description: "Повний опис для перевірки модератором.",
          moderationStatus: "PENDING",
          updatedAt: new Date(Date.UTC(1990, 0, 1, 0, 0, i)),
          images: {
            create: {
              url: "https://res.cloudinary.com/fixture/image/upload/sample.jpg",
            },
          },
        },
      }),
    );
  }
  const approvedPet = await db.pet.create({
    data: {
      ownerId: f.seller.user.id,
      speciesId: f.breeds[0].speciesId,
      gender: "FEMALE",
    },
  });
  const hiddenCandidate = await db.listing.create({
    data: {
      sellerId: f.seller.user.id,
      petId: approvedPet.id,
      locationId: f.location.id,
      type: "FREE",
      title: "UI Схвалене оголошення",
      description: "Схвалене оголошення для перевірки приховування.",
      moderationStatus: "APPROVED",
      status: "ACTIVE",
      publishedAt: new Date("1989-01-01"),
      updatedAt: new Date("1989-01-01"),
      images: {
        create: {
          url: "https://res.cloudinary.com/fixture/image/upload/sample.jpg",
        },
      },
    },
  });
  await db.favorite.create({
    data: { userId: f.seller.user.id, listingId: hiddenCandidate.id },
  });
  await db.pet.update({
    where: { id: f.breeder.id },
    data: { showOnBreederProfile: true },
  });
  const mating = await db.matingListing.create({
    data: {
      ownerId: f.full.user.id,
      petId: f.breeder.id,
      locationId: f.location.id,
      title: "UI В’язка для перевірки",
      description: "Умови в’язки для перевірки адміністратором.",
      moderationStatus: "PENDING",
      updatedAt: new Date("1990-01-01"),
    },
  });
  const review = await db.review.create({
    data: {
      authorId: f.seller.user.id,
      targetUserId: f.full.user.id,
      rating: 5,
      text: "UI Повний відгук про спілкування з власником розплідника.",
      status: "PENDING",
      interactionContext: "Обговорення умов",
      updatedAt: new Date("1990-01-01"),
    },
  });
  await go("/admin/moderation");
  await page.waitForURL(/\/login\?/);
  assert.ok(
    new URL(page.url()).searchParams
      .get("returnTo")
      .startsWith("/admin/moderation"),
  );
  pass("anonymous uses safe login return without admin data");
  await login(admin);
  await page.getByRole("link", { name: "Модерація", exact: true }).click();
  await page.locator(".admin-queue-card").first().waitFor();
  await page.waitForLoadState("networkidle");
  pass("A real ADMIN account navigation and queue");
  const queueCount = requests.filter((r) => r.path.endsWith("/queue")).length;
  assert.equal(queueCount, 1);
  assert.equal(
    requests.filter((r) => r.path !== "/api/v1/admin/moderation/queue").length,
    0,
  );
  pass("one queue request, no per-card detail request or prefetch");
  await geometry("/admin/moderation?type=LISTING", "queue");
  await choose("Тип матеріалу", "Відгуки");
  assert.ok(page.url().includes("type=REVIEW"));
  await choose("Статус модерації", "Схвалено");
  assert.ok(page.url().includes("status=APPROVED"));
  await page.goBack();
  await page.waitForURL((url) => !url.searchParams.has("status"));
  await page.waitForLoadState("networkidle");
  assert.ok(!page.url().includes("status=APPROVED"));
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("status") === "APPROVED");
  await page.waitForLoadState("networkidle");
  assert.ok(page.url().includes("status=APPROVED"));
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Статус модерації" })
      .getAttribute("data-value"),
    "APPROVED",
  );
  pass("filters, refresh and Back/Forward preserve URL state");
  await go("/admin/moderation?type=LISTING&page=2");
  await page.locator(".admin-queue-card").first().waitFor();
  assert.ok(page.url().includes("page=2"));
  pass("real page2 pagination renders bounded page");
  await page.route(
    "**/api/v1/admin/moderation/queue?*",
    async (route) => {
      if (new URL(route.request().url()).searchParams.get("page") === "2")
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            meta: { page: 2, limit: 24, total: 1, pages: 1 },
          }),
        });
      else await route.continue();
    },
    { times: 1 },
  );
  await page.reload();
  await page.waitForURL((url) => !url.searchParams.has("page"));
  await page.locator(".admin-queue-card").first().waitFor();
  pass("shrinking page2 recovers to last valid page with replace");
  await page.route(
    "**/api/v1/admin/moderation/queue?*",
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "INTERNAL-SECRET-DO-NOT-RENDER" }),
      }),
    { times: 1 },
  );
  await page.reload();
  await page.getByText("Не вдалося завантажити чергу модерації.").waitFor();
  assert.equal(
    await page.getByText("INTERNAL-SECRET-DO-NOT-RENDER").count(),
    0,
  );
  await action("Спробувати ще раз");
  await page.locator(".admin-queue-card").first().waitFor();
  pass("queue failure hides raw errors and offers retry");
  await page.route(
    "**/api/v1/admin/moderation/queue?*",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { page: 1, limit: 24, total: 0, pages: 0 },
        }),
      }),
    { times: 1 },
  );
  await go("/admin/moderation");
  await page
    .getByRole("heading", { name: "Черга модерації порожня" })
    .waitFor();
  pass("empty state is separate from loading/error");
  await detail("listings", rows[0]);
  assert.ok(
    await page.getByText("Повний опис для перевірки модератором.").isVisible(),
  );
  assert.equal(await page.getByText("PRIVATE-CARE-DO-NOT-RENDER").count(), 0);
  assert.equal(
    await page
      .locator("h1")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  pass("typed listing detail and focus use safe full projection");
  await action("Схвалити");
  await page.getByText("Оголошення схвалено.", { exact: true }).waitFor();
  assert.equal(
    (
      await publicPage.request.get(
        "http://localhost:4000/api/v1/listings/" + rows[0].id,
      )
    ).status(),
    200,
  );
  await go("/admin/moderation?type=LISTING");
  assert.equal(
    await page.locator('a[href*="/' + rows[0].id + '?"]').count(),
    0,
  );
  pass("B approval updates detail, leaves PENDING and publishes");
  await geometry("/admin/moderation/listings/" + rows[1].id, "listing-detail");
  await geometry("/admin/moderation/listings/" + rows[1].id, "reject-dialog", {
    dialog: true,
  });
  await detail("listings", rows[1]);
  await action("Відхилити");
  const dialog = page.getByRole("dialog"),
    textarea = dialog.getByRole("textbox");
  await textarea.fill("short");
  await dialog.getByRole("button", { name: "Відхилити", exact: true }).click();
  await dialog.getByText("Вкажіть причину від 10 до 1000 символів.").waitFor();
  await textarea.focus();
  await page.keyboard.press("Shift+Tab");
  // The focus-trap boundary is the first field, independent of submit validation focus.
  assert.equal(
    await dialog
      .getByRole("button", { name: "Відхилити", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await textarea.evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Відхилити", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  pass("reason limits, focus trap and Escape return");
  const rejection = "Виправте опис оголошення перед публікацією.";
  await reason("Відхилити", rejection);
  await page.getByText("Оголошення відхилено.", { exact: true }).waitFor();
  await login(f.seller, ownerPage);
  await go("/listings/" + rows[1].id + "/edit", ownerPage);
  await ownerPage.getByText(rejection, { exact: true }).waitFor();
  pass("C rejected listing stays private and owner sees exact reason");
  await detail("mating-listings", mating);
  await geometry(
    "/admin/moderation/mating-listings/" + mating.id,
    "mating-detail",
  );
  await action("Схвалити");
  await page.getByText("В’язку схвалено.", { exact: true }).waitFor();
  assert.equal(
    (
      await publicPage.request.get(
        "http://localhost:4000/api/v1/mating-listings/" + mating.id + "/public",
      )
    ).status(),
    200,
  );
  const publicPet = (
    await (
      await publicPage.request.get(
        "http://localhost:4000/api/v1/pets/" + f.breeder.id + "/public",
      )
    ).json()
  ).data;
  assert.equal(publicPet.activeMatingListing.id, mating.id);
  const sellerMating = (
    await (
      await publicPage.request.get(
        "http://localhost:4000/api/v1/sellers/" +
          f.full.user.id +
          "/mating-listings",
      )
    ).json()
  ).data;
  assert.ok(sellerMating.some((row) => row.id === mating.id));
  pass("D mating approval updates public Pet and seller collection");
  const summaryUrl =
    "http://localhost:4000/api/v1/sellers/" +
    f.full.user.id +
    "/review-summary";
  const countBefore = (await (await publicPage.request.get(summaryUrl)).json())
    .data.reviewCount;
  await detail("reviews", review);
  await geometry("/admin/moderation/reviews/" + review.id, "review-detail");
  await page.getByRole("img", { name: "Рейтинг 5 з 5" }).waitFor();
  await action("Схвалити");
  await page.getByText("Відгук схвалено.", { exact: true }).waitFor();
  assert.equal(
    (await (await publicPage.request.get(summaryUrl)).json()).data.reviewCount,
    countBefore + 1,
  );
  await reason("Приховати", "Відгук приховано через некоректний зміст.");
  await page.getByText("Відгук приховано.", { exact: true }).waitFor();
  assert.equal(
    (await (await publicPage.request.get(summaryUrl)).json()).data.reviewCount,
    countBefore,
  );
  pass("E/F review approval/hide recalculate public summary");
  await go("/admin/moderation?type=LISTING&status=APPROVED");
  await page
    .getByRole("link", {
      name: "Переглянути: UI Схвалене оголошення",
      exact: true,
    })
    .click();
  await page.locator(".admin-detail-sidebar").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Схвалити", exact: true }).count(),
    0,
  );
  await reason("Приховати", "Оголошення приховано через некоректний зміст.");
  await page.getByText("Оголошення приховано.", { exact: true }).waitFor();
  assert.equal(
    (
      await publicPage.request.get(
        "http://localhost:4000/api/v1/listings/" + hiddenCandidate.id,
      )
    ).status(),
    404,
  );
  assert.equal(
    await db.favorite.count({
      where: { userId: f.seller.user.id, listingId: hiddenCandidate.id },
    }),
    1,
  );
  pass("F approved-filter Hide removes public truth and retains favorite");
  await detail("listings", rows[2]);
  await action("Відхилити");
  const staleReason = "Причина, яку потрібно зберегти після конфлікту.";
  await page.getByRole("dialog").getByRole("textbox").fill(staleReason);
  await db.listing.update({
    where: { id: rows[2].id },
    data: { description: "Змінений власником зміст для повторного перегляду." },
  });
  const attemptsBefore = requests.filter((r) =>
    r.path.endsWith("/reject"),
  ).length;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Відхилити", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Контент змінився після відкриття. Оновіть дані перед рішенням.")
    .waitFor();
  assert.equal(
    requests.filter((r) => r.path.endsWith("/reject")).length,
    attemptsBefore + 1,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Оновити", exact: true })
    .click();
  await page
    .getByText("Змінений власником зміст для повторного перегляду.", {
      exact: true,
    })
    .waitFor();
  await action("Відхилити");
  assert.equal(
    await page.getByRole("dialog").getByRole("textbox").inputValue(),
    staleReason,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    (await db.listing.findUnique({ where: { id: rows[2].id } }))
      .moderationStatus,
    "PENDING",
  );
  pass(
    "G owner-edit409 preserves reason, refreshes explicitly and never auto-submits",
  );
  await login({ user: admin2 }, secondPage);
  await detail("listings", rows[3]);
  await detail("listings", rows[3], secondPage);
  await action("Схвалити", secondPage);
  await secondPage.getByText("Оголошення схвалено.", { exact: true }).waitFor();
  await action("Схвалити");
  await page
    .locator(".admin-conflict")
    .getByText("Контент змінився після відкриття. Оновіть дані перед рішенням.")
    .waitFor();
  await action("Оновити");
  await page
    .getByText("Цей матеріал уже було опрацьовано.", { exact: true })
    .waitFor();
  assert.equal(
    (await db.listing.findUnique({ where: { id: rows[3].id } }))
      .moderationStatus,
    "APPROVED",
  );
  pass("two real ADMIN sessions cannot overwrite the first decision");
  await go("/admin/moderation?type=LISTING");
  await db.user.update({
    where: { id: admin.user.id },
    data: { role: "USER" },
  });
  await choose("Тип матеріалу", "Відгуки");
  await page
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  assert.equal(
    await page.locator(".admin-queue-card,.admin-detail-sidebar").count(),
    0,
  );
  await db.user.update({
    where: { id: admin.user.id },
    data: { role: "ADMIN" },
  });
  await action("Перевірити доступ");
  await page.getByRole("heading", { name: "Модерація", exact: true }).waitFor();
  pass(
    "role loss clears admin-private data; explicit access check is required",
  );
  const tab = await context.newPage();
  await go("/account", tab);
  await tab
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL(/\/login/);
  assert.equal(
    await page.locator(".admin-queue-card,.admin-detail-sidebar").count(),
    0,
  );
  await login(f.full, tab);
  await go("/admin/moderation");
  await page
    .getByRole("heading", { name: "Доступ до модерації недоступний" })
    .waitFor();
  await go("/account", tab);
  assert.equal(
    await tab.getByRole("link", { name: "Модерація", exact: true }).count(),
    0,
  );
  await go("/admin/moderation/listings/" + rows[0].id);
  await expectDenied();
  pass("H admin logout/BREEDER login removes queue/detail and navigation");
  await tab.close();
  assert.deepEqual(errors, []);
  pass("no runtime/hydration errors");
  await writeFile(
    "test-results/phase10c-browser.json",
    JSON.stringify({ checks, errors, requests }, null, 2),
  );
} catch (error) {
  console.error(
    "FAILURE URL:",
    page.url(),
    "RECENT HTTP:",
    JSON.stringify(httpResponses.slice(-18)),
  );
  await page.screenshot({
    path: "test-results/phase10c-failure.png",
    fullPage: false,
  });
  console.error("PRIMARY BROWSER FAILURE:", error);
  throw error;
} finally {
  await browser.close();
  if (f && fixtureUserIds.length)
    await f.db.review.deleteMany({
      where: {
        OR: [
          { authorId: { in: fixtureUserIds } },
          { targetUserId: { in: fixtureUserIds } },
        ],
      },
    });
  if (f) await f.cleanup();
}
