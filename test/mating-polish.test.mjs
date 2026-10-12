import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { QueryClient, QueryClientProvider } =
  await import("../node_modules/@tanstack/react-query/build/modern/index.js");
const { MatingFilterControls } = await load(
  "src/features/mating/catalog/filter-controls.tsx",
);
const { matingValues, valuesQuery } = await load(
  "src/features/mating/catalog/filter-state.ts",
);
const base = { page: 2, limit: 24, sort: "newest" };
const render = (query = base) =>
  renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      React.createElement(MatingFilterControls, {
        values: matingValues(query),
        errors: {},
        onChange() {},
      }),
    ),
  );
test("mating age and fee use accessible shared custom dropdowns and SVG chevrons", () => {
  const html = render();
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /role="combobox"[^>]*aria-label="Вік"/);
  assert.match(html, /role="combobox"[^>]*aria-label="Оплата"/);
  assert.match(html, /Будь-який вік/);
  assert.ok((html.match(/class="filter-field"/g) ?? []).length >= 7);
});
test("legacy zero-based age URLs retain exact month bounds with a readable label", () => {
  const query = { ...base, ageMinMonths: 0, ageMaxMonths: 3 };
  const html = render(query);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /0–3|0 місяц|range:/);
  assert.match(html, /До 3 місяців/);
  assert.deepEqual(valuesQuery(matingValues(query), query), {
    ...query,
    page: 1,
  });
});
test("mating age choices use readable inclusive ranges and preserve URL month boundaries", async () => {
  const { matingAgeOptions, matingAgeChoices } = await load(
    "src/features/mating/catalog/age-options.ts",
  );
  assert.deepEqual(
    matingAgeOptions.map((o) => o.label),
    [
      "Будь-який вік",
      "До 1 року",
      "1–2 роки",
      "2–4 роки",
      "4–6 років",
      "6+ років",
    ],
  );
  for (const [value, bounds] of [
    ["range::12", { ageMaxMonths: 12 }],
    ["12-24", { ageMinMonths: 12, ageMaxMonths: 24 }],
    ["range:24:48", { ageMinMonths: 24, ageMaxMonths: 48 }],
    ["range:48:72", { ageMinMonths: 48, ageMaxMonths: 72 }],
    ["range:72:", { ageMinMonths: 72 }],
  ]) {
    assert.deepEqual(valuesQuery({ ...matingValues(base), age: value }, base), {
      page: 1,
      limit: 24,
      sort: "newest",
      ...bounds,
    });
    assert.equal(matingValues({ ...base, ...bounds }).age, value);
  }
  assert.equal(matingAgeChoices("range:0:0").at(-1).label, "Менше 1 місяця");
  assert.equal(matingAgeChoices("range:0:").at(-1).label, "Вік зазначено");
  assert.equal(
    matingAgeChoices("range:24:60").at(-1).label,
    "Від 2 років до 5 років",
  );
});
