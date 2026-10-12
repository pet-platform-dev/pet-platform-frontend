import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { DashboardCards } = await load(
  "src/features/auth/account-dashboard.tsx",
);
for (const accountType of ["SELLER", "BREEDER"])
  test(
    accountType + " has direct product actions and conditional breeder card",
    () => {
      const m = renderToStaticMarkup(
        React.createElement(DashboardCards, {
          userId: "11111111-1111-4111-8111-111111111111",
          accountType,
          breederContent: React.createElement(
            "a",
            { href: "/profile/breeder" },
            "Налаштувати профіль розплідника",
          ),
        }),
      );
      for (const href of [
        "/pets",
        "/my-listings",
        "/favorites",
        "/mating/my",
        "/mating/new",
        "/profile",
      ])
        assert.ok(m.includes('href="' + href + '"'));
      assert.match(m, />В’язка</);
      assert.equal(
        m.includes("Налаштувати профіль розплідника"),
        accountType === "BREEDER",
      );
      assert.doesNotMatch(m, /href="\/mating"/);
    },
  );

const { QueryClient, QueryClientProvider } =
  await import("../node_modules/@tanstack/react-query/build/modern/index.js");
const { AccountTypeSettings } = await load(
  "src/features/auth/account-type-settings.tsx",
);
test("account security settings use a subordinate heading", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      React.createElement(AccountTypeSettings, {
        user: { id: "fixture", accountType: "SELLER" },
      }),
    ),
  );
  assert.match(html, /<h3 id="account-type-heading">Тип акаунта<\/h3>/);
});
