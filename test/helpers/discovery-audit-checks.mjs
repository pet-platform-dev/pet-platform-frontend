import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function discoveryAuditChecks({
  page,
  run,
  fixture,
  breed,
  filteredUrl,
  name,
  marker,
}) {
  const base = "http://localhost:3000",
    api = "http://localhost:4000/api/v1";
  const cards = () => page.locator("a.breeder-directory-card");
  const go = async (path) => {
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
  };
  const publicData = async () =>
    (
      await page.request.get(
        api + "/breeders?" + new URLSearchParams({ q: name, limit: "24" }),
      )
    ).json();
  await run("O", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await go(filteredUrl);
    for (const label of ["Очистити породу", "Очистити місто"]) {
      const box = await page
        .getByRole("button", { name: label, exact: true })
        .boundingBox();
      assert.ok(
        box.width >= 44 && box.height >= 44,
        `${label}: ${box.width}x${box.height}`,
      );
    }
  });
  await run("J", async () => {
    const calls = [],
      track = (request) => {
        if (new URL(request.url()).pathname === "/api/v1/breeders")
          calls.push(request.url());
      };
    page.on("request", track);
    try {
      await go(
        `/breeders?${new URLSearchParams({ q: name, species: "cat", breedId: breed.id, page: "2" })}`,
      );
      assert.equal(new URL(page.url()).searchParams.has("breedId"), false);
      assert.equal(new URL(page.url()).searchParams.has("page"), false);
      assert.ok(
        calls.every((url) => !new URL(url).searchParams.has("breedId")),
        "no incompatible results request before label resolution",
      );
      await page.reload();
      await page.waitForLoadState("networkidle");
      assert.equal(new URL(page.url()).searchParams.has("breedId"), false);
      await go(
        `/breeders?${new URLSearchParams({ q: name, breedId: randomUUID(), locationId: randomUUID(), page: "2" })}`,
      );
      assert.equal(new URL(page.url()).searchParams.has("breedId"), false);
      assert.equal(new URL(page.url()).searchParams.has("locationId"), false);
      assert.equal(await cards().count(), 24);
      await go(
        `/breeders?${new URLSearchParams({ q: "  " + name.toLocaleUpperCase("uk-UA") + "  " })}`,
      );
      assert.equal(await cards().count(), 24);
      assert.equal(
        new URL(page.url()).searchParams.get("q"),
        name.toLocaleUpperCase("uk-UA"),
      );
      await go(`/breeders?q=&species=nope&page=0&breedId=bad&limit=999`);
      assert.equal(page.url(), base + "/breeders");
    } finally {
      page.off("request", track);
    }
  });
  await run("K", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await go(filteredUrl);
    const y = () =>
      cards()
        .first()
        .evaluate((node) => node.getBoundingClientRect().top + scrollY);
    for (const label of ["Вид тварини", "Порода", "Місто"]) {
      const control = page.getByRole("combobox", { name: label, exact: true });
      await control.scrollIntoViewIfNeeded();
      const before = await y();
      await control.click();
      // Opening is layout-neutral. Editing a selected reference deliberately
      // clears its selection chip and may change field height.
      assert.ok(Math.abs((await y()) - before) <= 1, label + " layout shift");
      if (label === "Місто")
        await control.fill("Світло14Е" + marker.slice(0, 8));
      const menu = page.locator('[role="listbox"]:visible').last();
      await menu.waitFor();
      const box = await menu.boundingBox();
      assert.ok(
        box.x >= 0 &&
          box.x + box.width <= 376 &&
          box.y >= 0 &&
          box.y + box.height <= 813,
      );
      const topmost = await menu.evaluate((node) => {
        const b = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(
            b.x + b.width / 2,
            b.y + Math.min(20, b.height / 2),
          ),
        );
      });
      assert.ok(topmost, label + " z-index");
      await control.press("ArrowDown");
      await control.press("Escape");
      assert.equal(await control.getAttribute("aria-expanded"), "false");
      assert.equal(
        await control.evaluate((node) => node === document.activeElement),
        true,
      );
      await control.click();
      await page.locator("h1").click();
      assert.equal(await control.getAttribute("aria-expanded"), "false");
    }
    const city = page.getByRole("combobox", { name: "Місто", exact: true });
    await city.fill("Тестова область");
    await page
      .getByText("Нічого не знайдено. Спробуйте іншу назву.", { exact: true })
      .waitFor();
    await city.press("Escape");
    await city.fill("С");
    assert.equal(await page.getByRole("option").count(), 0);
    await city.press("Tab");
    const trigger = page.getByRole("button", {
      name: "Відкрити меню",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Меню", exact: true });
    await dialog
      .getByRole("link", { name: "Розплідники", exact: true })
      .click();
    await page.waitForURL("**/breeders");
    assert.equal(await dialog.isVisible(), false);
  });
  await run("L", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const handler = async (route) => {
      await gate;
      await route.continue().catch(() => {});
    };
    await page.route("**/api/v1/breeders?**", handler);
    await page.goto(base + filteredUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".breeder-directory-skeleton").first().waitFor();
    assert.equal(
      await page
        .getByRole("searchbox", { name: "Пошук", exact: true })
        .isEnabled(),
      true,
    );
    release();
    await cards().first().waitFor();
    await page.unroute("**/api/v1/breeders?**", handler);
    const fail = (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"message":"PRIVATE SQL diagnostic"}',
      });
    await page.route("**/api/v1/breeders?**", fail);
    await go(filteredUrl);
    await page
      .getByText("Не вдалося завантажити розплідники.", { exact: true })
      .waitFor();
    assert.ok(
      !(await page.locator("main").innerText()).includes("PRIVATE SQL"),
    );
    await page.unroute("**/api/v1/breeders?**", fail);
    await page
      .getByRole("button", { name: "Спробувати ще раз", exact: true })
      .click();
    await cards().first().waitFor();
    const empty = (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: {
            page: 1,
            limit: 24,
            total: 0,
            pages: 0,
            hasPublicBreeders: false,
          },
        }),
      });
    await page.route("**/api/v1/breeders?**", empty);
    await go("/breeders");
    await page
      .getByRole("heading", { name: "Розплідників поки немає", exact: true })
      .waitFor();
    await page.unroute("**/api/v1/breeders?**", empty);
    await go(filteredUrl + "&page=100000");
    await page
      .getByRole("link", { name: "До першої сторінки", exact: true })
      .click();
    await cards().first().waitFor();
    assert.equal(new URL(page.url()).searchParams.has("page"), false);
  });
  await run("M", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const detail = "/sellers/" + fixture.owner;
    const before = await publicData();
    for (const data of before.data)
      assert.ok(
        !JSON.stringify(data).match(
          /email|passwordHash|PRIVATE_|phone|authSession|moderationReason/,
        ),
      );
    await go(detail);
    assert.equal(await page.locator("h1").innerText(), fixture.kennelName);
    await page.waitForFunction(
      () =>
        document
          .querySelector('.desktop-navigation a[href="/breeders"]')
          ?.getAttribute("aria-current") === "page",
    );
    assert.equal(await page.locator(".breeder-animal-card").count(), 2);
    assert.ok(
      (
        await page
          .locator(`[data-pet-id="${fixture.pets[0].id}"] img`)
          .getAttribute("src")
      ).includes("profile.png"),
    );
    assert.ok(
      (
        await page
          .locator(`[data-pet-id="${fixture.pets[1].id}"] img`)
          .getAttribute("src")
      ).includes("listing.png"),
    );
    assert.equal(
      await page.locator(".seller-profile-listings .listing-card").count(),
      1,
    );
    assert.equal(
      await page.locator(".profile-mating-section .listing-card").count(),
      1,
    );
    assert.equal(
      await page.locator(".profile-mating-section .listing-card h3").count(),
      1,
    );
    assert.equal(
      await page
        .locator(".profile-mating-section .listing-card h3")
        .evaluate((node) => getComputedStyle(node).webkitLineClamp),
      "2",
    );
    for (const id of fixture.listingIds.slice(1))
      assert.equal(await page.locator(`a[href="/listings/${id}"]`).count(), 0);
    for (const id of fixture.matingIds.slice(1))
      assert.equal(await page.locator(`a[href^="/mating/${id}"]`).count(), 0);
    assert.ok(
      !(await page.locator("main").innerText()).match(
        /PRIVATE_PET|PRIVATE_HEALTH|@example.invalid/,
      ),
    );
    for (const id of [fixture.viewer.id, fixture.incomplete.id]) {
      const response = await page.request.get(api + "/breeders/" + id);
      assert.equal(response.status(), 404);
      assert.ok(!before.data.some((row) => row.userId === id));
    }
    await go("/login");
    await page
      .getByLabel("Електронна адреса", { exact: true })
      .fill(fixture.viewer.email);
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("Phase14E-local-only!");
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL("**/account");
    await go(filteredUrl);
    assert.deepEqual(await publicData(), before);
    await go(detail);
    assert.equal(
      await page
        .locator('.desktop-navigation a[href="/breeders"]')
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      await page
        .locator(
          '.site-header a[href="/account"][aria-current], .site-header a[href="/my-listings"][aria-current]',
        )
        .count(),
      0,
    );
    await go("/account");
    await page
      .getByRole("button", { name: "Вийти з акаунта", exact: true })
      .click();
    await page.waitForURL("**/login");
    await go(filteredUrl);
    assert.deepEqual(await publicData(), before);
  });
  await run("N", async () => {
    await go(filteredUrl);
    const card = page.locator(
      `a.breeder-directory-card[href="/sellers/${fixture.owner}"]`,
    );
    assert.equal(
      await card.locator(".breeder-directory-more").innerText(),
      "+4",
    );
    assert.equal(
      await card.locator(".breeder-directory-species").innerText(),
      "Собаки та коти",
    );
    const box = await card.locator(".breeder-directory-logo").boundingBox();
    assert.equal(box.width, 56);
    assert.equal(box.height, 56);
    assert.equal(await card.locator("img").getAttribute("loading"), "lazy");
    assert.equal(
      await card.locator(".breeder-directory-description").count(),
      1,
    );
    assert.equal(
      await page.locator(`a[href="/sellers/${fixture.owner}"] button`).count(),
      0,
    );
    await card.focus();
    assert.equal(
      await card.evaluate((node) => getComputedStyle(node).outlineStyle),
      "solid",
    );
    for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await go(filteredUrl);
      const columns = await page
        .locator(".breeder-directory-grid")
        .evaluate(
          (node) =>
            getComputedStyle(node).gridTemplateColumns.split(" ").length,
        );
      assert.equal(columns, width <= 600 ? 1 : width <= 1023 ? 2 : 3);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const logo = page.locator(".site-header > .brand img"),
        geometry = await logo.boundingBox();
      assert.ok(
        geometry.x >= 0 &&
          geometry.x + geometry.width <= width &&
          Math.abs(geometry.width / geometry.height - 1442 / 318) < 0.02,
      );
      assert.equal(
        await page
          .locator(
            "select, input[type=date], input[type=time], .brand-mark, .brand-dot",
          )
          .count(),
        0,
      );
      const copy = await page.locator("main").innerText();
      assert.ok(
        !/Animal type|No results|Loading|\bSelect\b|\bSearch\b/.test(copy),
      );
      assert.equal(await page.locator("h1").count(), 1);
      if (width < 1024) {
        await page
          .getByRole("button", { name: "Відкрити меню", exact: true })
          .click();
        const dialog = page.getByRole("dialog", { name: "Меню", exact: true });
        assert.equal(await dialog.locator(".brand-logo").count(), 1);
        await page.keyboard.press("Escape");
      }
      if ([375, 768, 1440].includes(width))
        await page.screenshot({
          path: `test-results/phase14e-final-${width}.png`,
        });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.ok(
      await card.evaluate((node) =>
        getComputedStyle(node)
          .transitionDuration.split(",")
          .every((value) => parseFloat(value) <= 0.01),
      ),
    );
  });
}
