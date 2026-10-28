import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { SellerIdentity } = await load(
  "src/entities/seller/seller-identity.tsx",
);
const { sellerName } = await load(
  "src/entities/listing/model/detail-presentation.ts",
);
const { sellerSchema } = await load("src/entities/seller/model.ts");
const seller = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Олександр Єпік",
  location: null,
  phone: null,
  telegram: null,
  viber: null,
  whatsapp: null,
  memberSince: "2026-10-28",
  breeder: {
    kennelName: "Silver Paw Malinois",
    logoUrl: "https://example.invalid/logo.png",
  },
};
test("listing identity uses breeder name/logo and canonical owner route", () => {
  const parsed = sellerSchema.parse(seller);
  const html = renderToStaticMarkup(
    React.createElement(SellerIdentity, { seller: parsed }),
  );
  assert.match(html, /Silver Paw Malinois/);
  assert.match(html, /Розплідник/);
  assert.match(html, /logo.png/);
  assert.match(html, new RegExp("/sellers/" + seller.id));
  assert(!html.includes(seller.displayName));
  assert.equal(sellerName(parsed), "Silver Paw Malinois");
});
test("personal listing of breeder owner preserves registered full name", () => {
  assert.equal(sellerName({ ...seller, breeder: null }), "Олександр Єпік");
});
