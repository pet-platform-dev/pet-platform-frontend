import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.BREEDER_WORKSPACE_UI_URL ?? "http://localhost:3019";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const file = { name: "synthetic.png", mimeType: "image/png", buffer: png },
  now = "2026-10-25T09:00:00.000Z";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [],
  out = "test-results/phase18d1";
await mkdir(out, { recursive: true });
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.setDefaultTimeout(15000);
    const admin = {
      id: randomUUID(),
      email: "synthetic-admin@example.invalid",
      firstName: "Адміністратор",
      lastName: "Тестовий",
      avatarUrl: null,
      role: "ADMIN",
      accountType: "SELLER",
      verificationStatus: "VERIFIED",
      createdAt: now,
    };
    const owner = {
      ...admin,
      id: randomUUID(),
      email: "synthetic-owner@example.invalid",
      role: "USER",
      accountType: "BREEDER",
    };
    let active = admin,
      prepared,
      revision = 0,
      uploads = [],
      drafts = [],
      invitationSent = false,
      invitationId = randomUUID(),
      failHandoffRead = false,
      failHandoffAccept = true,
      proposal = null,
      accepted = 0,
      profileId = randomUUID();
    const errors = [],
      requests = [];
    const species = { id: randomUUID(), name: "Кіт", slug: "cat" },
      location = {
        id: randomUUID(),
        city: "Київ",
        region: "м. Київ",
        countryCode: "UA",
        slug: "kyiv",
        district: null,
        community: null,
        settlementType: "CITY",
        katottgCode: null,
      };
    const imageUrl = (id) =>
      `https://res.cloudinary.com/synthetic/image/upload/v1/${id}.png`;
    const bump = () => {
      prepared.updatedAt = new Date(
        Date.parse(now) + ++revision * 1000,
      ).toISOString();
    };
    const ownerProfile = () => ({
      id: profileId,
      userId: owner.id,
      kennelName: prepared.kennelName,
      description: prepared.description,
      location: null,
      locationId: null,
      startedYear: null,
      website: null,
      breeds: [],
      breedIds: [],
      createdAt: now,
      updatedAt: prepared.updatedAt,
      publicationHeld: true,
      preparedContacts: prepared.publicContacts ?? null,
      media: {
        logo: prepared.media.find((m) => m.type === "LOGO") ?? null,
        cover: prepared.media.find((m) => m.type === "COVER") ?? null,
        gallery: prepared.media.filter((m) => m.type === "IMAGE"),
        videos: [],
      },
      contactPerson: {
        id: owner.id,
        displayName: "Синтетичний власник",
        phone: null,
        telegram: null,
        viber: null,
        whatsapp: null,
        location: null,
        memberSince: now,
      },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|did not match|same key/i.test(m.text())
      )
        errors.push(m.text());
    });
    await context.route("https://res.cloudinary.com/**", (route) =>
      route.fulfill({ contentType: "image/png", body: png }),
    );
    await context.route("**/api/v1/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname.replace("/api/v1", ""),
        method = req.method();
      const headers = {
        "Access-Control-Allow-Origin": new URL(base).origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers":
          "content-type,authorization,x-csrf-token",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Cache-Control": "no-store",
      };
      const reply = (data, status = 200, envelope = false) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body:
            status === 204 ? "" : JSON.stringify(envelope ? data : { data }),
        });
      if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
      requests.push({ path, method });
      if (path === "/auth/csrf") return reply({ csrfToken: "synthetic-csrf" });
      if (path === "/auth/refresh")
        return active
          ? reply({
              user: active,
              accessToken: "synthetic-access",
              expiresIn: 900,
            })
          : reply(null, 401);
      if (path === "/auth/me") return active ? reply(active) : reply(null, 401);
      if (path === "/auth/logout") {
        active = null;
        return reply(null, 204);
      }
      if (path === "/species") return reply([species]);
      if (path === "/locations")
        return reply(
          {
            data: [location],
            meta: { page: 1, limit: 20, total: 1, pages: 1 },
          },
          200,
          true,
        );
      if (path === "/breeds")
        return reply(
          { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } },
          200,
          true,
        );
      if (path === "/admin/breeders" && method === "POST") {
        const b = req.postDataJSON();
        prepared = {
          ...b,
          id: randomUUID(),
          source: "OPERATOR_PREPARED",
          visibility: "PRIVATE",
          createdAt: now,
          updatedAt: now,
          location: null,
          breeds: [],
          preparedById: admin.id,
          claimedProfileId: null,
          claimedAt: null,
          publicPath: null,
          audit: [],
          media: [],
        };
        return reply(prepared);
      }
      if (path === `/admin/breeders/${prepared?.id}/contacts`) {
        assert.equal(method, "PATCH");
        const b = req.postDataJSON();
        assert.equal(b.expectedUpdatedAt, prepared.updatedAt);
        bump();
        prepared.publicContacts = {
          ...b.contacts,
          updatedAt: prepared.updatedAt,
        };
        return reply({ updatedAt: prepared.updatedAt });
      }
      if (path === `/admin/breeders/${prepared?.id}`) return reply(prepared);
      if (path === `/admin/breeders/${prepared?.id}/media`) {
        const body = req.postDataBuffer().toString(),
          type = /name="type"\r\n\r\n(LOGO|COVER|IMAGE)/.exec(body)?.[1];
        assert(type);
        const id = randomUUID();
        if (type !== "IMAGE")
          prepared.media = prepared.media.filter((m) => m.type !== type);
        prepared.media.push({
          id,
          type,
          url: imageUrl(id),
          thumbnailUrl: imageUrl(id),
          position: prepared.media.filter((m) => m.type === type).length,
        });
        bump();
        return reply({ updatedAt: prepared.updatedAt });
      }
      if (path === `/admin/breeders/${prepared?.id}/media/order`) {
        const b = req.postDataJSON();
        assert.equal(b.expectedUpdatedAt, prepared.updatedAt);
        prepared.media.forEach((m) => {
          if (m.type === "IMAGE") m.position = b.ids.indexOf(m.id);
        });
        prepared.media.sort((a, b) => a.position - b.position);
        bump();
        return reply({ updatedAt: prepared.updatedAt });
      }
      if (
        path.startsWith(`/admin/breeders/${prepared?.id}/media/`) &&
        method === "DELETE"
      ) {
        prepared.media = prepared.media.filter(
          (m) => m.id !== path.split("/").at(-1),
        );
        bump();
        return reply({ updatedAt: prepared.updatedAt });
      }
      if (path === "/uploads/listings/session")
        return reply({ uploadSessionId: randomUUID() });
      if (path.startsWith("/uploads/listings/") && method === "POST") {
        const id = randomUUID();
        uploads.push({ id, url: imageUrl(id) });
        return reply({ id });
      }
      if (path === "/admin/listing-drafts" && method === "POST") {
        const b = req.postDataJSON();
        assert.equal(b.breederDraftId, prepared.id);
        assert(!("ownerId" in b));
        const d = {
          ...b,
          id: randomUUID(),
          source: "OPERATOR_DRAFT",
          type: b.kind,
          images: b.imageIds.map((id) => uploads.find((i) => i.id === id)),
          species,
          breed: null,
          location,
          createdById: admin.id,
          updatedById: admin.id,
          createdAt: now,
          updatedAt: now,
          publicPath: null,
          transferredAt: null,
        };
        drafts.push(d);
        return reply(d);
      }
      if (path === "/admin/listings")
        return reply(
          {
            data:
              url.searchParams.get("source") === "OPERATOR_DRAFT" ? drafts : [],
            meta: { page: 1, limit: 10, total: drafts.length, pages: 1 },
          },
          200,
          true,
        );
      if (path === `/admin/breeders/${prepared?.id}/invitations`) {
        if (method === "POST") invitationSent = true;
        return reply({
          claimedOwnerId: prepared.claimedProfileId ? owner.id : null,
          claimedProfileId: prepared.claimedProfileId,
          claimedAt: prepared.claimedAt,
          invitations: invitationSent
            ? [
                {
                  id: invitationId,
                  recipientEmail: owner.email,
                  status: prepared.claimedProfileId ? "ACCEPTED" : "PENDING",
                  deliveryState: "CAPTURED",
                  createdAt: now,
                  expiresAt: "2026-11-01T00:00:00Z",
                  terminalAt: null,
                  acceptedById: prepared.claimedProfileId ? owner.id : null,
                },
              ]
            : [],
        });
      }
      if (path === "/breeder-claims/preview")
        return reply({
          publicContacts: prepared.publicContacts,
          kennelName: prepared.kennelName,
          description: prepared.description,
          website: null,
          startedYear: null,
          expiresAt: "2026-11-01T00:00:00Z",
          draftRevision: prepared.updatedAt,
        });
      if (path === "/breeder-claims/accept") {
        assert.equal(req.postDataJSON().acceptOwnership, true);
        prepared.claimedProfileId = profileId;
        prepared.claimedAt = now;
        return reply({
          profileId,
          ownerId: owner.id,
          redirectTo: "/profile/breeder",
        });
      }
      if (path === "/breeders/me") return reply(ownerProfile());
      if (path === `/admin/breeders/${prepared?.id}/handoffs`) {
        if (method === "GET")
          return reply(
            proposal
              ? [
                  {
                    ...proposal,
                    status: accepted ? "ACCEPTED" : "PENDING",
                    items: proposal.items.map((i) => ({ draftId: i.draft.id })),
                  },
                ]
              : [],
          );
        const b = req.postDataJSON();
        assert.equal(b.items.length, 2);
        assert(b.items.every((i) => drafts.some((d) => d.id === i.id)));
        failHandoffRead = true;
        proposal = {
          id: randomUUID(),
          expiresAt: "2026-11-01T00:00:00Z",
          breederDraft: { kennelName: prepared.kennelName },
          items: b.items.map((i) => ({
            revision: i.expectedUpdatedAt,
            draft: drafts.find((d) => d.id === i.id),
          })),
        };
        return reply({
          id: proposal.id,
          status: "PENDING",
          expiresAt: proposal.expiresAt,
        });
      }
      if (path === "/breeder-handoffs" && proposal && failHandoffRead) {
        failHandoffRead = false;
        return reply(null, 503);
      }
      if (path === "/breeder-handoffs")
        return reply(
          {
            data: proposal && accepted === 0 ? [proposal] : [],
            meta: {
              page: 1,
              limit: 10,
              total: proposal ? 1 : 0,
              pages: proposal ? 1 : 0,
            },
          },
          200,
          true,
        );
      if (path === `/breeder-handoffs/${proposal?.id}/accept`) {
        assert.equal(active.id, owner.id);
        const b = req.postDataJSON();
        assert.equal(b.confirmAnimals, true);
        assert.equal(b.animals.length, 2);
        if (failHandoffAccept) {
          failHandoffAccept = false;
          return reply(null, 503);
        }
        accepted++;
        assert.equal(accepted, 1);
        drafts.forEach((d) => {
          if (b.animals.some((a) => a.draftId === d.id)) {
            d.transferredAt = now;
            d.images = [];
          }
        });
        return reply(
          b.animals.map((a) => ({
            draftId: a.draftId,
            listingId: randomUUID(),
            petId: randomUUID(),
          })),
        );
      }
      if (path.endsWith("/animals"))
        return reply(
          { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
          200,
          true,
        );
      if (path.endsWith("/unread-count") || path.endsWith("/unread"))
        return reply({ count: 0 });
      return reply({}, 404);
    });
    const check = async () => {
      assert.deepEqual(errors, []);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "No horizontal overflow",
      );
    };
    const switchUser = async (user) => {
      active = user;
      await page.evaluate(() => {
        const c = new BroadcastChannel("pet-platform-session");
        c.postMessage({ kind: "login", source: "synthetic-other-tab" });
        c.close();
      });
    };
    try {
      await page.goto(base + "/admin/breeders/new");
      await page.getByLabel(/Назва розплідника/).fill("Синтетичний теплий дім");
      await page
        .getByRole("button", {
          name: "Створити приватну чернетку",
          exact: true,
        })
        .click();
      await page.waitForURL(/\/admin\/breeders\/[0-9a-f-]{36}/);
      for (const type of ["LOGO", "COVER", "IMAGE", "IMAGE"]) {
        await page.locator(`#workspace-${type}`).setInputFiles(file);
        await page
          .getByText("Зберігаємо фото…", { exact: true })
          .waitFor({ state: "hidden" });
        await page.waitForFunction(
          (type) => Boolean(document.querySelector(`#workspace-${type}`)),
          type,
        );
      }
      await page
        .getByRole("button", {
          name: "Фото 2: перемістити ліворуч",
          exact: true,
        })
        .click();
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      assert.equal(prepared.media.filter((m) => m.type === "IMAGE").length, 2);
      await page.reload();
      await page.locator("#workspace-LOGO").waitFor();
      await page.locator("#workspace-contact-phone").fill("+380501234567");
      const savedContacts = page.waitForResponse(
        (r) =>
          r.url().includes("/contacts") && r.request().method() === "PATCH",
      );
      await page
        .getByRole("button", { name: "Зберегти контакти", exact: true })
        .click();
      await savedContacts;
      await page.waitForFunction(
        () =>
          document.querySelector("#workspace-contact-phone")?.value ===
          "+380501234567",
      );
      await page.reload();
      await page.locator("#workspace-contact-phone").waitFor();
      assert.equal(prepared.publicContacts.phone, "+380501234567");
      await check();
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
          .fill("Синтетичний опис для браузерної перевірки");
        await editor.getByLabel("Ціна, грн", { exact: true }).fill("100");
        await editor
          .getByRole("combobox", { name: "Вид тварини", exact: true })
          .click();
        await page.getByRole("option", { name: "Кіт", exact: true }).click();
        await editor
          .getByPlaceholder("Введіть назву міста або села")
          .fill("Ки");
        await page.getByRole("option", { name: /Київ/ }).click();
        await editor
          .getByLabel("Додати фото", { exact: true })
          .setInputFiles([file, { ...file, name: "synthetic-2.png" }]);
        await editor
          .getByRole("button", { name: "Зробити головним", exact: true })
          .click();
        await editor
          .getByRole("button", { name: /Створити|Зберегти/, exact: false })
          .last()
          .click();
        await editor.waitFor({ state: "hidden" });
        assert.equal(drafts.length, i + 1);
      }
      await check();
      await page.getByLabel("Пошта власника").fill(owner.email);
      await page
        .getByRole("button", { name: "Надіслати запрошення", exact: true })
        .click();
      await page.getByText("Очікує прийняття", { exact: true }).waitFor();
      await switchUser(owner);
      await page.goto(base + "/claim-breeder?token=" + "s".repeat(43));
      await page
        .getByRole("button", { name: "Переглянути підготовлений профіль" })
        .click();
      await page
        .getByRole("button", { name: "Підтвердити отримання профілю" })
        .click();
      await page.waitForURL("**/profile/breeder");
      await page
        .getByRole("heading", { name: "Отриманий профіль приватний" })
        .first()
        .waitFor();
      assert.equal(prepared.media.length, 4);
      await switchUser(admin);
      await page.goto(
        `${base}/admin/breeders/${prepared.id}?source=OPERATOR_PREPARED`,
      );
      await page
        .getByRole("heading", { name: "Оголошення", exact: true })
        .waitFor();
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
      await switchUser(owner);
      await page.goto(base + "/profile/breeder");
      await page
        .getByRole("button", { name: "Повторити", exact: true })
        .click();
      const acceptanceBox = page.getByLabel(/Дані цих тварин перевірено/);
      await acceptanceBox.focus();
      await acceptanceBox.press("Space");
      await page
        .getByRole("button", {
          name: "Прийняти вибрані оголошення",
          exact: true,
        })
        .click();

      await page.getByText(/Не вдалося прийняти/).waitFor();
      await page
        .getByRole("button", {
          name: "Прийняти вибрані оголошення",
          exact: true,
        })
        .click();
      await page
        .getByText("Нових пропозицій немає.", { exact: true })
        .waitFor();
      assert.equal(accepted, 1);
      await check();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/owner-${width}.png`,
        fullPage: true,
      });
      await switchUser(admin);
      await page.goto(
        `${base}/admin/breeders/${prepared.id}?source=OPERATOR_PREPARED`,
      );
      await page
        .getByRole("heading", { name: "Оголошення", exact: true })
        .waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/admin-${width}.png`,
        fullPage: true,
      });
      await check();
      active = null;
      await page.evaluate(() => {
        const c = new BroadcastChannel("pet-platform-session");
        c.postMessage({ kind: "logout", source: "synthetic-other-tab" });
        c.close();
      });
      await page
        .getByRole("heading", { name: "Оголошення", exact: true })
        .waitFor({ state: "hidden" });
      await check();
      results.push({
        width,
        createBreeder: true,
        logoCoverGallery: true,
        threeListings: true,
        listingPhotosReorder: true,
        claim: true,
        selectedHandoff: true,
        explicitOwnerAcceptance: true,
        retryAfterTemporaryFailure: true,
        logoutIsolation: true,
        noOverflow: true,
        noHydrationErrors: true,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(
    `${out}/browser-results.json`,
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(results));
