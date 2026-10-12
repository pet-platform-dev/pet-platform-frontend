import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { load } from "./helpers/load-frontend.mjs";
for (const [file, name, label, value, text] of [
  [
    "listing-type-filter",
    "ListingTypeFilter",
    "Тип оголошення",
    "ADOPTION",
    "Прилаштування",
  ],
  ["gender-filter", "GenderFilter", "Стать", "UNKNOWN", "Стать не вказана"],
  ["age-filter", "AgeFilter", "Вік", "range:13:47", "13–47 місяців"],
])
  test(
    label + " is a labeled custom dropdown preserving current value",
    async () => {
      const source = "src/features/listing/filters/" + file + ".tsx";
      assert.doesNotMatch(
        readFileSync(source, "utf8"),
        /<select\b/,
        "ordinary catalog dropdown must use shared component",
      );
      const mod = await load(source);
      const html = renderToStaticMarkup(
        React.createElement(mod[name], { value, onChange() {} }),
      );
      assert.match(html, /role="combobox"/);
      assert.match(html, /<svg/);
      assert.ok(html.includes(text));
      assert.ok(html.includes('data-value="' + value + '"'));
      const id = html.match(/<button id="([^"]+)"/)[1];
      assert.ok(html.includes('for="' + id + '"'));
    },
  );
