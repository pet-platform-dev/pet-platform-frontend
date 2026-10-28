import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { adminBrowserFixture } from "../../pet-platform-backend/test/helpers/admin-browser-fixture.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const base = process.env.BREEDER_WORKSPACE_UI_URL ?? "http://localhost:3019";
assert.equal(new URL(base).hostname, "localhost");
const fixture = await adminBrowserFixture();
const out = "test-results/phase18f1-breeds",
  results = [];
await mkdir(out, { recursive: true });
let browser;
try {
  // Actual Nest controller/DTO/service/PostgreSQL, including the exact reported query.
  const legacy = await fetch(
    "http://localhost:4018/api/v1/breeds?species=01e4e44e-6c70-4188-ab44-b17d3b66caad&search=&page=1&limit=50&sort=name_asc",
  );
  const rejection = await legacy.json();
  assert.equal(legacy.status, 400);
  assert.deepEqual(rejection.details, [
    { field: "species", message: "Оберіть собаку або кота" },
  ]);
  console.log(
    JSON.stringify({
      reportedStatus: legacy.status,
      reportedValidation: rejection,
    }),
  );
  const speciesResponse = await fetch("http://localhost:4018/api/v1/species");
  assert.equal(speciesResponse.status, 200);
  const species = (await speciesResponse.json()).data;
  async function api(slug, extra = {}) {
    const params = new URLSearchParams({
      species: slug,
      search: "",
      page: "1",
      limit: "50",
      sort: "name_asc",
      ...extra,
    });
    const response = await fetch(
      "http://localhost:4018/api/v1/breeds?" + params,
    );
    const data = await response.json();
    assert.equal(response.status, 200, JSON.stringify(data));
    assert(
      data.data.every(
        (b) => b.speciesId === species.find((s) => s.slug === slug).id,
      ),
    );
    return data;
  }
  for (const slug of ["dog", "cat"]) {
    const first = await api(slug, { limit: "2" }),
      second = await api(slug, { limit: "2", page: "2" });
    assert.equal(first.data.length, 2);
    assert.equal(second.meta.page, 2);
    assert(first.data.every((a) => !second.data.some((b) => a.id === b.id)));
    const term = first.data[0].name.slice(0, 4);
    assert(
      (await api(slug, { search: term })).data.some(
        (b) => b.id === first.data[0].id,
      ),
    );
    const all = await api(slug, { limit: "100" }),
      desc = await api(slug, { limit: "100", sort: "name_desc" });
    if (all.meta.total <= 100)
      assert.deepEqual(
        desc.data.map((b) => b.id),
        all.data.map((b) => b.id).reverse(),
      );
    const expectedDesc = await fixture.db.breed.findMany({
      where: { isActive: true, species: { slug } },
      select: { id: true },
      orderBy: [{ name: "desc" }, { id: "asc" }],
      take: 100,
    });
    assert.deepEqual(
      desc.data.map((b) => b.id),
      expectedDesc.map((b) => b.id),
    );
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [375, 768, 1440]) {
    const admin = await fixture.user("ADMIN"),
      context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
    const page = await context.newPage(),
      errors = [],
      xhr = [];
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|same key|two children/i.test(m.text())
      )
        errors.push(m.text());
    });
    let failTerm;
    await context.route("**/api/v1/**", (route) => {
      const u = new URL(route.request().url());
      if (
        u.pathname === "/api/v1/breeds" &&
        failTerm &&
        u.searchParams.get("search") === failTerm
      ) {
        failTerm = undefined;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          headers: {
            "Access-Control-Allow-Origin": new URL(base).origin,
            "Access-Control-Allow-Credentials": "true",
          },
          body: JSON.stringify({ message: "Синтетична тимчасова помилка" }),
        });
      }
      return route.continue({
        url: "http://localhost:4018" + u.pathname + u.search,
      });
    });
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (u.pathname === "/api/v1/breeds")
        xhr.push({ query: u.search, status: r.status() });
    });
    try {
      await fixture.login(context, admin);
      await page.goto(base + "/admin/breeders/new");
      await page.getByLabel(/Назва розплідника/).fill("Синтетичний тест порід");
      const selected = [];
      for (const slug of ["dog", "cat"]) {
        const control = page.getByRole("combobox", {
          name: "Вид тварини",
          exact: true,
        });
        await control.click();
        // Before-fix reproduction deliberately reaches the real failing XHR, even with the old English label.
        const group = slug === "dog" ? "Собаки" : "Коти";
        await page
          .getByRole("option", {
            name: new RegExp(`^(${group}|${slug === "dog" ? "Dog" : "Cat"})$`),
          })
          .click();
        const responsePromise = page.waitForResponse((r) => {
          const u = new URL(r.url());
          return (
            u.pathname === "/api/v1/breeds" &&
            Boolean(u.searchParams.get("species")) &&
            u.searchParams.get("search") === ""
          );
        });
        const input = page.getByRole("combobox", {
          name: /^Породи/,
        });
        const [response] = await Promise.all([
          responsePromise,
          control.press("Tab"),
        ]);
        const payload = await response.json();
        assert.equal(
          response.status(),
          200,
          JSON.stringify({
            actualQuery: new URL(response.url()).search,
            validation: payload,
          }),
        );
        assert.equal(await control.innerText().then((s) => s.trim()), group);
        assert.equal(new URL(response.url()).searchParams.get("species"), slug);
        assert(payload.data.length > 0);
        assert(
          payload.data.every(
            (b) => b.speciesId === species.find((s) => s.slug === slug).id,
          ),
        );
        if (payload.meta.pages > 1) {
          const nextPage = page.waitForResponse((r) => {
            const u = new URL(r.url());
            return (
              u.pathname === "/api/v1/breeds" &&
              u.searchParams.get("species") === slug &&
              u.searchParams.get("page") === "2" &&
              u.searchParams.get("search") === ""
            );
          });
          const list = page.getByRole("listbox", {
            name: "Доступні: Породи",
            exact: true,
          });
          const [nextResponse] = await Promise.all([
            nextPage,
            list.evaluate((el) =>
              el.scrollTo({ top: el.scrollHeight, behavior: "instant" }),
            ),
          ]);
          assert.equal(nextResponse.status(), 200);
          const nextPayload = await nextResponse.json();
          assert(
            nextPayload.data.every(
              (b) => b.speciesId === species.find((s) => s.slug === slug).id,
            ),
          );
          assert(
            payload.data.every(
              (a) => !nextPayload.data.some((b) => a.id === b.id),
            ),
          );
        }
        const breed = payload.data[0],
          label = breed.nameUk?.trim() || breed.name;
        const term = breed.name.slice(0, 4);
        const searched = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/v1/breeds" &&
            new URL(r.url()).searchParams.get("search") === term,
        );
        const [searchResponse] = await Promise.all([
          searched,
          input.fill(term),
        ]);
        assert.equal(searchResponse.status(), 200);
        await page.getByRole("option", { name: label, exact: true }).click();
        selected.push(breed);
        await page
          .getByRole("list", { name: "Обрані: Породи", exact: true })
          .getByText(label, { exact: true })
          .waitFor();
      }
      // Empty/error/retry copy and user-driven recovery use real successful responses.
      const input = page.getByRole("combobox", { name: /^Породи/ });
      await input.fill("zzzz-no-such-breed-18f1");
      await page
        .getByText("Нічого не знайдено. Спробуйте іншу назву.", { exact: true })
        .waitFor();
      const retryTerm = selected[1].name.slice(0, 5);
      failTerm = retryTerm;
      await input.fill(retryTerm);
      await page
        .getByText("Не вдалося завантажити список.", { exact: true })
        .waitFor();
      assert.equal(xhr.filter((r) => r.status === 503).length, 1);
      const retry = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/v1/breeds" &&
          new URL(r.url()).searchParams.get("search") === retryTerm &&
          r.status() === 200,
      );
      await Promise.all([
        retry,
        page
          .getByRole("button", { name: "Спробувати ще раз", exact: true })
          .click(),
      ]);
      await input.press("Escape");
      const chips = page.getByRole("list", {
        name: "Обрані: Породи",
        exact: true,
      });
      assert.equal(await chips.locator("li").count(), 2);
      await page.getByRole("button", { name: "Далі", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "2");
      const draftId = new URL(page.url()).searchParams.get("draftId");
      const saved = await fixture.db.operatorBreederDraftBreed.findMany({
        where: { draftId },
      });
      assert.deepEqual(
        saved.map((b) => b.breedId).sort(),
        selected.map((b) => b.id).sort(),
      );
      await page.getByRole("button", { name: "Назад", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("step") === "1");
      assert.equal(await chips.locator("li").count(), 2);
      await page.reload();
      await chips.locator("li").nth(1).waitFor();
      assert.equal(await chips.locator("li").count(), 2);
      assert.deepEqual(errors, []);
      assert(!xhr.some((r) => r.status === 400));
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({ path: `${out}/${width}.png`, fullPage: true });
      results.push({
        width,
        realNestPostgres: true,
        dogCat: true,
        ukrainianLabels: true,
        search: true,
        mixedBreedsPreserved: true,
        backNextRefresh: true,
        explicitRetry: true,
        no400: true,
        noOverflow: true,
        xhr,
      });
    } catch (error) {
      console.error(JSON.stringify({ width, xhr, error: error.message }));
      await page
        .screenshot({ path: `${out}/failure-${width}.png`, fullPage: true })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
  await writeFile(
    out + "/results.json",
    JSON.stringify({ rejection, results }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await fixture.close();
}
