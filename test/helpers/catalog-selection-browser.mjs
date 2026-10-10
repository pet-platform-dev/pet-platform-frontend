import assert from "node:assert/strict";
export async function catalogSelectionBrowser({
  page,
  data,
  step,
  clear,
  scope,
  pass,
}) {
  const breed = page.getByRole("combobox", { name: /^Породи/ });
  const location = page.getByRole("combobox", {
    name: /^Місто або село/,
  });
  const region = page.getByRole("combobox", { name: /^Область/ });
  const csv = (items) => [...new Set(items)].sort().join(",");
  async function pick(input, term, label) {
    await page.getByLabel("Пошук оголошень", { exact: true }).focus();
    await input.fill(term);
    await input.focus();
    const option = page
      .locator(".reference-results [role=option]")
      .filter({ hasText: label });
    await option.waitFor();
    await option.getByRole("button").click();
  }
  async function layers(input, term, label) {
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.getByLabel("Пошук оголошень", { exact: true }).focus();
      await input.fill(term);
      await input.focus();
      await page.locator(".reference-results [role=option]").first().waitFor();
      await input.scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const dropdown = document.querySelector(".reference-results"),
          box = dropdown.getBoundingClientRect();
        const cards = [
          ...document.querySelectorAll(".catalog-results .listing-card"),
        ].map((card) => card.getBoundingClientRect());
        const overlap = cards.find(
          (card) =>
            Math.min(box.right, card.right) - Math.max(box.left, card.left) >
              8 &&
            Math.min(box.bottom, card.bottom, innerHeight) -
              Math.max(box.top, card.top, 0) >
              8,
        );
        if (!overlap)
          return {
            overlap: false,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        const x = Math.max(box.left, overlap.left) + 4,
          y = Math.max(box.top, overlap.top, 0) + 4;
        return {
          overlap: true,
          above: Boolean(
            document.elementFromPoint(x, y)?.closest(".reference-results"),
          ),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(geometry.overflow, false);
      assert.equal(
        geometry.overlap,
        true,
        "Dropdown must actually overlap a card",
      );
      assert.equal(geometry.above, true, "Dropdown must paint above card");
      await page.screenshot({
        path: "test-results/catalog-layer-" + label + "-" + width + ".png",
      });
      pass(
        width +
          "px: " +
          label +
          " dropdown paints above overlapping cards without overflow",
      );
      await input.press("Escape");
    }
  }
  await clear();
  await scope();
  await step(
    "Multi breed setup",
    () => page.getByRole("radio", { name: "Собаки", exact: true }).check(),
    { species: "dog" },
  );
  await layers(breed, data.marker, "breed");
  const breeds = data.fixture.breeds.slice(0, 2).map((item) => item.id);
  await step(
    "Pick first breed",
    () => pick(breed, data.marker, data.fixture.breeds[0].nameUk),
    { breedIds: breeds[0], page: 1 },
  );
  await step(
    "Add second breed uses sorted CSV OR",
    () => pick(breed, data.marker, data.fixture.breeds[1].nameUk),
    { breedIds: csv(breeds) },
  );
  assert.equal(
    await page
      .getByRole("list", { name: "Обрані: Породи", exact: true })
      .locator("li")
      .count(),
    2,
  );
  await step(
    "Multi selections persist on page two",
    () => page.getByRole("link", { name: "Сторінка 2", exact: true }).click(),
    { breedIds: csv(breeds), page: 2 },
  );
  await step(
    "Remove breed chip resets page one",
    () =>
      page
        .getByRole("button", {
          name: "Видалити: " + data.fixture.breeds[1].nameUk,
          exact: true,
        })
        .click(),
    { breedIds: breeds[0], page: 1 },
  );
  await step(
    "Clear species preserves selected breeds",
    () => page.getByRole("radio", { name: "Усі", exact: true }).check(),
    { species: undefined, breedIds: breeds[0] },
  );
  await step(
    "Compatible dog selection remains",
    () => page.getByRole("radio", { name: "Собаки", exact: true }).check(),
    { species: "dog", breedIds: breeds[0] },
  );
  await step(
    "Incompatible cat change removes dog breed",
    () => page.getByRole("radio", { name: "Коти", exact: true }).check(),
    { species: "cat", breedIds: undefined },
  );
  await clear();
  await scope();
  await layers(location, "Однакова назва", "location");
  const ids = data.fixture.locations.map((item) => item.id);
  await step(
    "First settlement chip",
    () => pick(location, "Однакова назва", data.fixture.locations[0].region),
    { locationIds: ids[0] },
  );
  await step(
    "Second same-name settlement remains distinct OR choice",
    () => pick(location, "Однакова назва", data.fixture.locations[1].region),
    { locationIds: csv(ids) },
  );
  assert.equal(
    await page
      .getByRole("list", { name: "Обрані: Місто або село", exact: true })
      .locator("li")
      .count(),
    2,
  );
  await step(
    "Remove one same-name settlement by contextual chip",
    () =>
      page
        .getByRole("list", { name: "Обрані: Місто або село", exact: true })
        .locator("li")
        .filter({ hasText: data.fixture.locations[0].region })
        .getByRole("button")
        .click(),
    { locationIds: ids[1] },
  );
  const geographic = await step(
    "Region OR settlement outside selected region",
    () => pick(region, "Кіровоградська", data.fixture.locations[0].region),
    { regionIds: "UA35", locationIds: ids[1] },
  );
  assert.equal(geographic.body.meta.total, 37);
  await step(
    "Add second region uses multi OR",
    () => pick(region, "Полтавська", data.fixture.locations[1].region),
    { regionIds: "UA35,UA53", locationIds: ids[1] },
  );
  await step(
    "Breed AND geographic group",
    async () => {
      await page.getByRole("radio", { name: "Собаки", exact: true }).check();
      await pick(breed, data.marker, data.fixture.breeds[0].nameUk);
    },
    {
      species: "dog",
      breedIds: breeds[0],
      regionIds: "UA35,UA53",
      locationIds: ids[1],
    },
  );
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const overflow = await page
      .locator(".reference-chips")
      .evaluateAll((lists) =>
        lists.some((list) => list.scrollWidth > list.clientWidth + 1),
      );
    assert.equal(overflow, false);
    const wrapped = await page
      .getByRole("list", { name: "Обрані: Місто або село", exact: true })
      .locator("strong")
      .first()
      .evaluate((title) => {
        const range = document.createRange();
        range.selectNodeContents(title);
        return range.getClientRects().length > 1;
      });
    assert.equal(
      wrapped,
      true,
      "Long Ukrainian settlement chip title must wrap",
    );
    await page.screenshot({
      path: `test-results/catalog-combined-chips-${width}.png`,
    });
    pass(width + "px: combined long breed/place chips wrap inside the panel");
  }
  await step(
    "Remove region chip preserves remaining choices",
    () =>
      page
        .getByRole("button", {
          name: "Видалити: " + data.fixture.locations[0].region,
          exact: true,
        })
        .click(),
    { regionIds: "UA53", locationIds: ids[1], page: 1 },
  );
  await clear();
  await scope();
  // The bounded local reference list still uses shared virtual scrolling.
  await region.fill("");
  await region.focus();
  await page.locator(".reference-results [role=option]").first().waitFor();
  const first = await page
    .locator(".reference-results [role=option]")
    .first()
    .getAttribute("aria-posinset");
  assert.equal(first, "1");
  await page.locator(".reference-results ul").evaluate((list) => {
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(100);
  const last = page.locator(".reference-results [role=option]").last();
  assert.equal(
    await last.getAttribute("aria-posinset"),
    await last.getAttribute("aria-setsize"),
  );
  await region.press("Escape");
  pass(
    "Region first/last virtual options reachable with no visible pagination",
  );
}
