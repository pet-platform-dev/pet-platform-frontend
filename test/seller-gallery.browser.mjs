import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const { expect } = await import(
  process.env.PLAYWRIGHT_EXPECT_MODULE_URL ?? "@playwright/test"
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
});
const page = await context.newPage(),
  base = "http://localhost:3000",
  api = "http://localhost:4000/api/v1";
const marker = randomUUID(),
  email = `browser-media-${marker}@example.invalid`,
  password = "Test-fixture-only-1234";
const checks = [],
  errors = [],
  created = [],
  imageRequests = [],
  publicHeaders = [];
let actor, token, csrf;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXcAAAAASUVORK5CYII=",
  "base64",
);
const pass = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const data = async (response, status = 200) => {
  assert.equal(response.status(), status);
  return (await response.json()).data;
};
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
await mkdir("test-results", { recursive: true });
const manifest = () =>
  writeFile(
    `test-results/seller-fixtures-${actor}.json`,
    JSON.stringify({ userId: actor, email, listingIds: created }, null, 2),
  );
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.url().startsWith("https://res.cloudinary.com/"))
    imageRequests.push(request.url());
  if (request.url().includes("/api/v1/sellers/") && request.method() === "GET")
    publicHeaders.push(request.headers());
});
async function navigate(url) {
  const response = await page.goto(url);
  await page.waitForLoadState("networkidle");
  return response;
}
async function saveContacts(values = {}) {
  await navigate(base + "/profile");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "Контакти та місце розташування" })
    .waitFor();
  for (const [field, label] of [
    ["phone", "Телефон"],
    ["telegram", "Telegram"],
    ["viber", "Viber"],
    ["whatsapp", "WhatsApp"],
  ])
    await page.getByLabel(label, { exact: false }).fill(values[field] ?? "");
  const response = page.waitForResponse(
    (r) => r.url() === api + "/profile" && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Зберегти зміни", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await data(await response);
  await page
    .getByText("Публічний профіль збережено.", { exact: true })
    .waitFor();
}
async function overflow(name) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    name,
  );
}
async function swipe(selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box);
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height / 2,
    x = box.x + box.width * 0.8,
    end = box.x + box.width * 0.2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 5; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + ((end - x) * i) / 5, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
try {
  await navigate(base + "/profile");
  await page.waitForURL("**/login");
  pass("Anonymous profile editing redirects to login without private data");
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
      data: {
        email,
        password,
        firstName: "Олександр",
        lastName: "Єпік",
      },
    }),
    201,
  );
  actor = account.user.id;
  token = account.accessToken;
  await manifest();
  await page.getByLabel("Електронна адреса", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  const login = page.waitForResponse((r) => r.url().endsWith("/auth/login"));
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  token = (await data(await login)).accessToken;
  await page.waitForURL("**/account");
  await page
    .getByRole("link", { name: "Редагувати публічний профіль" })
    .click();
  await page
    .getByRole("heading", { name: "Контакти та місце розташування" })
    .waitFor();
  await expect(page.locator(".listing-seller-name")).toHaveText(
    "Олександр Єпік",
  );
  await expect(page.getByLabel("Публічне ім’я", { exact: true })).toHaveCount(
    0,
  );
  pass(
    "Account links to contact editor showing registered full name without duplicate identity input",
  );
  await page
    .getByLabel("Telegram", { exact: false })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Зберегти зміни" }).click();
  await page
    .getByText(
      "Вкажіть Telegram username: 5–32 латинські символи, цифри або _",
      { exact: true },
    )
    .waitFor();
  pass("Contact editor rejects unsafe Telegram with Ukrainian field error");
  await saveContacts({
    phone: "+380 (50) 123-45-67",
    telegram: "@Oleksandr_21_08",
    viber: "+380501234568",
    whatsapp: "+380501234569",
  });
  const location = (
    await data(
      await context.request.get(
        api + "/locations?search=" + encodeURIComponent("світловодськ"),
      ),
    )
  )[0];
  await page
    .getByRole("combobox", { name: "Місце", exact: true })
    .fill("світловодськ");
  await page
    .locator(".reference-results [role=option]")
    .filter({ has: page.getByText("Світловодськ", { exact: true }) })
    .first()
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect
    .poll(async () => (await data(await call("GET", "/profile"))).location?.id)
    .toBe(location.id);
  const dog = (await data(await context.request.get(api + "/species"))).find(
    (row) => row.slug === "dog",
  );
  const listings = [];
  for (const count of [1, 2, 10]) {
    const session = await data(
        await call("POST", "/uploads/listings/session", {}),
        201,
      ),
      ids = [];
    for (let i = 0; i < count; i++) {
      const image = await data(
        await context.request.post(
          api + `/uploads/listings/${session.uploadSessionId}/images`,
          {
            headers: headers(),
            multipart: {
              file: {
                name: `photo-${i}.png`,
                mimeType: "image/png",
                buffer: png,
              },
            },
            timeout: 120000,
          },
        ),
        201,
      );
      ids.push(image.id);
    }
    const listing = await data(
      await call("POST", "/listings/with-pet", {
        pet: { speciesId: dog.id },
        type: "FREE",
        locationId: location.id,
        title: `Тест медіа ${marker} ${count} photos`,
        description: "Тварина шукає родину",
        uploadSessionId: session.uploadSessionId,
        imageIds: ids,
      }),
      201,
    );
    created.push(listing.id);
    await manifest();
    await data(
      await call("PATCH", `/listings/${listing.id}/status`, {
        status: "ACTIVE",
      }),
    );
    listings.push(listing.id);
  }
  for (const archive of [false, true]) {
    const draft = await data(
      await call("POST", "/listings/with-pet", {
        pet: { speciesId: dog.id },
        type: "FREE",
        locationId: location.id,
        title: `Тест медіа ${marker} private`,
        description: "Приватна чернетка",
      }),
      201,
    );
    created.push(draft.id);
    await manifest();
    if (archive)
      await data(
        await call("PATCH", `/listings/${draft.id}/status`, {
          status: "ARCHIVED",
        }),
      );
  }
  const publicSeller = await data(
    await context.request.get(api + `/sellers/${actor}`),
  );
  assert.equal(publicSeller.displayName, "Олександр Єпік");
  assert.equal(publicSeller.phone, "+380501234567");
  assert.ok(!JSON.stringify(publicSeller).includes(email));
  assert.ok(!Object.hasOwn(publicSeller, "firstName"));
  assert.ok(!Object.hasOwn(publicSeller, "lastName"));
  pass(
    "Real public DTO exposes registered full name and normalized optional contacts, never email/auth fields",
  );
  await navigate(base + `/listings/${listings[2]}`);
  await expect(page.locator(".listing-seller-name")).toHaveText(
    "Олександр Єпік",
  );
  await expect(
    page.getByText("Приватний продавець", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Показати телефон" }).click();
  await expect(
    page.getByRole("link", { name: "+380501234567", exact: true }),
  ).toHaveAttribute("href", "tel:+380501234567");
  for (const [label, href] of [
    ["Telegram", "https://t.me/Oleksandr_21_08"],
    ["Viber", "viber://chat?number=%2B380501234568"],
    ["WhatsApp", "https://wa.me/380501234569"],
  ]) {
    const link = page.getByRole("link", { name: `Зв’язатися через ${label}` });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await page.getByRole("link", { name: "Переглянути профіль" }).click();
  await page.waitForURL(`**/sellers/${actor}`);
  await expect(
    page.getByRole("heading", { name: "Олександр Єпік", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Приватний продавець", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".listing-card")).toHaveCount(3);
  assert.equal(
    (await context.request.get(api + `/sellers/${actor}/listings`)).status(),
    200,
  );
  pass(
    "Listing seller card reveals phone, constructs safe messenger links and opens ACTIVE-only public profile",
  );
  for (const [values, expected] of [
    [{ phone: "+380501234567" }, ["Показати телефон"]],
    [{ telegram: "@Oleksandr_21_08" }, ["Telegram"]],
    [{ viber: "+380501234568" }, ["Viber"]],
    [{ whatsapp: "+380501234569" }, ["WhatsApp"]],
    [{}, []],
  ]) {
    await saveContacts(values);
    await navigate(base + `/sellers/${actor}`);
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("heading", { name: "Олександр Єпік", exact: true })
      .waitFor();
    await expect(
      page.locator(".seller-contacts a, .seller-contacts button"),
    ).toHaveCount(expected.length);
    if (expected.length)
      await expect(page.locator(".seller-contacts")).toContainText(expected[0]);
    pass(
      `Public contacts: ${expected.join(", ") || "none"}; no empty controls`,
    );
  }
  for (const [i, count] of [
    [0, 1],
    [1, 2],
    [2, 10],
  ]) {
    await navigate(base + `/listings/${listings[i]}`);
    await expect(page.locator(".gallery-stage .gallery-counter")).toHaveText(
      `1 / ${count}`,
    );
    await expect(page.locator(".gallery-stage .gallery-arrow")).toHaveCount(
      count === 1 ? 0 : 2,
    );
    if (count > 1) {
      await page
        .locator(".gallery-stage")
        .getByRole("button", { name: "Наступне фото" })
        .click();
      await expect(page.locator(".gallery-stage .gallery-counter")).toHaveText(
        `2 / ${count}`,
      );
      await page
        .getByRole("button", { name: "Показати фото 1", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Показати фото 1", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    const opener = page.getByRole("button", {
      name: "Відкрити фото на весь екран",
    });
    await opener.focus();
    if (count > 1) {
      await page.keyboard.press("ArrowLeft");
      await expect(page.locator(".gallery-stage .gallery-counter")).toHaveText(
        `${count} / ${count}`,
      );
      await page.keyboard.press("ArrowRight");
    }
    await opener.click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(page.locator("dialog[open] .gallery-arrow svg")).toHaveCount(
      count > 1 ? 2 : 0,
    );
    await expect(
      page.getByRole("button", { name: "Закрити перегляд" }),
    ).toBeFocused();
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    await expect(page.locator(".lightbox-image")).toHaveAttribute(
      "src",
      /w_1800/,
    );
    assert.equal(
      await page
        .locator(".lightbox-image")
        .evaluate((el) => getComputedStyle(el).objectFit),
      "contain",
    );
    if (count > 1) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("dialog .gallery-counter")).toHaveText(
        `2 / ${count}`,
      );
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "Попереднє фото", exact: true })
        .click();
    }
    for (let n = 0; n < 5; n++) await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("dialog")),
      ),
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(opener).toBeFocused();
    assert.notEqual(
      await page.evaluate(() => document.body.style.overflow),
      "hidden",
    );
    pass(
      `${count} real photos: arrows, thumbnail, keyboard, fullscreen, contain, focus trap/return, Escape and scroll unlock`,
    );
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await navigate(base + `/listings/${listings[2]}`);
  await page.locator(".gallery-open").scrollIntoViewIfNeeded();
  await swipe(".gallery-stage");
  await expect(page.locator(".gallery-stage .gallery-counter")).toHaveText(
    "2 / 10",
  );
  await page.getByRole("button", { name: "Відкрити фото на весь екран" }).tap();
  await expect(page.locator("dialog[open]")).toBeVisible();
  await swipe(".lightbox-stage");
  await expect(page.locator("dialog .gallery-counter")).toHaveText("3 / 10");
  await page.getByRole("button", { name: "Закрити перегляд" }).click();
  pass("Real touch swipe navigates inline and fullscreen; close button works");
  await saveContacts({
    phone: "+380501234567",
    telegram: "@Oleksandr_21_08",
    viber: "+380501234568",
    whatsapp: "+380501234569",
  });
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ["detail", `/listings/${listings[2]}`],
      ["seller", `/sellers/${actor}`],
      ["profile", "/profile"],
    ]) {
      await navigate(base + path);
      await page.locator("main h1").waitFor();
      await overflow(`${name} ${width}`);
      if (name === "detail") {
        const geometry = await page
          .locator(".gallery-main-image")
          .evaluate((wrapper) => {
            const image = wrapper
              .querySelector(".gallery-open")
              .getBoundingClientRect();
            const previous = wrapper.querySelector(".gallery-prev"),
              next = wrapper.querySelector(".gallery-next");
            const left = previous.getBoundingClientRect(),
              right = next.getBoundingClientRect();
            const leftIcon = previous
                .querySelector("svg")
                .getBoundingClientRect(),
              rightIcon = next.querySelector("svg").getBoundingClientRect();

            if (
              [leftIcon, rightIcon].some(
                (icon) => icon.width !== 24 || icon.height !== 24,
              )
            )
              throw Error("Chevron sizes differ");
            if (
              Math.abs(leftIcon.x + 12 - (left.x + left.width / 2)) > 1 ||
              Math.abs(rightIcon.x + 12 - (right.x + right.width / 2)) > 1 ||
              Math.abs(leftIcon.y + 12 - (left.y + left.height / 2)) > 1 ||
              Math.abs(rightIcon.y + 12 - (right.y + right.height / 2)) > 1
            )
              throw Error("Chevron not centered");
            return {
              leftCenter: left.y + left.height / 2,
              rightCenter: right.y + right.height / 2,
              imageCenter: image.y + image.height / 2,
              leftInset: left.x - image.x,
              rightInset: image.right - right.right,
              wrapperContext:
                previous.offsetParent === wrapper &&
                next.offsetParent === wrapper,
            };
          });
        assert.ok(geometry.wrapperContext);
        assert.ok(Math.abs(geometry.leftCenter - geometry.imageCenter) < 1);
        assert.ok(Math.abs(geometry.rightCenter - geometry.imageCenter) < 1);
        assert.ok(Math.abs(geometry.leftInset - geometry.rightInset) < 1);
        const strip = page.locator(".listing-gallery-thumbnails");
        assert.equal(
          await strip.evaluate(
            (element) => getComputedStyle(element).scrollbarWidth,
          ),
          "none",
        );
        assert.equal(
          await strip.evaluate(
            (element) => getComputedStyle(element).overflowX,
          ),
          "auto",
        );
        await strip.scrollIntoViewIfNeeded();
        await page
          .getByRole("button", { name: "Показати фото 1", exact: true })
          .click();
        const stripBox = await strip.boundingBox(),
          dragY = stripBox.y + stripBox.height / 2;
        for (let attempt = 0; attempt < 8; attempt++) {
          await page.mouse.move(stripBox.x + stripBox.width * 0.8, dragY);
          await page.mouse.down();
          await page.mouse.move(stripBox.x + stripBox.width * 0.2, dragY, {
            steps: 12,
          });
          assert.equal(
            await strip.evaluate((element) => getComputedStyle(element).cursor),
            "grabbing",
          );
          await page.mouse.up();
          assert.equal(
            await strip.evaluate((element) => getComputedStyle(element).cursor),
            "grab",
          );
          await expect(
            page.locator(".gallery-stage .gallery-counter"),
          ).toHaveText("1 / 10");
        }
        await expect
          .poll(() =>
            strip.evaluate(
              (element) =>
                element.scrollWidth - element.clientWidth - element.scrollLeft,
            ),
          )
          .toBeLessThan(1);
        await page
          .getByRole("button", { name: "Показати фото 10", exact: true })
          .click();
        await expect(
          page.locator(".gallery-stage .gallery-counter"),
        ).toHaveText("10 / 10");
        for (let attempt = 0; attempt < 8; attempt++) {
          await page.mouse.move(stripBox.x + stripBox.width * 0.2, dragY);
          await page.mouse.down();
          await page.mouse.move(stripBox.x + stripBox.width * 0.8, dragY, {
            steps: 12,
          });
          await page.mouse.up();
          await expect(
            page.locator(".gallery-stage .gallery-counter"),
          ).toHaveText("10 / 10");
        }
        await expect
          .poll(() => strip.evaluate((element) => element.scrollLeft))
          .toBeLessThan(1);
        await page
          .getByRole("button", { name: "Показати фото 1", exact: true })
          .click();
        await expect(
          page.locator(".gallery-stage .gallery-counter"),
        ).toHaveText("1 / 10");
        if (width <= 375) await swipe(".listing-gallery-thumbnails");
        else {
          await strip.hover();
          await page.mouse.wheel(400, 0);
        }
        await expect
          .poll(() => strip.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        await page
          .getByRole("button", { name: "Показати фото 10", exact: true })
          .click();
        await expect(
          page.locator(".gallery-stage .gallery-counter"),
        ).toHaveText("10 / 10");
      }
      await page.screenshot({
        path: `test-results/seller-${name}-${width}.png`,
        fullPage: true,
      });
    }
    await navigate(base + `/listings/${listings[2]}`);
    await page
      .getByRole("button", { name: "Відкрити фото на весь екран" })
      .click();
    await overflow(`fullscreen ${width}`);
    assert.equal(
      await page
        .locator("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    );
    await page.screenshot({
      path: `test-results/seller-lightbox-${width}.png`,
    });
    await page.keyboard.press("Escape");
    pass(
      `Detail/seller/profile/fullscreen ${width}px: centered SVGs, mouse drag without accidental selection, first/last thumbnail access, native touch/wheel, hidden scrollbar, no overflow`,
    );
  }
  await page.route("https://res.cloudinary.com/**", (route) => route.abort());
  await navigate(base + `/listings/${listings[2]}`);
  await page.locator(".gallery-open .listing-visual").waitFor();
  await page
    .getByRole("button", { name: "Відкрити фото на весь екран" })
    .click();
  await page.locator("dialog .listing-visual").waitFor();
  await page.keyboard.press("Escape");
  await page.unroute("https://res.cloudinary.com/**");
  pass("Broken remote images retain fallback in inline and fullscreen gallery");
  const historical = (
    await data(await context.request.get(api + "/listings?limit=100"))
  ).find((row) => !row.images.length);
  assert.ok(historical);
  await navigate(base + `/listings/${historical.id}`);
  await page.getByText("Фото ще не додано", { exact: true }).waitFor();
  await expect(page.locator(".gallery-arrow")).toHaveCount(0);
  pass("Existing zero-image demo retains honest placeholder");
  for (const id of ["invalid", randomUUID()]) {
    const response = await navigate(base + `/sellers/${id}`);
    assert.equal(response.status(), 404);
  }
  pass("Invalid and unknown seller routes return actual HTTP 404");
  await navigate(base + "/account");
  await page.getByRole("button", { name: "Вийти з акаунта" }).click();
  await page.waitForURL("**/login");
  await navigate(base + "/profile");
  await page.waitForURL("**/login");
  pass("Logout removes protected profile state and editor access");
  assert.deepEqual(errors, []);
  assert.ok(
    publicHeaders.every(
      (headers) => !headers.authorization && !headers["x-csrf-token"],
    ),
  );
  assert.ok(imageRequests.some((url) => url.includes("w_1800")));
  assert.ok(
    imageRequests
      .filter((url) => url.includes(`pet-platform/tmp/${actor}`))
      .every((url) => url.includes("f_auto,q_auto")),
  );
  pass(
    "No runtime errors, public auth leakage, or original claimed-image downloads",
  );
  await writeFile(
    "test-results/seller-gallery-summary.json",
    JSON.stringify(
      {
        count: checks.length,
        checks,
        runtimeErrors: errors,
        fixtureManifest: `test-results/seller-fixtures-${actor}.json`,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: checks.length,
      fixtureManifest: `test-results/seller-fixtures-${actor}.json`,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      failedUrl: page.url(),
      visibleText: (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 1500),
    }),
  );
  throw error;
} finally {
  await browser.close();
}
