import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { adminBrowserFixture } from "../../pet-platform-backend/test/helpers/admin-browser-fixture.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.BREEDER_WORKSPACE_UI_URL ?? "http://localhost:3019";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const fixture = await adminBrowserFixture();
let browser;
const results = [],
  out = "test-results/phase18e-integration";
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
      if (m.type() === "error" && /hydration|did not match/i.test(m.text()))
        errors.push(m.text());
    });
    // Transparent transport forwarding only: no API response or authorization mocks.
    await context.route("**/api/v1/**", (route) => {
      const source = new URL(route.request().url());
      if (!["GET", "OPTIONS"].includes(route.request().method()))
        writes.push(source.pathname);
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
    };
    try {
      await fixture.login(context, admin);
      await go("/admin/breeders/new");
      await page
        .getByLabel(/Назва розплідника/)
        .fill("Синтетичний розплідник — довга українська назва для аудиту");
      await page
        .getByRole("button", {
          name: "Створити приватну чернетку",
          exact: true,
        })
        .click();
      await page.waitForURL(/\/admin\/breeders\/[0-9a-f-]{36}/);
      const draftId = new URL(page.url()).pathname.split("/").at(-1);
      for (const type of ["LOGO", "COVER", "IMAGE", "IMAGE"]) {
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
        // Wait for persisted API revision and editor remount rather than a thumbnail-only assertion.
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
      await page.reload();
      await page.locator("#workspace-LOGO").waitFor();
      assert.equal(
        await fixture.db.breederMedia.count({
          where: { operatorDraftId: draftId },
        }),
        4,
      );
      for (let i = 0; i < 3; i++) {
        await page
          .getByRole("button", { name: "Додати оголошення", exact: true })
          .click();
        const editor = page.locator(".breeder-workspace-editor");
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
          .getByPlaceholder("Введіть назву міста або села")
          .fill("Київ");
        await page.getByRole("option", { name: /Київ/ }).first().click();
        await editor
          .getByLabel("Додати фото", { exact: true })
          .setInputFiles(image);
        await editor
          .getByRole("button", { name: /Створити|Зберегти/ })
          .last()
          .click();
        await editor.waitFor({ state: "hidden" });
      }
      await page.reload();
      await page.locator("#workspace-LOGO").waitFor();
      const drafts = await fixture.db.operatorListingDraft.findMany({
        where: { breederDraftId: draftId },
        orderBy: { title: "asc" },
      });
      assert.equal(drafts.length, 3);
      assert(drafts.every((d) => d.status === "DRAFT" && !d.transferredAt));
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
      await page.getByLabel("Пошта власника").fill(owner.email);
      await page
        .getByRole("button", { name: "Надіслати запрошення", exact: true })
        .click();
      await page.getByText("Очікує прийняття", { exact: true }).waitFor();
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
        .getByRole("button", { name: "Підтвердити отримання профілю" })
        .click();
      await page.waitForURL("**/profile/breeder");
      await page
        .getByRole("heading", { name: "Отриманий профіль приватний" })
        .first()
        .waitFor();
      const profile = await fixture.db.breederProfile.findUniqueOrThrow({
        where: { userId: owner.id },
      });
      assert(profile.publicationHeld);
      assert.equal(
        await fixture.db.breederMedia.count({
          where: { breederProfileId: profile.id },
        }),
        4,
      );
      await fixture.login(context, admin);
      await go(`/admin/breeders/${draftId}?source=OPERATOR_PREPARED`);
      const checks = page.getByLabel("Вибрати для передачі власнику", {
        exact: true,
      });
      await checks.nth(0).check();
      await checks.nth(1).check();
      await page
        .getByRole("button", {
          name: "Запропонувати передачу (2)",
          exact: true,
        })
        .click();
      await page.getByText(/Власник може переглянути й прийняти/).waitFor();
      await fixture.login(context, owner);
      await go("/profile/breeder");
      const acceptance = page.getByLabel(/Дані цих тварин перевірено/);
      await acceptance.focus();
      await acceptance.press("Space");
      await page
        .getByRole("button", {
          name: "Прийняти вибрані оголошення",
          exact: true,
        })
        .click();
      await page
        .getByText("Нових пропозицій немає.", { exact: true })
        .waitFor();
      const listings = await fixture.db.listing.findMany({
        where: { sellerId: owner.id },
      });
      assert.equal(listings.length, 2);
      assert(
        listings.every(
          (l) => l.status === "DRAFT" && l.moderationStatus === "NOT_SUBMITTED",
        ),
      );
      assert.equal(
        await fixture.db.pet.count({
          where: { ownerId: owner.id, visibility: "PRIVATE" },
        }),
        2,
      );
      assert.equal(
        await fixture.db.operatorListingDraft.count({
          where: { breederDraftId: draftId, transferredAt: null },
        }),
        1,
      );
      await check();
      await page.screenshot({
        path: `${out}/owner-${width}.png`,
        fullPage: true,
      });
      results.push({
        width,
        realNestPostgres: true,
        threeDrafts: true,
        logoCoverGallery: true,
        claim: true,
        selectedHandoff: true,
        private: true,
        noOverflow: true,
        mutationRequests: writes.length,
      });
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
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await fixture.close();
}
