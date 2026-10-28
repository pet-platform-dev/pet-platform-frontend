import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { adminBrowserFixture } from "../../pet-platform-backend/test/helpers/admin-browser-fixture.mjs";
import { validatePublicBreederIdentity } from "./helpers/public-breeder-identity.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.BREEDER_WORKSPACE_UI_URL ?? "http://localhost:3019";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const fixture = await adminBrowserFixture();
let browser;
const results = [],
  out = "test-results/phase18f-integration";
await mkdir(out, { recursive: true });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const image = { name: "synthetic.png", mimeType: "image/png", buffer: png };
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [375, 768, 1440]) {
    const admin = await fixture.user("ADMIN"),
      owner = await fixture.user();
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [],
      writes = [],
      transport = [];
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/v1/"))
        transport.push({ path: u.pathname, status: r.status() });
    });
    page.on("requestfailed", (r) =>
      transport.push({
        path: new URL(r.url()).pathname,
        failure: r.failure()?.errorText,
      }),
    );
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|did not match|same key|two children/i.test(m.text())
      )
        errors.push(m.text());
    });
    let failCreationOnce = true;
    // Successful mutations always reach Nest; inject one503 to verify safe retry.
    await context.route("**/api/v1/**", (route) => {
      const source = new URL(route.request().url());
      if (!["GET", "OPTIONS"].includes(route.request().method()))
        writes.push(source.pathname);
      if (
        source.pathname === "/api/v1/admin/breeders" &&
        route.request().method() === "POST" &&
        failCreationOnce
      ) {
        failCreationOnce = false;
        return route.fulfill({
          status: 503,
          headers: {
            "Access-Control-Allow-Origin": new URL(base).origin,
            "Access-Control-Allow-Credentials": "true",
          },
          contentType: "application/json",
          body: JSON.stringify({
            statusCode: 503,
            message: "Синтетична тимчасова помилка",
          }),
        });
      }
      return route.continue({
        url: "http://localhost:4018" + source.pathname + source.search,
      });
    });
    await context.route("https://res.cloudinary.com/synthetic/**", (r) =>
      r.fulfill({ contentType: "image/png", body: png }),
    );
    const go = (path) => page.goto(base + path);
    const check = async () => {
      assert.deepEqual(errors, []);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (
        /\/admin\/breeders\/[0-9a-f-]{36}$/.test(
          new URL(page.url()).pathname,
        ) &&
        (await page.locator("#workspace-LOGO").count())
      ) {
        for (const name of [
          "Основна інформація",
          "Логотип і обкладинка",
          "Фотогалерея",
          "Публічні контакти",
          "Відео",
          "Оголошення",
          "Запросити власника",
          "Останні адміністративні зміни",
        ]) {
          assert.equal(
            await page.getByRole("heading", { name, exact: true }).count(),
            1,
            `One ${name} section`,
          );
        }
      }
    };
    try {
      await fixture.login(context, admin);
      await go("/admin/breeders/new");
      await page.getByLabel(/Назва розплідника/).fill("Silver Paw Malinois");
      await page
        .locator("#breeder-description")
        .fill("<script>invalid</script>");
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      assert.equal(
        await fixture.db.operatorBreederDraft.count({
          where: { preparedById: admin.id },
        }),
        0,
      );
      await page
        .locator("#breeder-description")
        .fill("Синтетичний розплідник для перевірки майстра");
      await page
        .getByRole("button", { name: "Далі", exact: true })
        .evaluate((button) => {
          button.click();
          button.click();
        });
      await page.getByText(/Не вдалося зберегти\. Перевірте поля/).waitFor();
      const creationId = new URL(page.url()).searchParams.get("creationId");
      assert(creationId);
      assert.equal(
        await fixture.db.operatorBreederDraft.count({
          where: { preparedById: admin.id },
        }),
        0,
      );
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL(
        (u) =>
          u.pathname === "/admin/breeders/new" &&
          u.searchParams.get("step") === "2",
      );
      await check();
      const draftId = new URL(page.url()).searchParams.get("draftId");
      assert(draftId);
      assert.equal(draftId, creationId);
      assert.equal(
        await fixture.db.operatorBreederDraft.count({
          where: { preparedById: admin.id },
        }),
        1,
      );
      for (const type of ["LOGO", "COVER"]) {
        const count = await fixture.db.breederMedia.count({
          where: { operatorDraftId: draftId },
        });
        const stored = page.waitForResponse(
          (r) =>
            r.url().endsWith(`/admin/breeders/${draftId}/media`) &&
            r.request().method() === "POST",
        );
        await page.locator(`#workspace-${type}`).setInputFiles(image);
        assert((await stored).ok());
        await page.waitForFunction(
          () => !document.querySelector('[aria-busy="true"]'),
        );
        // Persisted revisions must refresh without remounting the workspace.
        await page
          .getByText("Зберігаємо фото…", { exact: true })
          .waitFor({ state: "hidden" });
        assert.equal(
          await fixture.db.breederMedia.count({
            where: { operatorDraftId: draftId },
          }),
          count + 1,
        );
      }
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "3");
      await check();
      await page
        .getByLabel("Вебсайт — необов’язково", { exact: true })
        .fill("javascript:alert(1)");
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      assert.equal(new URL(page.url()).searchParams.get("step"), "3");
      await page
        .getByLabel("Вебсайт — необов’язково", { exact: true })
        .fill("https://example.invalid/kennel");
      await page
        .getByLabel("Телефон — необов’язково", { exact: true })
        .fill("+380501234567");
      await page.getByPlaceholder("Введіть назву міста або села").fill("Київ");
      await page.getByRole("option", { name: /Київ/ }).first().click();
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "4");
      await check();
      for (const target of [3, 2, 1]) {
        await page.getByRole("button", { name: "Назад", exact: true }).click();
        await page.waitForURL(
          (u) => u.searchParams.get("step") === String(target),
        );
      }
      assert.equal(
        await page.locator("#breeder-description").inputValue(),
        "Синтетичний розплідник для перевірки майстра",
      );
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "2");
      for (const target of [3, 4]) {
        await page
          .getByRole("button", { name: "Пропустити", exact: true })
          .click();
        await page.waitForURL(
          (u) => u.searchParams.get("step") === String(target),
        );
      }
      assert.equal(
        (
          await fixture.db.operatorBreederDraft.findUniqueOrThrow({
            where: { id: draftId },
          })
        ).website,
        "https://example.invalid/kennel",
      );
      assert.equal(
        await fixture.db.operatorBreederDraft.count({
          where: { preparedById: admin.id },
        }),
        1,
      );
      await page
        .locator("#workspace-IMAGE")
        .setInputFiles([
          image,
          { ...image, name: "second.png" },
          { ...image, name: "third.png" },
        ]);
      await page
        .locator(
          ".breeder-workspace-media:visible .breeder-workspace-photos article",
        )
        .nth(2)
        .waitFor();
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      assert.equal(
        await fixture.db.breederMedia.count({
          where: { operatorDraftId: draftId, type: "IMAGE" },
        }),
        3,
      );
      await page
        .getByRole("button", {
          name: "Фото 3: перемістити ліворуч",
          exact: true,
        })
        .click();
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "5");
      await check();
      await page
        .getByLabel("Посилання на відео", { exact: true })
        .fill("https://youtu.be/abcdefghijk");
      await page
        .getByRole("button", { name: "Додати відео", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Редагувати відео 1", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "6");
      await check();
      await go("/admin/breeders?source=OPERATOR_PREPARED");
      await page.locator(`a[href*="${draftId}"]`).first().click();
      await page
        .getByRole("link", {
          name: "Продовжити майстер створення",
          exact: true,
        })
        .click();
      await page.waitForURL((u) => u.searchParams.get("draftId") === draftId);
      await go(`/admin/breeders/new?draftId=${draftId}&step=6`);
      await page
        .getByRole("heading", { name: "Оголошення", exact: true })
        .first()
        .waitFor();
      assert.equal(
        await fixture.db.operatorBreederDraft.count({
          where: { preparedById: admin.id },
        }),
        1,
      );
      const parentBeforeListings =
        await fixture.db.operatorBreederDraft.findUniqueOrThrow({
          where: { id: draftId },
        });
      const catBreed = await fixture.db.breed.findFirstOrThrow({
        where: { species: { slug: "cat" }, isActive: true },
        orderBy: { name: "asc" },
      });
      const listingPath = `/api/v1/admin/breeders/${draftId}/listing-drafts`;
      for (let i = 0; i < 3; i++) {
        await page
          .getByRole("button", { name: "Додати оголошення", exact: true })
          .click();
        const editor = page.locator(".breeder-workspace-editor");
        assert.equal(
          await editor
            .getByLabel("Довідка про власника", { exact: true })
            .count(),
          0,
        );
        assert.equal(await editor.locator("#breederDraftId").count(), 0);
        await editor
          .getByText("Silver Paw Malinois", { exact: true })
          .waitFor();
        await editor
          .locator(".selected-breed strong")
          .filter({ hasText: /^Київ$/ })
          .waitFor();
        await editor
          .getByLabel("Заголовок", { exact: true })
          .fill(`Синтетична тварина ${i + 1}`);
        await editor
          .getByLabel("Опис", { exact: true })
          .fill("Синтетичний опис для наскрізного браузерного аудиту");
        await editor.getByLabel("Ціна, грн", { exact: true }).fill("100");
        await editor
          .getByRole("combobox", { name: "Вид тварини", exact: true })
          .click();
        await page.getByRole("option", { name: "Кіт", exact: true }).click();
        await editor
          .getByPlaceholder("Почніть вводити назву породи")
          .fill(catBreed.name.slice(0, 4));
        await page
          .getByRole("option", {
            name: catBreed.nameUk?.trim() || catBreed.name,
            exact: true,
          })
          .click();
        await editor
          .getByLabel("Додати фото", { exact: true })
          .setInputFiles(
            i === 0 ? [image, { ...image, name: "second-listing.png" }] : image,
          );
        if (i === 0)
          await editor
            .getByRole("button", { name: "Зробити головним", exact: true })
            .click();
        if (i === 0) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({
            path: `${out}/scoped-editor-${width}.png`,
            fullPage: true,
          });
        }
        if (i === 0) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({
            path: `${out}/scoped-editor-${width}.png`,
            fullPage: true,
          });
        }
        await editor
          .getByRole("button", { name: /Створити|Зберегти/ })
          .last()
          .click();
        await editor.waitFor({ state: "hidden" });
      }
      assert.equal(writes.filter((p) => p === listingPath).length, 3);
      assert.deepEqual(
        await fixture.db.operatorBreederDraft.findUniqueOrThrow({
          where: { id: draftId },
        }),
        parentBeforeListings,
      );
      await page.getByRole("button", { name: "Назад", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "5");
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "6");
      await page.reload();
      await page.locator(".breeder-workspace-list > li").nth(2).waitFor();
      assert.equal(
        await page.locator(".breeder-workspace-list > li").count(),
        3,
      );
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "7");
      await page
        .locator("dl > div")
        .filter({
          has: page.getByText("Підготовлені оголошення", { exact: true }),
        })
        .getByText("3", { exact: true })
        .waitFor();
      await check();
      await page.screenshot({
        path: `${out}/wizard-review-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Завершити створення", exact: true })
        .click();
      await page.waitForURL((u) => u.pathname.endsWith(draftId));
      await page.reload();
      await page.locator("#workspace-LOGO").waitFor();
      const drafts = await fixture.db.operatorListingDraft.findMany({
        where: { breederDraftId: draftId },
        orderBy: { title: "asc" },
      });
      assert.equal(drafts.length, 3);
      assert(drafts.every((d) => d.status === "DRAFT" && !d.transferredAt));
      assert(
        drafts.every(
          (d) => d.breederDraftId === draftId && d.breedId === catBreed.id,
        ),
      );
      assert.equal(
        await fixture.db.listingUploadAsset.count({
          where: { operatorDraftId: drafts[0].id, status: "ATTACHED" },
        }),
        2,
      );
      for (const d of drafts) {
        const publicResponse = await context.request.get(
          `http://localhost:4018/api/v1/listings/${d.id}`,
        );
        assert.equal(publicResponse.status(), 404);
      }
      await page
        .locator(".breeder-workspace-list")
        .getByRole("button", { name: "Редагувати", exact: true })
        .first()
        .click();
      const editor = page.locator(".breeder-workspace-editor");
      const editedTitle = await editor
        .getByLabel("Заголовок", { exact: true })
        .inputValue();
      const otherBefore = drafts.filter((d) => d.title !== editedTitle);
      await editor
        .getByLabel("Опис", { exact: true })
        .fill("Оновлений синтетичний опис");
      await editor
        .getByRole("button", { name: /Зберегти/ })
        .last()
        .click();
      await editor.waitFor({ state: "hidden" });
      assert.deepEqual(
        await fixture.db.operatorListingDraft.findMany({
          where: { id: { in: otherBefore.map((d) => d.id) } },
          orderBy: { title: "asc" },
        }),
        otherBefore,
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Запросити власника", exact: true })
          .count(),
        1,
      );
      const nameInput = page.getByLabel(/Назва розплідника/);
      const originalName = await nameInput.inputValue();
      await nameInput.fill("Незбережена назва");
      await page.evaluate(() => {
        globalThis.__phase18fInput = document.querySelector(
          "#breeder-kennelName",
        );
        globalThis.__phase18fDocument = document;
        window.scrollTo(0, 300);
      });
      const scrollBeforeUpload = await page.evaluate(() => scrollY);
      await page.locator("#workspace-LOGO").setInputFiles(image);
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      assert.equal(await nameInput.inputValue(), "Незбережена назва");
      assert.equal(await page.evaluate(() => scrollY), scrollBeforeUpload);
      assert(
        await page.evaluate(
          () =>
            globalThis.__phase18fInput ===
              document.querySelector("#breeder-kennelName") &&
            globalThis.__phase18fDocument === document,
        ),
      );
      await nameInput.fill(originalName);
      await check();
      assert.equal(
        await page
          .getByRole("heading", { name: "Запросити власника", exact: true })
          .count(),
        1,
      );
      await page.getByLabel("Пошта власника").fill(owner.email);
      await page
        .getByRole("button", { name: "Надіслати запрошення", exact: true })
        .click();
      await page.getByText("Очікує прийняття", { exact: true }).waitFor();
      const preparedPhotos = await fixture.db.listingUploadAsset.findMany({
        where: { operatorDraft: { breederDraftId: draftId } },
        select: {
          id: true,
          operatorDraftId: true,
          publicId: true,
          url: true,
          position: true,
        },
        orderBy: { position: "asc" },
      });
      const letter = fixture.letters.findLast((m) => m.to === owner.email);
      assert(letter);
      const claim = new URL(letter.text.match(/https?:\/\/[^\s]+/)[0]);
      await fixture.login(context, owner);
      await go(claim.pathname + claim.search);
      await page
        .getByRole("button", { name: "Переглянути підготовлений профіль" })
        .click();
      assert.equal(new URL(page.url()).search, "");
      await page
        .getByRole("heading", { name: "Оголошень у пакеті: 3", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", {
            name: "Прийняти розплідник та оголошення",
            exact: true,
          })
          .count(),
        1,
      );
      await page.screenshot({
        path: out + "/package-preview-" + width + ".png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Прийняти розплідник та оголошення" })
        .click();

      await page.waitForURL("**/my-listings");
      const profile = await fixture.db.breederProfile.findUniqueOrThrow({
        where: { userId: owner.id },
      });
      assert(profile.publicationHeld);
      assert.equal(
        await fixture.db.breederMedia.count({
          where: { breederProfileId: profile.id },
        }),
        6,
      );
      const listings = await fixture.db.listing.findMany({
        where: { sellerId: owner.id },
        include: { images: { orderBy: { position: "asc" } } },
      });
      assert.equal(listings.length, 3);
      assert(
        listings.every(
          (l) => l.status === "DRAFT" && l.moderationStatus === "NOT_SUBMITTED",
        ),
      );
      assert.equal(
        await fixture.db.preparedListingHandoff.count({
          where: { profileId: profile.id },
        }),
        0,
      );
      assert.equal(
        await fixture.db.operatorListingDraft.count({
          where: { breederDraftId: draftId, transferredAt: null },
        }),
        0,
      );
      assert.equal(
        await fixture.db.pet.count({
          where: { ownerId: owner.id, visibility: "PRIVATE" },
        }),
        3,
      );
      await page.reload();
      for (const l of listings)
        await page.locator('a[href="/listings/' + l.id + '/edit"]').waitFor();
      assert.equal(await page.locator(".owner-listing-card").count(), 3);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".owner-listing-card img")].length ===
            3 &&
          [...document.querySelectorAll(".owner-listing-card img")].every(
            (img) => img.complete && img.naturalWidth > 0,
          ),
      );
      for (const l of listings) {
        const d = await fixture.db.operatorListingDraft.findFirstOrThrow({
          where: { transferredListingId: l.id },
        });
        const originals = preparedPhotos.filter(
          (m) => m.operatorDraftId === d.id,
        );
        assert.deepEqual(
          l.images.map((m) => m.assetId),
          originals.map((m) => m.id),
        );
        assert.deepEqual(
          l.images.map((m) => m.url),
          originals.map((m) => m.url),
        );
        const visiblePhoto = page.locator(
          '.owner-listing-card:has(a[href="/listings/' + l.id + '/edit"]) img',
        );
        assert(
          (await visiblePhoto.getAttribute("src")).includes(
            originals[0].publicId,
          ),
        );
        const publicRead = await context.request.get(
          "http://localhost:4018/api/v1/listings/" + l.id,
        );
        assert.equal(publicRead.status(), 404);
      }
      await check();
      await page.screenshot({
        path: out + "/package-my-listings-" + width + ".png",
        fullPage: true,
      });
      await page
        .locator('a[href="/listings/' + listings[0].id + '/edit"]')
        .click();
      await page
        .getByLabel("Заголовок", { exact: true })
        .fill("Відредагована тварина пакета");
      await page
        .getByRole("button", { name: "Зберегти зміни", exact: true })
        .click();
      await page.getByText("Зміни збережено.", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Подати на публікацію", exact: true })
        .click();
      await page
        .getByText("Оголошення надіслано на модерацію.", { exact: true })
        .waitFor();
      const submitted = await fixture.db.listing.findUniqueOrThrow({
        where: { id: listings[0].id },
      });
      assert.equal(submitted.moderationStatus, "PENDING");
      assert.equal(
        (
          await context.request.get(
            "http://localhost:4018/api/v1/listings/" + submitted.id,
          )
        ).status(),
        404,
      );
      await check();
      // Recovery is an explicit owner action on an already claimed profile.
      const recoverySession = await fixture.db.listingUploadSession.create({
        data: { userId: admin.id, expiresAt: new Date(Date.now() + 86400000) },
      });
      const recoveryId = crypto.randomUUID(),
        recoveryKey = `pet-platform/tmp/${admin.id}/${recoverySession.id}/${recoveryId}`;
      await fixture.db.listingUploadAsset.create({
        data: {
          id: recoveryId,
          sessionId: recoverySession.id,
          publicId: recoveryKey,
          url: `https://res.cloudinary.com/synthetic/image/upload/v1/${recoveryKey}.png`,
        },
      });
      const recoveryWrite = await context.request.post(
        "http://localhost:4018" + listingPath + "?source=OPERATOR_PREPARED",
        {
          headers: {
            Origin: new URL(base).origin,
            Authorization: "Bearer " + (await fixture.access(admin)),
            "X-CSRF-Token": "s".repeat(43),
            Cookie: "pet_csrf=" + "s".repeat(43),
          },
          data: {
            kind: "FREE",
            status: "DRAFT",
            title: "Залишок отриманого пакета",
            description: "Синтетична тварина для перевірки відновлення",
            speciesId: catBreed.speciesId,
            breedId: catBreed.id,
            locationId: parentBeforeListings.locationId,
            price: null,
            currency: "UAH",
            requirements: null,
            gender: "UNKNOWN",
            birthDate: null,
            imageIds: [recoveryId],
            uploadSessionId: recoverySession.id,
          },
        },
      );
      assert.equal(recoveryWrite.status(), 201);
      await go("/profile/breeder");
      await page
        .getByRole("heading", { name: "Оголошень у пакеті: 1", exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Прийняти всі оголошення пакета",
          exact: true,
        })
        .click();
      await page.waitForURL("**/my-listings");
      await page.reload();
      await page.waitForFunction(
        () => document.querySelectorAll(".owner-listing-card").length === 4,
      );
      assert.equal(
        await fixture.db.listing.count({ where: { sellerId: owner.id } }),
        4,
      );
      assert.equal(
        await fixture.db.preparedListingHandoff.count({
          where: { profileId: profile.id },
        }),
        0,
      );
      await validatePublicBreederIdentity({
        page,
        context,
        fixture,
        owner,
        admin,
        profile,
        listings,
        base,
        out,
        width,
        check,
      });
      await fixture.login(context, admin);
      await go("/admin/breeders");
      await page
        .getByRole("heading", { name: "Розплідники", exact: true })
        .waitFor();
      await check();
      await fixture.db.user.update({
        where: { id: admin.id },
        data: { role: "USER" },
      });
      await page.reload();
      await page
        .getByRole("heading", {
          name: "Доступ до адміністрування недоступний",
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".admin-management-form").count(), 0);
      await go("/account");
      await page
        .getByRole("button", { name: "Вийти з акаунта", exact: true })
        .click();
      await page.waitForURL(/\/login/);
      await check();
      results.push({
        width,
        realNestPostgres: true,
        sevenWizardStages: true,
        safeRetryAndDuplicateSubmit: true,
        backSkipAndRecovery: true,
        stableUploadDocumentAndForm: true,
        noReactKeyWarnings: true,
        packagePreviewBeforeClaim: true,
        atomicPackageClaim: true,
        ownerListingsPersistAfterReload: true,
        ownerPhotosLoadAfterReload: true,
        remainingPrepared: 0,
        ownerDraftLinks: true,
        demotionAndLogout: true,
        threeDrafts: true,
        logoCoverGallery: true,
        claim: true,
        threeDraftsAfterClaim: true,
        existingClaimRecovery: true,
        private: true,
        noOverflow: true,
        mutationRequests: writes.length,
      });
      await writeFile(
        `${out}/http-${width}.json`,
        JSON.stringify(transport, null, 2),
      );
    } catch (error) {
      await writeFile(
        `${out}/failure.json`,
        JSON.stringify(
          { width, transport, text: await page.locator("body").innerText() },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await rm(`${out}/failure.json`, { force: true });
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await fixture.close();
}
