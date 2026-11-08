import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const fixture = JSON.parse(
  await readFile(
    "../pet-platform-backend/.tmp/services-s8-browser-fixture.json",
    "utf8",
  ),
);
assert.equal(fixture.origin, "http://127.0.0.1:4019");
assert.equal(fixture.frontend, "http://localhost:3019");
const base = fixture.frontend,
  api = fixture.origin + "/api/v1",
  csrf = "s".repeat(43),
  checks = [],
  errors = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J9sAAAAASUVORK5CYII=",
  "base64",
);
const file = (name = "synthetic.png", buffer = png) => ({
  name,
  mimeType: "image/png",
  buffer,
});
await mkdir("test-results/services-s8", { recursive: true });
async function direct(
  path,
  token,
  method = "GET",
  body,
  expected = 200,
  extra = {},
) {
  const response = await fetch(api + path, {
    method,
    headers: {
      Origin: base,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Cookie: `pet_csrf=${csrf}`,
      "X-CSRF-Token": csrf,
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
  return response.json();
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
let lastPage;
try {
  for (const width of [375, 768, 1440]) {
    const adminLogin = await direct("/auth/login", "", "POST", {
      email: fixture.admin.email,
      password: fixture.password,
    });
    fixture.adminToken = adminLogin.data.accessToken;
    console.log(`S8 Chrome ${width}: starting owner journey`);
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.route("https://res.cloudinary.com/fixture/**", (r) =>
      r.fulfill({ contentType: "image/png", body: png }),
    );
    const page = await context.newPage();
    lastPage = page;
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(90000);
    let watchedMediaPath = "",
      mediaReads = 0;
    page.on("response", (r) => {
      if (
        r.request().method() === "GET" &&
        new URL(r.url()).pathname === watchedMediaPath
      )
        mediaReads++;
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        /hydration|hydrated|Event handlers cannot/.test(m.text()) ||
        (m.type() === "error" &&
          !m.text().startsWith("Failed to load resource:"))
      )
        errors.push(m.text());
    });
    async function go(path) {
      const r = await page.goto(base + path);
      assert.ok(r.status() < 500, path);
      await page.waitForLoadState("networkidle");
    }
    async function overflow() {
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${width} ${page.url()}`,
      );
    }
    async function select(label, option) {
      await page.getByRole("combobox", { name: label, exact: true }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
    }
    async function upload(label, files) {
      const pending = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: label, exact: true })
        .and(page.locator("button"))
        .click();
      await (await pending).setFiles(files);
    }
    async function confirm(label) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.locator("dialog[open]").waitFor();
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "Підтвердити", exact: true })
        .click();
    }
    async function response(action, tail, method, status) {
      const pending = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith(tail) &&
          r.request().method() === method,
      );
      try {
        await action();
      } catch (error) {
        void pending.catch(() => {});
        throw error;
      }
      const r = await pending;
      assert.equal(r.status(), status, tail);
      if (tail.includes("/service-workspace/"))
        await page.locator('main[aria-busy="false"]').waitFor();
      await page.waitForLoadState("networkidle");
      return r.status() === 204 ? undefined : r.json();
    }
    async function login(user) {
      await go("/login?" + new URLSearchParams({ returnTo: "/my-services" }));
      await page
        .getByLabel("Електронна адреса", { exact: true })
        .fill(user.email);
      await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
      const result = await response(
        () => page.getByRole("button", { name: "Увійти", exact: true }).click(),
        "/auth/login",
        "POST",
        200,
      );
      await page.waitForURL((u) => u.pathname === "/my-services");
      await page
        .getByRole("heading", { name: "Мої послуги", exact: true })
        .waitFor();
      return result.data.accessToken;
    }
    await go("/my-services");
    await page.waitForURL(/\/login/);
    const ownerToken = await login(fixture.owner);
    if (width === 375)
      await page
        .getByRole("heading", {
          name: "Створіть свій перший профіль",
          exact: true,
        })
        .waitFor();
    async function createProvider(kind, suffix) {
      await go("/my-services/new");
      if (kind === "ORGANIZATION") await select("Тип надавача", "Організація");
      const title = `Синтетичний S8 ${suffix} ${width}`;
      await page
        .getByLabel(
          kind === "ORGANIZATION"
            ? "Назва організації"
            : "Ім’я або назва спеціаліста",
          { exact: true },
        )
        .fill(title);
      await page
        .getByLabel("Опис послуг і досвіду", { exact: true })
        .fill("Демонстраційні послуги, без реальної діяльності.");
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page
        .getByLabel("Вебсайт", { exact: true })
        .fill("https://s8-fixture.example.invalid");
      await response(
        () =>
          page
            .getByRole("button", { name: "Створити профіль", exact: true })
            .click(),
        "/service-workspace/providers",
        "POST",
        201,
      );
      await page.waitForURL(/\/my-services\/[0-9a-f-]{36}\/edit$/);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      return { id: new URL(page.url()).pathname.split("/")[2], title };
    }
    const individual = await createProvider("INDIVIDUAL", "спеціаліст");
    await overflow();
    const root = `/service-workspace/providers/${individual.id}`;
    watchedMediaPath = "/api/v1" + root + "/media";
    async function addLocation(role) {
      await page
        .getByRole("combobox", { name: "Місто або село", exact: true })
        .fill("Ки");
      await page.getByRole("option", { name: /Київ/ }).first().click();
      if (role === "SERVICE_AREA")
        await select("Роль місця", "Територія обслуговування");
      return response(
        () =>
          page
            .getByRole("button", { name: "Додати місце", exact: true })
            .click(),
        root + "/locations",
        "POST",
        201,
      );
    }
    const branch = (await addLocation("BASE")).data.location;
    await addLocation("SERVICE_AREA");
    await page
      .getByRole("button", { name: "Редагувати місце", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Публічна адреса (необов’язково)", { exact: true })
      .fill("Демонстраційна адреса");
    await response(
      () =>
        page
          .getByRole("button", { name: "Зберегти місце", exact: true })
          .click(),
      root + "/locations/" + branch.id,
      "PATCH",
      200,
    );
    const unused = (await addLocation("BASE")).data.location;
    await response(
      async () => {
        await page
          .getByRole("button", { name: "Видалити місце", exact: true })
          .last()
          .click();
        await page
          .locator("dialog[open]")
          .getByRole("button", { name: "Підтвердити", exact: true })
          .click();
      },
      root + "/locations/" + unused.id,
      "DELETE",
      200,
    );
    const readsBeforeLogo = mediaReads;
    await response(
      () => upload("Додати логотип", file()),
      root + "/media/uploads",
      "POST",
      201,
    );
    assert.equal(
      mediaReads - readsBeforeLogo,
      1,
      "Successful media mutation refreshes media once",
    );
    const logo = await page
      .getByAltText("Логотип", { exact: true })
      .getAttribute("src");
    await response(
      () => upload("Додати банер", file("cover.png")),
      root + "/media/uploads",
      "POST",
      201,
    );
    const bad = Buffer.concat([png, Buffer.from("S8_FORCE_UPLOAD_FAILURE")]);
    await response(
      () => upload("Замінити логотип", file("failure.png", bad)),
      "/media/" +
        (await direct(root + "/media", ownerToken)).data.items.find(
          (i) => i.type === "LOGO",
        ).id,
      "PATCH",
      500,
    );
    assert.equal(
      await page.getByAltText("Логотип", { exact: true }).getAttribute("src"),
      logo,
    );
    const logoId = (await direct(root + "/media", ownerToken)).data.items.find(
      (i) => i.type === "LOGO",
    ).id;
    await response(
      () => upload("Замінити логотип", file("replacement.png")),
      root + "/media/" + logoId,
      "PATCH",
      200,
    );
    await upload("Додати фото галереї", [file("one.png"), file("two.png")]);
    await page
      .getByRole("button", { name: "Фото 2: раніше", exact: true })
      .waitFor();
    await response(
      () =>
        page
          .getByRole("button", { name: "Фото 2: раніше", exact: true })
          .click(),
      root + "/media/reorder",
      "POST",
      200,
    );
    const count = (await direct(root + "/media", ownerToken)).data.items.length;
    await upload(
      "Додати фото галереї",
      file("too-large.png", Buffer.alloc(3 * 1024 * 1024 + 1)),
    );
    await page.getByRole("alert").filter({ hasText: "3 MiB" }).waitFor();
    assert.equal(
      (await direct(root + "/media", ownerToken)).data.items.length,
      count,
    );
    const coverId = (await direct(root + "/media", ownerToken)).data.items.find(
      (i) => i.type === "COVER",
    ).id;
    await response(
      () => confirm("Видалити банер"),
      root + "/media/" + coverId,
      "DELETE",
      200,
    );
    await page.getByText("Переглянути галерею", { exact: true }).click();
    await page
      .getByRole("button", { name: "Відкрити фото на весь екран", exact: true })
      .click();
    await page.locator("dialog[open]").waitFor();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.screenshot({
      path: `test-results/services-s8/provider-${width}.png`,
      fullPage: true,
      caret: "initial",
    });
    await overflow();
    // True revision conflict: another valid request changes the row while the form is dirty.
    await page
      .getByLabel("Опис послуг і досвіду", { exact: true })
      .fill("Незбережений текст після паралельної зміни");
    let current = (await direct(root, ownerToken)).data;
    await direct(root, ownerToken, "PATCH", {
      description: "Актуальний текст іншої вкладки",
      expectedUpdatedAt: current.updatedAt,
    });
    await response(
      () =>
        page
          .getByRole("button", { name: "Зберегти профіль", exact: true })
          .click(),
      root,
      "PATCH",
      409,
    );
    assert.equal(
      await page
        .getByLabel("Опис послуг і досвіду", { exact: true })
        .inputValue(),
      "Незбережений текст після паралельної зміни",
    );
    await page
      .getByRole("button", { name: "Оновити дані", exact: true })
      .click();
    await confirm("Завантажити актуальні дані");
    await page.waitForFunction(
      () =>
        document.querySelector('textarea[name="description"]')?.value ===
        "Актуальний текст іншої вкладки",
    );
    assert.equal(
      await page
        .getByLabel("Опис послуг і досвіду", { exact: true })
        .inputValue(),
      "Актуальний текст іншої вкладки",
    );
    // Mutate the header only: real Nest CSRF rejection, without weakening the client.
    await page
      .getByLabel("Опис послуг і досвіду", { exact: true })
      .fill("Безпечне збереження після помилки CSRF");
    await context.route(
      base + "/api/v1" + root,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.continue({
            headers: {
              ...route.request().headers(),
              "x-csrf-token": "invalid",
            },
          });
        } else await route.continue();
      },
      { times: 1 },
    );
    await response(
      () =>
        page
          .getByRole("button", { name: "Зберегти профіль", exact: true })
          .click(),
      root,
      "PATCH",
      403,
    );
    assert.equal(
      await page
        .getByLabel("Опис послуг і досвіду", { exact: true })
        .inputValue(),
      "Безпечне збереження після помилки CSRF",
    );
    await response(
      () =>
        page
          .getByRole("button", { name: "Зберегти профіль", exact: true })
          .click(),
      root,
      "PATCH",
      200,
    );
    await response(
      () => confirm("Надіслати на модерацію"),
      root + "/submit",
      "POST",
      200,
    );
    current = (await direct(root, ownerToken)).data;
    await direct(
      `/admin/moderation/service-providers/${individual.id}/reject`,
      fixture.adminToken,
      "POST",
      {
        expectedUpdatedAt: current.updatedAt,
        reason: "Синтетичний приклад причини доопрацювання",
      },
    );
    await page
      .getByRole("button", { name: "Оновити дані", exact: true })
      .click();
    await page
      .getByText("Синтетичний приклад причини доопрацювання", { exact: false })
      .first()
      .waitFor();
    await response(
      () => confirm("Надіслати на модерацію"),
      root + "/submit",
      "POST",
      200,
    );
    current = (await direct(root, ownerToken)).data;
    await direct(
      `/admin/moderation/service-providers/${individual.id}/approve`,
      fixture.adminToken,
      "POST",
      { expectedUpdatedAt: current.updatedAt, claimsReviewed: true },
    );
    const offerIds = [];
    for (const category of fixture.categories) {
      await go(`/my-services/${individual.id}/offers/new`);
      await select("Категорія послуги", category.nameUk);
      const title = `S8 ${category.slug} ${width}`;
      await page.getByLabel("Назва послуги", { exact: true }).fill(title);
      await page
        .getByLabel("Опис послуги", { exact: true })
        .fill("Синтетична послуга для перевірки форми");
      await page.getByLabel("Собаки", { exact: true }).check();
      const mode = ["veterinary-care", "dog-training"].includes(category.slug)
        ? "REMOTE"
        : ["grooming", "pet-boarding"].includes(category.slug)
          ? "ONSITE"
          : "MOBILE";
      if (mode !== "REMOTE") {
        await select(
          "Формат надання",
          mode === "ONSITE" ? "За адресою надавача" : "З виїздом",
        );
        await page
          .getByRole("group", { name: "Місця надання послуги", exact: true })
          .getByRole("checkbox")
          .first()
          .check();
      }
      await select("Модель ціни", "Від указаної суми");
      await page
        .getByLabel("Сума, грн", { exact: true })
        .fill(width === 375 ? "1250,50" : "1250.50");
      if (category.slug === "veterinary-care")
        await select("Тип консультації", "Загальна");
      if (category.slug === "pet-transportation")
        await select("Напрям поїздок", "Міжнародні");
      if (category.slug === "grooming")
        await page
          .getByLabel("Процедури", { exact: true })
          .fill("Купання\nРозчісування");
      if (category.slug === "dog-training")
        await select("Формат занять", "Індивідуальний");
      if (category.slug === "pet-boarding")
        await page.getByLabel("Кількість місць", { exact: true }).fill("2");
      if (category.slug === "pet-sitting")
        await select("Формат догляду", "Відвідування");
      if (category.slug === "pet-walking")
        await page
          .getByLabel("Тривалість прогулянки, хвилин", { exact: true })
          .fill("45");
      await response(
        () =>
          page
            .getByRole("button", {
              name: "Створити чернетку послуги",
              exact: true,
            })
            .click(),
        root + "/offers",
        "POST",
        201,
      );
      await page.waitForURL(/\/offers\/[0-9a-f-]{36}\/edit$/);
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      const oid = new URL(page.url()).pathname.split("/")[4];
      offerIds.push({ id: oid, slug: category.slug });
      const row = (await direct(root + "/offers/" + oid, ownerToken)).data;
      assert.equal(row.price.amount, "1250.50");
      assert.equal(row.categoryId, category.id);
      assert.equal(row.species.length, 1);
      await overflow();
    }
    const target = offerIds.find((o) => o.slug === "grooming"),
      offerRoot = root + "/offers/" + target.id;
    await go(`/my-services/${individual.id}/offers/${target.id}/edit`);
    await upload("Додати фото галереї", [
      file("offer-one.png"),
      file("offer-two.png"),
    ]);
    await page
      .getByRole("button", { name: "Зробити обкладинкою", exact: true })
      .waitFor();
    await response(
      () =>
        page
          .getByRole("button", { name: "Зробити обкладинкою", exact: true })
          .click(),
      offerRoot + "/media/cover",
      "PATCH",
      200,
    );
    const removedOfferImage = (
      await direct(offerRoot + "/media", ownerToken)
    ).data.items.find((i) => !i.isCover);
    await response(
      () => confirm("Видалити фото 2"),
      offerRoot + "/media/" + removedOfferImage.id,
      "DELETE",
      200,
    );
    await select(
      "Категорія послуги",
      fixture.categories.find((c) => c.slug === "pet-walking").nameUk,
    );
    await page.locator("dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    assert.ok(await page.getByLabel("Процедури", { exact: true }).isVisible());
    await select(
      "Категорія послуги",
      fixture.categories.find((c) => c.slug === "pet-walking").nameUk,
    );
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Підтвердити", exact: true })
      .click();
    await page
      .getByLabel("Тривалість прогулянки, хвилин", { exact: true })
      .fill("40");
    await response(
      () =>
        page
          .getByRole("button", { name: "Зберегти послугу", exact: true })
          .click(),
      offerRoot,
      "PATCH",
      200,
    );
    await response(
      () => confirm("Надіслати на модерацію"),
      offerRoot + "/submit",
      "POST",
      200,
    );
    const pending = (await direct(offerRoot, ownerToken)).data;
    await direct(
      `/admin/moderation/service-offers/${target.id}/approve`,
      fixture.adminToken,
      "POST",
      { expectedUpdatedAt: pending.updatedAt, claimsReviewed: true },
    );
    await go(`/my-services/${individual.id}/offers/${target.id}/edit`);
    await page.getByLabel("Сума, грн", { exact: true }).fill("1300.25");
    await response(
      () =>
        page
          .getByRole("button", { name: "Зберегти послугу", exact: true })
          .click(),
      offerRoot,
      "PATCH",
      200,
    );
    assert.equal(
      (await direct(offerRoot, ownerToken)).data.moderationStatus,
      "PENDING",
    );
    await direct(
      "/service-offers/" + target.id,
      ownerToken,
      "GET",
      undefined,
      404,
    );
    await page.screenshot({
      path: `test-results/services-s8/offer-${width}.png`,
      fullPage: true,
      caret: "initial",
    });
    await overflow();
    const vet = offerIds.find((o) => o.slug === "veterinary-care");
    await go(`/my-services/${individual.id}/offers/${vet.id}/edit`);
    await response(
      () => confirm("Надіслати на модерацію"),
      root + "/offers/" + vet.id + "/submit",
      "POST",
      200,
    );
    const vetPending = (await direct(root + "/offers/" + vet.id, ownerToken))
      .data;
    await direct(
      `/admin/moderation/service-offers/${vet.id}/approve`,
      fixture.adminToken,
      "POST",
      { expectedUpdatedAt: vetPending.updatedAt, claimsReviewed: true },
      409,
    );
    await direct(
      "/service-offers/" + vet.id,
      ownerToken,
      "GET",
      undefined,
      404,
    );
    const org = await createProvider("ORGANIZATION", "організація");
    console.log(
      `S8 Chrome ${width}: seven categories, media, conflict and moderation verified`,
    );
    const archivedOffer = offerIds.find((o) => o.slug === "pet-sitting");
    await go(`/my-services/${individual.id}/offers/${archivedOffer.id}/edit`);
    await response(
      () => confirm("Архівувати"),
      root + "/offers/" + archivedOffer.id + "/archive",
      "POST",
      200,
    );
    await page.getByText("Архів · Не надіслано", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Зберегти послугу", exact: true })
        .count(),
      0,
    );
    await go(`/my-services/${org.id}`);
    await response(
      () => confirm("Архівувати"),
      `/service-workspace/providers/${org.id}/archive`,
      "POST",
      200,
    );
    await page.getByText("Архів · Не надіслано", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Додати послугу", exact: true })
        .count(),
      0,
    );
    await go("/my-services");
    await page
      .getByRole("link", { name: individual.title, exact: true })
      .waitFor();
    await page.getByRole("link", { name: org.title, exact: true }).waitFor();
    await page.screenshot({
      path: `test-results/services-s8/profiles-${width}.png`,
      fullPage: true,
      caret: "initial",
    });
    await overflow();
    await go("/account");
    await response(
      () =>
        page
          .getByRole("button", { name: "Вийти з акаунта", exact: true })
          .click(),
      "/auth/logout",
      "POST",
      204,
    );
    await login(fixture.other);
    await go(`/my-services/${individual.id}`);
    await page.getByRole("alert").filter({ hasText: "недоступні" }).waitFor();
    assert.equal(
      await page.getByText(individual.title, { exact: true }).count(),
      0,
    );
    // Revoke this synthetic browser session externally, then force normal restoration.
    const cookies = await context.cookies(base + "/api/v1/auth/logout"),
      cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      csrfCookie = cookies.find((c) => c.name === "pet_csrf");
    const expired = await fetch(api + "/auth/logout", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: cookie,
        "X-CSRF-Token": csrfCookie.value,
      },
    });
    assert.equal(expired.status, 204);
    await go("/my-services");
    await page.reload();
    await page.waitForURL(/\/login/);
    checks.push({
      width,
      providerKinds: 2,
      categories: 7,
      locations: true,
      media: true,
      failedReplacementPreserved: true,
      categoryConfirmation: true,
      moderation: true,
      veterinaryPublicationBlocked: true,
      revisionConflict: true,
      csrf: true,
      logoutIsolation: true,
      sessionExpiry: true,
      overflow: false,
    });
    await context.close();
  }
  assert.deepEqual(errors, [], "Browser JS/hydration errors");
  await writeFile(
    "test-results/services-s8/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }));
} catch (error) {
  if (lastPage && !lastPage.isClosed())
    await writeFile(
      "test-results/services-s8/failure.json",
      JSON.stringify(
        {
          url: lastPage.url(),
          error: String(error).slice(0, 1000),
          text: await lastPage
            .locator("main")
            .innerText()
            .catch(() => ""),
          files: await lastPage
            .locator('input[type="file"]')
            .evaluateAll((elements) =>
              elements.map((e) => ({ id: e.id, disabled: e.disabled })),
            ),
          errors,
        },
        null,
        2,
      ),
    );
  throw error;
} finally {
  await browser.close();
}
