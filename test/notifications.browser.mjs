import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(resolve("../pet-platform-backend/package.json"));
require("dotenv").config({
  path: resolve("../pet-platform-backend/.env"),
  quiet: true,
});
const database = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
    database.pathname === "/pet_platform",
);
const { PrismaService } =
  await import("../../pet-platform-backend/dist/src/prisma/prisma.service.js");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const db = new PrismaService(),
  ids = [],
  checks = [],
  errors = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext(),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const password = "LocalFixture-" + randomUUID();
async function fingerprints() {
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations', 'AuthRefreshToken') ORDER BY tablename`;
  const result = {};
  for (const { tablename } of tables) {
    const [row] = await db.$queryRawUnsafe(
      "SELECT count(*)::int AS count, md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS hash FROM \"" +
        tablename.replaceAll('"', '""') +
        '" t',
    );
    result[tablename] = row;
  }
  return result;
}
async function go(path) {
  await page.goto("http://localhost:3000" + path);
  await page.waitForLoadState("networkidle");
}
async function login(user) {
  await go("/login");
  await page.getByLabel("Електронна адреса", { exact: true }).fill(user.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL("**/account");
  await page.waitForLoadState("networkidle");
}
const bell = () => page.getByRole("button", { name: /^Сповіщення/ });
const panel = () =>
  page.getByRole("region", { name: "Сповіщення", exact: true });
async function count(value) {
  await bell()
    .filter({ has: page.locator("svg") })
    .waitFor();
  await page.waitForFunction(
    (v) =>
      document
        .querySelector(".notification-trigger")
        ?.getAttribute("aria-label") ===
      (v ? "Сповіщення, непрочитаних: " + v : "Сповіщення"),
    value,
  );
}
let before, releaseLate;
try {
  await mkdir("test-results", { recursive: true });
  before = await fingerprints();
  const hash = await require("argon2").hash(password);
  for (const firstName of ["A", "B"]) {
    const user = await db.user.create({
      data: {
        email: "notification-browser-" + randomUUID() + "@example.invalid",
        passwordHash: hash,
        firstName,
      },
    });
    ids.push(user.id);
    await db.notification.createMany({
      data: Array.from({ length: firstName === "A" ? 22 : 2 }, (_, n) => ({
        userId: user.id,
        type: "SYSTEM",
        title:
          firstName === "A" && n === 21
            ? "Перехід до оголошень"
            : firstName + " приватне " + n,
        body: "Текст сповіщення для перевірки читабельності. ".repeat(
          n === 20 ? 12 : 1,
        ),
        href:
          n === 21 ? "/my-listings" : n === 19 ? "javascript:alert(1)" : null,
        createdAt: new Date(Date.now() - (22 - n) * 1000),
      })),
    });
  }
  const a = await db.user.findUnique({ where: { id: ids[0] } }),
    b = await db.user.findUnique({ where: { id: ids[1] } });
  if (process.env.PHASE11A_RESUME) {
    const prior = JSON.parse(
      await readFile("test-results/phase11a-browser.json", "utf8"),
    );
    assert.ok(prior.checks.includes("anonymous no bell"));
    checks.push("anonymous no bell");
    if (process.env.PHASE11A_RESUME === "keyboard") {
      assert.ok(
        prior.checks.includes(
          "mark all updates visible rows and removes badge",
        ),
      );
      checks.push(
        ...prior.checks.filter((name) => name !== "anonymous no bell"),
      );
    }
    if (process.env.PHASE11A_RESUME === "pagination") {
      assert.ok(
        prior.checks.includes("loading/error/localized retry recovers"),
      );
      checks.push("loading/error/localized retry recovers");
    }
  } else {
    await go("/listings");
    assert.equal(await bell().count(), 0);
    pass("anonymous no bell");
  }
  await login(a);
  assert.equal(
    await bell().count(),
    1,
    "Exactly one bell survives client login navigation",
  );
  await count(22);
  if (process.env.PHASE11A_RESUME !== "keyboard") {
    if (process.env.PHASE11A_RESUME !== "pagination") {
      let failList = true;
      await page.route("**/api/v1/notifications?*", async (route) => {
        if (failList) {
          failList = false;
          await new Promise((r) => setTimeout(r, 500));
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "PRIVATE INTERNAL ERROR" }),
          });
        } else await route.continue();
      });
      await bell().click();
      await panel().getByRole("status").waitFor();
      await panel()
        .getByText("Не вдалося завантажити сповіщення.", { exact: true })
        .waitFor();
      assert.equal(
        await panel().getByText("PRIVATE INTERNAL ERROR").count(),
        0,
      );
      await panel().getByRole("button", { name: "Спробувати ще раз" }).click();
      await panel()
        .getByRole("link", { name: "Перехід до оголошень" })
        .waitFor();
      await page.unroute("**/api/v1/notifications?*");
      pass("loading/error/localized retry recovers");
    } else {
      await bell().click();
      await panel()
        .getByRole("link", { name: "Перехід до оголошень" })
        .waitFor();
    }
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const box = await panel().boundingBox(),
        button = await bell().boundingBox();
      assert.ok(box.x >= 15 && box.x + box.width <= width - 15);
      assert.ok(button.width >= 44 && button.height >= 44);
      assert.equal(await page.locator("select").count(), 0);
      assert.ok(
        await panel().getByText("Непрочитане", { exact: true }).count(),
      );
      assert.equal(
        await panel()
          .locator(".notification-item p")
          .evaluateAll((nodes) =>
            nodes.every(
              (n) =>
                n.getBoundingClientRect().height <=
                parseFloat(getComputedStyle(n).lineHeight) * 3 + 1,
            ),
          ),
        true,
        "Long bodies remain compact previews",
      );
      await page.screenshot({
        path: "test-results/phase11a-panel-" + width + ".png",
      });
    }
    pass("bell/panel375/768/1440;44px;no horizontal overflow/native select");
    await page.locator(".brand").focus();
    await panel().waitFor({ state: "hidden" });
    await bell().click();
    await panel().getByRole("link", { name: "Перехід до оголошень" }).waitFor();
    pass("focus outside dismisses panel; pagination loading does not");
    await panel()
      .getByRole("button", { name: "Наступні", exact: true })
      .click();
    await panel().getByText("A приватне 0", { exact: true }).waitFor();
    await panel()
      .getByRole("button", { name: "Попередні", exact: true })
      .click();
    await panel().getByRole("link", { name: "Перехід до оголошень" }).waitFor();
    pass("bounded pagination reaches older notifications");
    assert.equal(await panel().locator('a[href^="javascript:"]').count(), 0);
    await panel()
      .getByRole("button", { name: "Позначити як прочитане", exact: true })
      .nth(1)
      .click();
    await count(21);
    pass("mark one updates badge and explicit unread indicator");
    await panel().getByRole("link", { name: "Перехід до оголошень" }).click();
    await page.waitForURL("**/my-listings");
    await count(20);
    pass("safe href navigates immediately and marks read");
    await bell().click();
    await panel()
      .getByRole("button", { name: "Позначити всі як прочитані", exact: true })
      .click();
    await count(0);
    assert.equal(await page.locator(".notification-count").count(), 0);
    await page.waitForFunction(
      () => !document.querySelector(".notification-unread"),
    );
    pass("mark all updates visible rows and removes badge");
  } else {
    await bell().click();
    await panel().getByRole("link", { name: "Перехід до оголошень" }).waitFor();
    await panel()
      .getByRole("button", { name: "Позначити всі як прочитані", exact: true })
      .click();
    await count(0);
  }
  assert.equal(
    await panel().evaluate((n) => n.contains(document.activeElement)),
    true,
    "Focus stays in panel after disabling/removing read actions",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await bell().evaluate((n) => n === document.activeElement),
    true,
  );
  pass("Escape closes and returns focus");
  await go("/account");
  let started;
  const ready = new Promise((r) => {
    started = r;
  });
  const late = new Promise((r) => {
    releaseLate = r;
  });
  await page.route("**/api/v1/notifications?*", async (route) => {
    const response = await route.fetch();
    started();
    await late;
    try {
      await route.fulfill({ response });
    } catch {
      /* cancelled old session request */
    }
  });
  await bell().click();
  await ready;
  await page.getByRole("heading", { name: "A", exact: true }).click();
  await page
    .getByRole("button", { name: "Вийти з акаунта", exact: true })
    .click();
  await page.waitForURL("**/login");
  assert.equal(await bell().count(), 0);
  await page.unroute("**/api/v1/notifications?*");
  await login(b);
  await count(2);
  releaseLate();
  await bell().click();
  await panel().getByText("B приватне 1", { exact: true }).waitFor();
  assert.equal(
    await panel()
      .getByText(/A приватне/)
      .count(),
    0,
  );
  assert.equal(
    await panel().getByRole("link", { name: "Перехід до оголошень" }).count(),
    0,
  );
  pass(
    "logout/login account switch rejects late A response; no A list/badge leakage",
  );
  await db.notification.deleteMany({ where: { userId: b.id } });
  await page.reload();
  await count(0);
  await bell().click();
  await panel().getByText("Сповіщень поки немає", { exact: true }).waitFor();
  pass("empty state and refresh convergence");
  assert.deepEqual(errors, []);
  pass("no browser runtime/hydration errors");
} finally {
  releaseLate?.();
  await context.close();
  await browser.close();
  try {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    if (before)
      assert.deepEqual(
        await fingerprints(),
        before,
        "All existing stable tables preserved",
      );
  } finally {
    await db.$disconnect();
    await writeFile(
      "test-results/phase11a-browser.json",
      JSON.stringify({ checks, errors }, null, 2),
    );
  }
}
