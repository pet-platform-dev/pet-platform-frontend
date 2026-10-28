import { BreederPackageService } from "../../pet-platform-backend/dist/src/admin/invitations/breeder-package.service.js";
import { WorkspaceVideosService } from "../../pet-platform-backend/dist/src/admin/management/workspace-videos.service.js";
import { BreederVideoService } from "../../pet-platform-backend/dist/src/breeders/media/breeder-video.service.js";
import { AdminBreedersWriteService } from "../../pet-platform-backend/dist/src/admin/management/breeders-write.service.js";
import { BreederClaimService } from "../../pet-platform-backend/dist/src/admin/invitations/claim.service.js";
import { invitationDigest } from "../../pet-platform-backend/dist/src/admin/invitations/invitation.policy.js";
// Real Chrome + real local PostgreSQL domain services; synthetic accounts and provider only.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(resolve("../pet-platform-backend/package.json"));
require("dotenv").config({
  path: resolve("../pet-platform-backend/.env"),
  quiet: true,
});
assert.equal(process.env.BREEDER_CORRECTION_DB_TEST, "1");
const dbUrl = new URL(process.env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname) &&
    dbUrl.pathname === "/pet_platform",
);
const { PrismaService } =
  await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const { BreederProfileService } =
  await import("../../pet-platform-backend/dist/src/breeders/breeder-profile.service.js");
const { BreederMediaUploadService } =
  await import("../../pet-platform-backend/dist/src/breeders/media/breeder-media-upload.service.js");
const { BreederMediaDeleteService } =
  await import("../../pet-platform-backend/dist/src/breeders/media/breeder-media-delete.service.js");
const { WorkspaceMediaService } =
  await import("../../pet-platform-backend/dist/src/admin/management/workspace-media.service.js");
const { AdminBreedersReadService } =
  await import("../../pet-platform-backend/dist/src/admin/management/breeders-read.service.js");
const { BreederAnimalsService } =
  await import("../../pet-platform-backend/dist/src/breeders/animals/breeder-animals.service.js");
const { BreederAnimalVisibilityService } =
  await import("../../pet-platform-backend/dist/src/breeders/animals/breeder-animal-visibility.service.js");
const { PetsService } =
  await import("../../pet-platform-backend/dist/src/pets/pets.service.js");
const { createPetSchema } =
  await import("../../pet-platform-backend/dist/src/pets/dto/create-pet.dto.js");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  base = process.env.BREEDER_WORKSPACE_UI_URL ?? "http://localhost:3019";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  results = [],
  ids = [];
const out = "test-results/phase18d2-url";
await mkdir(out, { recursive: true });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const image = { buffer: png, size: png.length, mimetype: "image/png" },
  imageFile = { name: "synthetic.png", mimeType: "image/png", buffer: png };
const cleanup = { cleanup: async () => ({}), run: async () => ({}) };
const cloud = {
  configuration: () => ({}),
  upload: async (_f, k) =>
    `https://res.cloudinary.com/synthetic/image/upload/v1/${k}.png`,
};
const profiles = new BreederProfileService(db, cleanup),
  uploads = new BreederMediaUploadService(db, cloud, cleanup, profiles),
  deletion = new BreederMediaDeleteService(db, cleanup, profiles);
const pets = new PetsService(db, {}, { get: async () => new Map() }, {}),
  animals = new BreederAnimalsService(db, { get: async () => new Map() }),
  visibility = new BreederAnimalVisibilityService(db),
  adminReads = new AdminBreedersReadService(db);
async function user(role) {
  const id = randomUUID();
  ids.push(id);
  return db.user.create({
    data: {
      id,
      email: `phase18d2-${id}@example.invalid`,
      firstName: "Синтетичний",
      lastName: "Тест",
      passwordHash: "not-a-login",
      role,
      accountType: "BREEDER",
      verificationStatus: "VERIFIED",
    },
  });
}
let lastPage, lastErrors;
try {
  for (const width of [375, 768, 1440]) {
    const owner = await user("USER"),
      admin = await user("ADMIN");
    let active = admin;
    const profile = await db.breederProfile.create({
      data: {
        userId: owner.id,
        kennelName: `Синтетичний розплідник ${width}`,
        description: "Перевірка відео і незалежних тварин",
      },
    });
    await uploads.upload(owner.id, "IMAGE", image);
    const originalGallery = await db.breederMedia.findMany({
      where: { breederProfileId: profile.id, type: "IMAGE" },
    });
    const workspace = new WorkspaceMediaService(
      db,
      { authenticate: async () => ({ id: admin.id }) },
      cloud,
      cleanup,
    );
    const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    lastPage = page;
    page.setDefaultTimeout(20000);
    const deadline = setTimeout(() => void context.close(), 150000);
    deadline.unref();
    const errors = [],
      writes = [];
    lastErrors = errors;

    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|did not match|same key|two children|same key/i.test(
          message.text(),
        )
      )
        errors.push(message.text());
    });
    await context.route("https://res.cloudinary.com/**", (r) =>
      r.fulfill({ contentType: "image/png", body: png }),
    );
    await context.route(
      (url) =>
        ["www.youtube-nocookie.com", "player.vimeo.com"].includes(url.hostname),
      (r) =>
        r.fulfill({
          contentType: "text/html",
          body: "<title>Synthetic video provider</title>",
        }),
    );
    const videoLinks = new WorkspaceVideosService(db, workspace),
      ownerVideos = new BreederVideoService(db, profiles),
      draftWrites = new AdminBreedersWriteService(db, {
        authenticate: async () => admin,
      }),
      claims = new BreederClaimService(
        db,
        {
          authenticate: async () => active,
        },
        new BreederPackageService(db, {}, { authenticate: async () => active }),
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
      if (method !== "GET") writes.push(path);
      try {
        if (path === "/auth/csrf")
          return reply({ csrfToken: "synthetic-csrf" });
        if (path === "/auth/refresh")
          return reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          });
        if (path === "/auth/me") return reply(active);
        if (path === "/species")
          return reply(
            await db.species.findMany({
              where: { slug: { in: ["dog", "cat"] } },
              select: { id: true, name: true, slug: true },
            }),
          );
        if (path === "/breeds")
          return reply(
            { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } },
            200,
            true,
          );
        if (
          path === "/breeder-handoffs" ||
          path.startsWith("/breeder-handoffs/prepared/")
        )
          return reply(
            { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } },
            200,
            true,
          );
        const managed = /^\/admin\/breeders\/([^/]+)$/.exec(path);
        if (managed)
          return reply(
            (
              await adminReads.detail(
                managed[1],
                url.searchParams.get("source") ?? "OWNER_MANAGED",
              )
            ).data,
          );
        const videoPath =
          /^\/admin\/breeders\/([^/]+)\/videos(?:\/([^/]+))?$/.exec(path);
        if (videoPath) {
          assert.match(req.headers()["content-type"], /application\/json/);
          const body = req.postDataJSON();
          return reply(
            (
              await videoLinks.save(
                admin.id,
                "synthetic",
                videoPath[1],
                body.source,
                new Date(body.expectedUpdatedAt),
                videoPath[2] === "order"
                  ? { ids: body.ids }
                  : { url: body.url, videoId: videoPath[2] },
              )
            ).data,
            method === "POST" ? 201 : 200,
          );
        }
        const removePath = /^\/admin\/breeders\/([^/]+)\/media\/([^/]+)$/.exec(
          path,
        );
        if (removePath && method === "DELETE") {
          const body = req.postDataJSON();
          return reply(
            (
              await workspace.change(
                admin.id,
                "synthetic",
                removePath[1],
                body.source,
                new Date(body.expectedUpdatedAt),
                removePath[2],
              )
            ).data,
          );
        }
        if (path.endsWith("/handoffs")) return reply([]);
        if (path === `/admin/breeders/${profile.id}/handoffs`) return reply([]);
        if (path === "/admin/listings")
          return reply(
            { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } },
            200,
            true,
          );
        if (
          path === `/admin/breeders/${profile.id}/media` &&
          method === "POST"
        ) {
          const body = req.postDataBuffer().toString("latin1"),
            type = /name="type"\r\n\r\n(LOGO|COVER|IMAGE)/.exec(body)?.[1];
          assert(type);
          const p = await db.breederProfile.findUniqueOrThrow({
            where: { id: profile.id },
          });
          return reply(
            (
              await workspace.upload(
                admin.id,
                "synthetic",
                profile.id,
                "OWNER_MANAGED",
                p.updatedAt,
                type,
                image,
              )
            ).data,
            201,
          );
        }
        if (
          path.startsWith(`/admin/breeders/${profile.id}/media/`) &&
          method === "DELETE"
        ) {
          const p = await db.breederProfile.findUniqueOrThrow({
            where: { id: profile.id },
          });
          return reply(
            (
              await workspace.change(
                admin.id,
                "synthetic",
                profile.id,
                "OWNER_MANAGED",
                p.updatedAt,
                path.split("/").at(-1),
              )
            ).data,
          );
        }
        if (path === "/breeders/me") {
          if (method === "POST")
            return reply(
              (await profiles.create(active.id, req.postDataJSON())).data,
              201,
            );
          try {
            return reply((await profiles.own(active.id)).data);
          } catch (e) {
            if (e.getStatus?.() === 404) return reply(null, 404);
            throw e;
          }
        }
        if (path === "/breeders/me/media/videos" && method === "POST")
          return reply(
            (await ownerVideos.add(active.id, req.postDataJSON().url)).data,
            201,
          );
        if (
          /^\/breeders\/me\/media\/videos\/[^/]+$/.test(path) &&
          method === "PATCH"
        )
          return reply(
            (
              await ownerVideos.add(
                active.id,
                req.postDataJSON().url,
                path.split("/").at(-1),
              )
            ).data,
          );
        if (path.startsWith("/breeder-claims/packages/") && method === "GET")
          return reply({
            breeder: {
              id: path.split("/").at(-1),
              kennelName: "Синтетичний профіль",
            },
            revision: "a".repeat(64),
            count: 0,
            canAccept: true,
            blockers: [],
            listings: [],
          });
        if (path === "/breeder-claims/preview")
          return reply(
            (
              await claims.inspect(
                active.id,
                "synthetic",
                req.postDataJSON().token,
              )
            ).data,
          );
        if (path === "/breeder-claims/accept") {
          const body = req.postDataJSON();
          return reply(
            (
              await claims.accept(
                active.id,
                "synthetic",
                body.token,
                new Date(body.expectedUpdatedAt),
                body.packageRevision,
              )
            ).data,
          );
        }
        if (path.startsWith("/breeders/me/media/images/") && method === "POST")
          return reply(
            (await uploads.upload(owner.id, path.split("/").at(-1), image))
              .data,
            201,
          );
        if (path.startsWith("/breeders/me/media/") && method === "DELETE")
          return reply(
            (await deletion.remove(active.id, path.split("/").at(-1))).data,
          );
        if (path === "/breeders/me/animals")
          return reply(
            await animals.list(owner.id, { page: 1, limit: 24 }, true),
            200,
            true,
          );
        if (path === `/breeders/${owner.id}/animals`)
          return reply(
            await animals.list(owner.id, { page: 1, limit: 24 }),
            200,
            true,
          );
        if (path === "/pets" && method === "POST")
          return reply(
            (
              await pets.create(
                owner.id,
                createPetSchema.parse(req.postDataJSON()),
              )
            ).data,
            201,
          );
        if (/^\/pets\/[^/]+\/breeder-visibility$/.test(path))
          return reply(
            (
              await visibility.set(
                owner.id,
                path.split("/")[2],
                req.postDataJSON().showOnBreederProfile,
              )
            ).data,
          );
        if (/^\/pets\/[^/]+$/.test(path))
          if (method === "PATCH")
            return reply(
              (
                await pets.update(
                  owner.id,
                  path.split("/")[2],
                  createPetSchema.parse(req.postDataJSON()),
                )
              ).data,
            );
        if (/^\/pets\/[^/]+$/.test(path))
          return reply((await pets.get(owner.id, path.split("/")[2])).data);
        if (path === `/sellers/${owner.id}`)
          return reply({
            id: owner.id,
            displayName: profile.kennelName,
            phone: null,
            telegram: null,
            viber: null,
            whatsapp: null,
            location: null,
            memberSince: owner.createdAt.toISOString(),
            breeder: { kennelName: profile.kennelName },
          });
        if (path === `/breeders/${owner.id}`)
          return reply((await profiles.public(owner.id)).data);
        if (method === "GET")
          return reply(
            { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } },
            200,
            true,
          );
        throw Error("Unexpected mutation " + path);
      } catch (error) {
        errors.push(`${path}: ${error.message}`);
        return reply(null, 500);
      }
    });
    const go = async (path) => {
      console.log("CHECK", width, new URL(path, base).pathname);
      await page.goto(base + path);
      await page.waitForTimeout(250);
    };
    const noOverflow = async () =>
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    await go(`/admin/breeders/${profile.id}?source=OWNER_MANAGED`);
    assert.equal(
      await page
        .getByRole("link", {
          name: "Переглянути публічний профіль",
          exact: true,
        })
        .getAttribute("href"),
      `/sellers/${owner.id}`,
    );
    async function settleVideos() {
      await page.waitForFunction(() => {
        const e = document.querySelector("#breeder-video-url");
        return e && !e.disabled;
      });
    }
    async function addLink(url) {
      await page.getByLabel("Посилання на відео", { exact: true }).fill(url);
      await page
        .getByRole("button", { name: "Додати відео", exact: true })
        .click();
      await page
        .getByText("Зберігаємо відео…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      await page.getByLabel("Посилання на відео", { exact: true }).waitFor();
      await settleVideos();
    }
    await addLink("https://youtu.be/dQw4w9WgXcQ");
    await page.reload();
    await page
      .getByRole("button", { name: "Редагувати відео 1", exact: true })
      .click();
    await page
      .getByLabel("Посилання на відео", { exact: true })
      .fill("https://vimeo.com/123456789");
    await page
      .getByRole("button", { name: "Зберегти посилання", exact: true })
      .click();
    await page
      .getByText("Зберігаємо відео…", { exact: true })
      .waitFor({ state: "hidden" });
    await page.waitForTimeout(150);
    await addLink("https://youtu.be/dQw4w9WgXcQ");
    await page
      .getByRole("button", { name: "Перемістити відео 2 раніше", exact: true })
      .click();
    await page
      .getByText("Зберігаємо відео…", { exact: true })
      .waitFor({ state: "hidden" });
    await page.waitForTimeout(150);
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole("button", { name: "Видалити відео 1", exact: true })
        .click();
      await page
        .getByText("Зберігаємо відео…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
    }
    await page
      .getByLabel("Посилання на відео", { exact: true })
      .fill("javascript:alert(1)");
    await page
      .getByRole("button", { name: "Додати відео", exact: true })
      .click();
    await page
      .locator("#breeder-video-error")
      .getByText(/YouTube або Vimeo/)
      .waitFor();
    for (const type of ["LOGO", "COVER"]) {
      const input = page.locator(`#workspace-${type}`);
      await input.setInputFiles(imageFile);
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      await page.locator(`#workspace-${type}`).waitFor();
      const first = await db.breederMedia.findFirstOrThrow({
        where: { breederProfileId: profile.id, type },
      });
      await page.locator(`#workspace-${type}`).setInputFiles(imageFile);
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      const next = await db.breederMedia.findFirstOrThrow({
        where: { breederProfileId: profile.id, type },
      });
      assert.notEqual(next.id, first.id);
      const section = page
        .locator(".breeder-workspace-media section")
        .filter({ has: page.locator(`#workspace-${type}`) });
      await section
        .getByRole("button", { name: "Видалити", exact: true })
        .click();
      await page
        .getByText("Зберігаємо фото…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      assert.equal(
        await db.breederMedia.count({
          where: { breederProfileId: profile.id, type },
        }),
        0,
      );
    }
    await noOverflow();
    active = owner;
    await context.clearCookies();
    await go("/profile/breeder");
    for (const [kind, type] of [
      ["logo", "LOGO"],
      ["cover", "COVER"],
    ]) {
      for (let i = 0; i < 2; i++) {
        await page.locator(`#breeder-${kind}-upload`).setInputFiles(imageFile);
        await page.waitForFunction(
          () => !document.querySelector(".breeder-upload-list li"),
        );
        await page.waitForTimeout(250);
      }
      await page
        .getByRole("button", {
          name: kind === "logo" ? "Видалити логотип" : "Видалити обкладинку",
          exact: true,
        })
        .click();
      await page.waitForTimeout(250);
      assert.equal(
        await db.breederMedia.count({
          where: { breederProfileId: profile.id, type },
        }),
        0,
      );
    }
    const field = page.getByLabel("Посилання на відео", { exact: true });
    await field.fill("https://youtu.be/dQw4w9WgXcQ");
    await page
      .getByRole("button", { name: "Переглянути відео", exact: true })
      .click();
    assert.equal(
      await db.breederMedia.count({
        where: { breederProfileId: profile.id, type: "VIDEO" },
      }),
      0,
    );
    await page.getByRole("button", { name: /^Завантажити відео:/ }).click();
    await page.locator("iframe").waitFor();
    await page
      .getByRole("button", { name: "Додати відео", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Редагувати відео 1", exact: true })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Редагувати відео 1", exact: true })
      .waitFor();
    await go("/profile/breeder/animals");
    await page
      .getByRole("link", { name: "Додати тварину", exact: true })
      .click();
    await page
      .getByLabel("Ім’я (необов’язково)", { exact: true })
      .fill("Окрема тварина");
    await page
      .getByRole("combobox", { name: "Вид тварини", exact: true })
      .click();
    await page.getByRole("option", { name: "Кіт", exact: true }).click();
    await page
      .getByRole("button", { name: "Додати тварину", exact: true })
      .click();
    await page.waitForURL("**/profile/breeder/animals");
    const card = page.locator(".breeder-animal-card");
    await card.waitFor();
    assert.equal(await db.listing.count({ where: { sellerId: owner.id } }), 0);
    await card
      .getByRole("link", { name: "Редагувати тварину", exact: true })
      .click();
    await page
      .getByLabel("Ім’я (необов’язково)", { exact: true })
      .fill("Окрема тварина — оновлено");
    await page
      .getByRole("button", { name: "Зберегти зміни", exact: true })
      .click();
    await page.waitForURL("**/profile/breeder/animals");
    await page
      .getByText("Окрема тварина — оновлено", { exact: true })
      .waitFor();
    assert.equal(await db.listing.count({ where: { sellerId: owner.id } }), 0);
    await card.getByRole("checkbox").focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
    assert.equal(await card.getByRole("checkbox").isChecked(), true);
    const species = await db.species.findFirstOrThrow({
      where: { slug: "cat" },
    });
    await pets.create(
      owner.id,
      createPetSchema.parse({
        speciesId: species.id,
        name: "Приватна тварина",
      }),
    );
    await go(`/sellers/${owner.id}`);
    await page.getByRole("button", { name: /^Завантажити відео:/ }).click();
    await page.locator("iframe").waitFor();
    assert.match(
      await page.locator("iframe").getAttribute("src"),
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
    );
    assert.equal(
      (await page.locator("main").innerText()).includes("Приватна тварина"),
      false,
    );
    await noOverflow();
    await page.screenshot({
      path: `${out}/public-${width}.png`,
      fullPage: true,
    });
    await go("/profile/breeder");
    await page
      .getByRole("button", { name: "Видалити відео 1", exact: true })
      .click();
    await page.waitForTimeout(250);
    assert.equal(
      await db.breederMedia.count({
        where: { breederProfileId: profile.id, type: "VIDEO" },
      }),
      0,
    );
    assert.deepEqual(
      await db.breederMedia.findMany({
        where: { breederProfileId: profile.id, type: "IMAGE" },
      }),
      originalGallery,
    );
    assert.equal(
      writes.some((p) => p === "/listings" || p.startsWith("/media/")),
      false,
    );
    assert.deepEqual(errors, []);

    const prepared = (
      await draftWrites.create(
        admin.id,
        {
          kennelName: "Приватний підготовлений розплідник",
        },
        "synthetic-access",
      )
    ).data;
    active = admin;
    await context.clearCookies();
    await go(`/admin/breeders/${prepared.id}?source=OPERATOR_PREPARED`);
    await addLink("https://vimeo.com/123456789");
    const recipient = await user("USER"),
      current = await db.operatorBreederDraft.findUniqueOrThrow({
        where: { id: prepared.id },
      }),
      raw = randomBytes(32).toString("base64url");
    await db.breederInvitation.create({
      data: {
        draftId: prepared.id,
        recipientEmail: recipient.email,
        invitedById: admin.id,
        tokenHash: invitationDigest(raw),
        draftRevision: current.updatedAt,
        deliveryState: "CAPTURED",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    active = recipient;
    await context.clearCookies();
    await go("/claim-breeder?token=" + raw);
    await page
      .getByRole("button", {
        name: "Переглянути підготовлений профіль",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "Прийняти розплідник та оголошення",
        exact: true,
      })
      .click();
    await page.waitForURL("**/my-listings");
    await go("/profile/breeder");
    await page
      .getByRole("button", { name: "Редагувати відео 1", exact: true })
      .waitFor();
    assert.equal(
      (
        await db.breederProfile.findUniqueOrThrow({
          where: { userId: recipient.id },
        })
      ).publicationHeld,
      true,
    );
    await assert.rejects(() => profiles.public(recipient.id));
    const ordinary = await user("USER");
    active = ordinary;
    await context.clearCookies();
    await go("/profile/breeder");
    await page
      .getByLabel(/Назва розплідника/)
      .fill("Звичайне створення розплідника");
    await page
      .getByRole("button", { name: "Зберегти зміни", exact: true })
      .click();
    await page.waitForURL(`**/sellers/${ordinary.id}`);
    await go("/profile/breeder");
    await page.getByLabel("Посилання на відео", { exact: true }).waitFor();
    await addLink("https://vimeo.com/123456789");
    assert.equal((await profiles.own(ordinary.id)).data.media.videos.length, 1);
    await noOverflow();
    results.push({
      width,
      adminLogoCover: true,
      ownerLogoCover: true,
      galleryUnchanged: true,
      videoUrlAddPreviewEditRemove: true,
      independentAnimal: true,
      independentAnimalEdit: true,
      privateAnimalHidden: true,
      keyboard: true,
      operatorDraftClaim: true,
      normalBreederCreation: true,
      publicUrlPlayer: true,
      noOverflow: true,
    });
    clearTimeout(deadline);
    await context.close();
  }
  await writeFile(
    `${out}/browser-results.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} catch (error) {
  console.error("BROWSER_FAILURE", error.message, lastErrors);
  if (lastPage && !lastPage.isClosed())
    await lastPage
      .screenshot({ path: out + "/failure.png", fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
  const draftIds = (
    await db.operatorBreederDraft.findMany({
      where: { preparedById: { in: ids } },
      select: { id: true },
    })
  ).map((r) => r.id);
  await db.adminBreederAudit.deleteMany({ where: { actorId: { in: ids } } });
  await db.breederMedia.deleteMany({
    where: {
      OR: [
        { breederProfile: { userId: { in: ids } } },
        { operatorDraftId: { in: draftIds } },
      ],
    },
  });
  await db.breederMediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
  await db.pet.deleteMany({ where: { ownerId: { in: ids } } });
  await db.breederInvitation.deleteMany({
    where: { draftId: { in: draftIds } },
  });
  await db.operatorBreederDraft.deleteMany({ where: { id: { in: draftIds } } });
  await db.breederProfile.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
}
