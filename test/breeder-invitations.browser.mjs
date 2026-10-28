import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { load } from "./helpers/load-frontend.mjs";
import { runClaimLifecycle } from "./helpers/claim-lifecycle-browser.mjs";
const { legalContentIdentity } = await load(
  "src/features/legal/content/content-integrity.ts",
);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.BREEDER_INVITATIONS_UI_URL ?? "http://localhost:3019";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
let serverReady = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    serverReady = (
      await fetch(base + "/claim-breeder", {
        signal: AbortSignal.timeout(2000),
      })
    ).ok;
  } catch {
    /* local server may still be starting */
  }
  if (serverReady) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert(
  serverReady,
  "The local production frontend must respond before browser validation",
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = "test-results/phase18d";
await mkdir(output, { recursive: true });
const capture = await readFile(
  "../pet-platform-backend/.tmp/phase18d-browser-capture.json",
  "utf8",
)
  .then(JSON.parse)
  .catch(() => null);
if (capture)
  assert(
    capture.synthetic === true &&
      /^phase18d-[\w-]+@example\.invalid$/.test(capture.recipient) &&
      new URL(capture.claimUrl).pathname === "/claim-breeder",
  );
const at = "2026-10-24T00:00:00.000Z",
  token = capture
    ? new URL(capture.claimUrl).searchParams.get("token")
    : "s".repeat(43),
  id = "11111111-1111-4111-8111-111111111111",
  draftId = "22222222-2222-4222-8222-222222222222",
  invitationId = "33333333-3333-4333-8333-333333333333";
const owner = {
  id,
  email: capture?.recipient ?? "synthetic-owner@example.invalid",
  firstName: "Олена",
  lastName: "Тестова",
  avatarUrl: null,
  role: "USER",
  accountType: "BREEDER",
  verificationStatus: "VERIFIED",
  createdAt: at,
};
const prepared = {
  id: draftId,
  kennelName: "Теплий дім — синтетичний розплідник",
  description: "Підготовлений профіль для перевірки справжнім власником.",
  website: null,
  startedYear: null,
  locationId: null,
  location: null,
  breeds: [],
  createdAt: at,
  updatedAt: at,
  source: "OPERATOR_PREPARED",
  visibility: "PRIVATE",
  preparedById: id,
  publicPath: null,
  operatorNotes: "Private operator note",
  audit: [],
};
const emptyInvitations = {
  claimedProfileId: null,
  claimedAt: null,
  claimedOwnerId: null,
  invitations: [],
};
async function fixture(width, initial = owner, held = false) {
  const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  let active = initial,
    mode = "ok",
    invites = structuredClone(emptyInvitations),
    accepts = 0,
    previews = 0,
    publicationHeld = true,
    sendCount = 0,
    resends = 0,
    registrations = 0,
    refreshes = 0;
  const requests = [],
    errors = [];
  let release;
  const restore = new Promise((resolve) => {
    release = resolve;
  });
  if (!held) release();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      /hydration|did not match|same key/i.test(m.text())
    )
      errors.push(m.text());
  });
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = req.method();
    const headers = {
      "Access-Control-Allow-Origin": new URL(base).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization,x-csrf-token",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Cache-Control": "no-store",
    };
    const reply = (data, status = 200, envelope = false) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(envelope ? data : { data }),
      });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    requests.push({ path, method });
    if (path === "/auth/csrf") return reply({ csrfToken: "synthetic-csrf" });
    if (path === "/auth/refresh") {
      refreshes++;
      await restore;
      return active
        ? reply({
            user: active,
            accessToken: "synthetic-access",
            expiresIn: 900,
          })
        : reply(null, 401);
    }
    if (path === "/auth/me") return active ? reply(active) : reply(null, 401);
    if (path === "/auth/logout") {
      active = null;
      return reply(null, 204);
    }
    if (path === "/auth/login" || path === "/auth/register") {
      const input = req.postDataJSON();
      assert.equal(input.email, owner.email);
      active = {
        ...owner,
        ...(path.endsWith("register")
          ? { verificationStatus: "UNVERIFIED" }
          : {}),
      };
      if (path.endsWith("register")) {
        registrations++;
        if (legalContentIdentity.terms.status === "PUBLISHED")
          assert(input.legalAcceptance?.accepted === true);
        else assert(!input.legalAcceptance);
        assert.equal(input.accountType, "BREEDER");
      }
      return reply({
        user: active,
        accessToken: "synthetic-access",
        expiresIn: 900,
      });
    }
    if (path === "/legal/current")
      return reply({
        acceptanceRequired: legalContentIdentity.terms.status === "PUBLISHED",
        terms: {
          ...legalContentIdentity.terms,
          effectiveAt:
            legalContentIdentity.terms.status === "PUBLISHED" ? at : null,
        },
        privacy: {
          ...legalContentIdentity.privacy,
          effectiveAt:
            legalContentIdentity.privacy.status === "PUBLISHED" ? at : null,
        },
      });
    if (path === "/auth/email-verification/resend")
      return reply({ status: "accepted" });
    if (path === `/admin/breeders/${draftId}`)
      return active?.role === "ADMIN" || active?.role === "SUPER_ADMIN"
        ? reply({
            ...prepared,
            claimedProfileId: invites.claimedProfileId,
            claimedAt: invites.claimedAt,
          })
        : reply(null, 403);
    if (path === `/admin/breeders/${draftId}/invitations`) {
      if (!["ADMIN", "SUPER_ADMIN"].includes(active?.role))
        return reply(null, 403);
      if (method === "GET") return reply(invites);
      const body = req.postDataJSON();
      assert.equal(body.expectedUpdatedAt, at);
      assert.equal(body.email, owner.email);
      assert(!("token" in body));
      if (body.resend) {
        resends++;
        if (mode === "cooldown")
          return reply({ message: "Повторіть надсилання пізніше." }, 429, true);
      }
      sendCount++;
      invites = {
        ...emptyInvitations,
        invitations: [
          {
            id: invitationId,
            recipientEmail: body.email,
            status: "PENDING",
            deliveryState: "CAPTURED",
            createdAt: at,
            expiresAt: "2026-11-01T00:00:00Z",
            terminalAt: null,
            acceptedById: null,
          },
        ],
      };
      return reply(invites);
    }
    if (path.endsWith("/revoke") && path.includes("/invitations/")) {
      invites.invitations[0].status = "REVOKED";
      return reply(invites);
    }
    if (path.startsWith("/breeder-claims/packages/"))
      return reply({
        breeder: { id: draftId, kennelName: prepared.kennelName },
        revision: "a".repeat(64),
        count: 0,
        canAccept: true,
        blockers: [],
        listings: [],
      });
    if (path.startsWith("/breeder-claims/")) {
      assert.equal(req.headers().authorization, "Bearer synthetic-access");
      const body = req.postDataJSON();
      assert.equal(body.token, token);
      assert.equal(req.headers()["x-csrf-token"], "synthetic-csrf");
      if (!active) return reply(null, 401);
      if (active.email !== owner.email)
        return reply(
          {
            message:
              "Увійдіть до акаунта з адресою, на яку надійшло запрошення.",
          },
          403,
          true,
        );
      if (mode === "invalid" || (accepts > 0 && mode !== "temporary"))
        return reply(
          {
            message:
              "Запрошення недійсне або строк його дії минув. Зверніться до оператора.",
          },
          400,
          true,
        );
      if (path.endsWith("/preview")) {
        previews++;
        return reply({
          kennelName: prepared.kennelName,
          description: prepared.description,
          website: null,
          startedYear: null,
          expiresAt: "2026-11-01T00:00:00Z",
          draftRevision: at,
          location: null,
          package: {
            revision: "a".repeat(64),
            count: 0,
            canAccept: true,
            blockers: [],
            listings: [],
          },
        });
      }
      assert.equal(body.acceptOwnership, true);
      assert.equal(body.expectedUpdatedAt, at);
      accepts++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (mode === "temporary" && accepts === 1) return reply(null, 503);
      if (mode === "conflict")
        return reply(
          {
            message:
              "Ви вже маєте профіль розплідника. Зверніться до оператора.",
          },
          409,
          true,
        );
      return reply({
        profileId: draftId,
        ownerId: id,
        redirectTo: "/my-listings",
      });
    }
    if (path === "/breeders/me/publish") {
      publicationHeld = false;
    }
    if (path === "/breeders/me" || path === "/breeders/me/publish")
      return reply({
        id: draftId,
        userId: id,
        kennelName: prepared.kennelName,
        description: prepared.description,
        location: null,
        locationId: null,
        startedYear: null,
        website: null,
        breeds: [],
        breedIds: [],
        createdAt: at,
        updatedAt: at,
        publicationHeld,
        media: { logo: null, cover: null, gallery: [], videos: [] },
        contactPerson: {
          id,
          displayName: "Олена Тестова",
          phone: null,
          telegram: null,
          viber: null,
          whatsapp: null,
          location: null,
          memberSince: at,
        },
      });
    if (
      path === "/breeds" ||
      path === "/locations" ||
      path.endsWith("/animals")
    )
      return reply(
        { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
        200,
        true,
      );
    if (path.endsWith("/unread") || path.endsWith("/unread-count"))
      return reply({ count: 0 });
    if (path === "/conversations")
      return reply(
        { data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } },
        200,
        true,
      );
    return reply({}, 404);
  });
  return {
    context,
    page,
    release,
    requests,
    errors,
    get stats() {
      return {
        accepts,
        previews,
        sendCount,
        resends,
        registrations,
        refreshes,
        publicationHeld,
      };
    },
    setMode: (v) => {
      mode = v;
    },
    setActive: (v) => {
      active = v;
    },
    async notify(kind = "login") {
      await page.evaluate((kind) => {
        const channel = new BroadcastChannel("pet-platform-session");
        channel.postMessage({ kind, source: "synthetic-browser-other-tab" });
        channel.close();
      }, kind);
    },
    async check() {
      assert.deepEqual(errors, []);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert(
        !(
          await page.evaluate(() =>
            JSON.stringify({ ...localStorage, ...sessionStorage }),
          )
        ).includes(token),
      );
    },
  };
}
const results = [];
try {
  for (const width of [375, 768, 1440]) {
    const f = await fixture(width, {
      ...owner,
      role: "ADMIN",
      accountType: "SELLER",
    });
    try {
      await f.page.goto(
        `${base}/admin/breeders/${draftId}?source=OPERATOR_PREPARED`,
      );
      await f.page
        .getByRole("heading", { name: "Запросити власника" })
        .waitFor();
      await f.page.getByLabel("Пошта власника").fill(owner.email);
      await f.page
        .getByRole("button", { name: "Надіслати запрошення", exact: true })
        .click();
      await f.page.getByText("Очікує прийняття", { exact: true }).waitFor();
      assert.equal(f.stats.sendCount, 1);
      f.setMode("cooldown");
      await f.page.getByRole("button", { name: "Надіслати повторно" }).click();
      await f.page
        .getByText("Повторіть надсилання пізніше.", { exact: true })
        .waitFor();
      f.setMode("ok");
      await f.page.getByRole("button", { name: "Надіслати повторно" }).click();
      assert.equal(f.stats.resends, 2);
      await f.page
        .getByRole("button", { name: "Відкликати запрошення" })
        .click();
      await f.page.getByText("Відкликано", { exact: true }).waitFor();
      await f.check();
      await f.page.screenshot({
        path: `${output}/admin-${width}.png`,
        fullPage: true,
      });
    } finally {
      await f.context.close();
    }
    const c = await fixture(width, owner, true);
    try {
      const response = await c.page.goto(
        `${base}/claim-breeder?token=${token}`,
      );
      assert.equal(response.headers()["referrer-policy"], "no-referrer");
      await c.page.waitForURL(`${base}/claim-breeder`);
      assert.equal(c.stats.previews, 0);
      assert.equal(c.stats.accepts, 0);
      c.release();
      const inspect = c.page.getByRole("button", {
        name: "Переглянути підготовлений профіль",
      });
      await inspect.waitFor();
      await inspect.focus();
      await c.page.keyboard.press("Enter");
      await c.page
        .getByRole("button", { name: "Прийняти розплідник та оголошення" })
        .waitFor();
      assert.equal(c.stats.accepts, 0);
      await c.check();
      await c.page.screenshot({
        path: `${output}/claim-${width}.png`,
        fullPage: true,
      });
      await c.page
        .getByRole("button", { name: "Прийняти розплідник та оголошення" })
        .evaluate((b) => {
          b.click();
          b.click();
        });
      await c.page.waitForURL(`${base}/my-listings`);
      await c.page.goto(`${base}/profile/breeder`);
      assert.equal(c.stats.accepts, 1);
      await c.page
        .getByRole("heading", { name: "Отриманий профіль приватний" })
        .waitFor();
      assert(c.stats.publicationHeld);
      await c.page
        .getByRole("button", { name: "Опублікувати перевірений мною профіль" })
        .click();
      await c.page
        .getByRole("heading", { name: "Отриманий профіль приватний" })
        .waitFor({ state: "hidden" });
      assert(!c.stats.publicationHeld);
      await c.check();
      // A second tab cannot replay the consumed synthetic invitation.
      const second = await c.context.newPage();
      await second.goto(`${base}/claim-breeder?token=${token}`);
      await second
        .getByRole("button", { name: "Переглянути підготовлений профіль" })
        .click();
      await second.getByText(/Відкрийте оригінальне посилання/).waitFor();
      assert.equal(c.stats.accepts, 1);
      await second.close();
    } finally {
      c.release();
      await c.context.close();
    }
    results.push({
      width,
      admin: true,
      delayedRestore: true,
      urlScrub: true,
      explicitSingleClaim: true,
      privateUntilPublication: true,
      replayBlocked: true,
      overflow: false,
    });
  }
  const guest = await fixture(375, null);
  try {
    await guest.page.goto(`${base}/claim-breeder?token=${token}`);
    await guest.page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(owner.email);
    await guest.page
      .getByLabel("Пароль", { exact: true })
      .fill("Synthetic-password-42");
    await guest.page
      .locator("form")
      .getByRole("button", { name: "Увійти", exact: true })
      .click();
    await guest.page
      .getByRole("button", { name: "Переглянути підготовлений профіль" })
      .waitFor();
    assert.equal(guest.page.url(), `${base}/claim-breeder`);
    await guest.page
      .getByRole("button", { name: "Переглянути підготовлений профіль" })
      .click();
    await guest.page
      .getByRole("button", { name: "Прийняти розплідник та оголошення" })
      .waitFor();
    guest.setActive({ ...owner, id: draftId, email: "wrong@example.invalid" });
    await guest.notify();
    await guest.page.getByText(/wrong@example.invalid/).waitFor();
    await guest.page
      .getByRole("button", { name: "Переглянути підготовлений профіль" })
      .click();
    await guest.page
      .getByText("Увійдіть до акаунта з адресою, на яку надійшло запрошення.", {
        exact: true,
      })
      .waitFor();
    assert.equal(guest.stats.accepts, 0);
    await guest.page
      .getByRole("button", { name: "Увійти до іншого акаунта" })
      .click();
    await guest.page.getByLabel("Електронна адреса", { exact: true }).waitFor();
    await guest.check();
  } finally {
    await guest.context.close();
  }
  const registering = await fixture(375, null);
  try {
    await registering.page.goto(`${base}/claim-breeder?token=${token}`);
    await registering.page
      .getByRole("button", { name: "Зареєструватися", exact: true })
      .click();
    await registering.page.getByLabel("Ім’я", { exact: true }).fill("Олена");
    await registering.page
      .getByLabel("Прізвище", { exact: true })
      .fill("Тестова");
    await registering.page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(owner.email);
    await registering.page
      .getByLabel("Пароль", { exact: true })
      .fill("Synthetic-password-42");
    await registering.page
      .getByLabel("Підтвердження пароля", { exact: true })
      .fill("Synthetic-password-42");
    await registering.page.getByLabel(/Заводчик/).check();
    if (legalContentIdentity.terms.status === "PUBLISHED")
      await registering.page.locator("#registration-legal-accepted").check();
    await registering.page
      .getByRole("button", { name: "Створити акаунт", exact: true })
      .click();
    await registering.page
      .getByText("Електронну пошту не підтверджено", { exact: true })
      .waitFor();
    assert.equal(registering.stats.registrations, 1);
    assert.equal(registering.stats.accepts, 0);
    await registering.page
      .getByRole("button", { name: "Надіслати лист повторно" })
      .click();
    registering.setActive(owner);
    await registering.notify("email-verification");
    await registering.page
      .getByRole("button", { name: "Переглянути підготовлений профіль" })
      .click();
    await registering.page
      .getByRole("button", { name: "Прийняти розплідник та оголошення" })
      .waitFor();
    await registering.check();
  } finally {
    await registering.context.close();
  }
  for (const mode of ["invalid", "temporary", "conflict"]) {
    const c = await fixture(768);
    try {
      c.setMode(mode);
      await c.page.goto(`${base}/claim-breeder?token=${token}`);
      await c.page
        .getByRole("button", { name: "Переглянути підготовлений профіль" })
        .click();
      if (mode === "invalid")
        await c.page.getByText(/Відкрийте оригінальне посилання/).waitFor();
      else {
        await c.page
          .getByRole("button", { name: "Прийняти розплідник та оголошення" })
          .click();
        await c.page.getByRole("alert").waitFor();
        assert.equal(c.stats.accepts, 1);
        if (mode === "temporary") {
          await c.page
            .getByRole("button", { name: "Переглянути підготовлений профіль" })
            .click();
          await c.page
            .getByRole("button", { name: "Прийняти розплідник та оголошення" })
            .click();
          await c.page.waitForURL(`${base}/my-listings`);
          await c.page.goto(`${base}/profile/breeder`);
          assert.equal(c.stats.accepts, 2);
        }
      }
      await c.check();
    } finally {
      await c.context.close();
    }
  }
  const missing = await fixture(375);
  try {
    await missing.page.goto(`${base}/claim-breeder`);
    await missing.page.getByText(/Відкрийте оригінальне посилання/).waitFor();
    await missing.page.goto(`${base}/claim-breeder?token=bad`);
    await missing.page.getByText(/Відкрийте оригінальне посилання/).waitFor();
    await missing.page.goto(`${base}/claim-breeder?token=${token}`);
    await missing.page.waitForURL(`${base}/claim-breeder`);
    await missing.page.reload();
    await missing.page.getByText(/Відкрийте оригінальне посилання/).waitFor();
    assert.equal(missing.stats.accepts, 0);
  } finally {
    await missing.context.close();
  }
  const lifecycle = await runClaimLifecycle(browser, output);
  await writeFile(
    `${output}/browser-results.json`,
    JSON.stringify(
      {
        results,
        existingLogin: true,
        registrationVerification: true,
        wrongAccount: true,
        sessionSwitch: true,
        terminalInvalid: true,
        temporaryRetry: true,
        conflict: true,
        noTokenRefresh: true,
        realNext: true,
        capturedSyntheticMailLink: Boolean(capture),
        lifecycle,
      },
      null,
      2,
    ),
  );
  console.log(
    "Phase 18D native Chrome: 375/768/1440 admin and claim flows passed; login, registration/verification, account switch, retry/conflict/replay, URL cleanup, focus and overflow passed.",
  );
} finally {
  await browser.close();
}
