import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { sellerSchema, profileInputSchema, messengerLinks } = await load(
  "src/entities/seller/model.ts",
);
const { SellerCard, SellerContacts } = await load(
  "src/entities/seller/seller-card.tsx",
);
const { ListingGallery, lightboxUrl } = await load(
  "src/entities/listing/ui/listing-gallery.tsx",
);
const { SellerProfile } = await load(
  "src/widgets/seller-profile/seller-profile.tsx",
);
const { isSessionQuery } = await load("src/features/auth/session-provider.tsx");
const seller = {
  id: "d4fe3bf7-b743-4859-93c4-af926da7fcbd",
  displayName: "Олександр Єпік",
  location: null,
  phone: null,
  telegram: null,
  viber: null,
  whatsapp: null,
  memberSince: "2026-10-09T00:00:00Z",
};
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
const input = {
  phone: "",
  telegram: "",
  viber: "",
  whatsapp: "",
};
test("full public name links to stable seller profile without abbreviation or private metadata", () => {
  const html = render(SellerCard, { seller });
  assert.ok(html.includes("Олександр Єпік"));
  assert.ok(html.includes(`/sellers/${seller.id}`));
  assert.ok(!html.includes("Приватний продавець"));
  assert.ok(!html.includes("Олександр Є."));
});
test("no contacts render no empty or disabled controls", () => {
  const html = render(SellerContacts, { seller });
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes("<a"));
});
for (const [field, value] of [
  ["phone", "+380501234567"],
  ["telegram", "Oleksandr_21_08"],
  ["viber", "+380501234568"],
  ["whatsapp", "+380501234569"],
]) {
  test(`${field} is independently optional and valid`, () => {
    assert.ok(
      profileInputSchema.safeParse({ ...input, [field]: value }).success,
    );
  });
  test(`only ${field} contact renders its control`, () => {
    const html = render(SellerContacts, {
      seller: { ...seller, [field]: value },
    });
    assert.ok(
      html.includes(
        field === "phone"
          ? "Показати телефон"
          : field === "whatsapp"
            ? "WhatsApp"
            : field === "viber"
              ? "Viber"
              : "Telegram",
      ),
    );
    assert.ok(!html.includes("disabled"));
    if (field === "phone") assert.ok(!html.includes(value));
  });
}
test("all optional inputs may be blank; public contacts may all be null", () => {
  assert.ok(profileInputSchema.safeParse(input).success);
  assert.deepEqual(
    sellerSchema.parse({
      ...seller,
      email: "private@example.invalid",
      passwordHash: "private",
    }),
    seller,
  );
});
test("derived seller name accepts both full registration fields without abbreviation", () => {
  const fullName = `${"І".repeat(100)} ${"Є".repeat(100)}`;
  assert.equal(
    sellerSchema.parse({ ...seller, displayName: fullName }).displayName,
    fullName,
  );
  assert.ok(!Object.hasOwn(profileInputSchema.parse(input), "displayName"));
});
test("safe messenger URLs use validated username and independent normalized phones", () => {
  assert.deepEqual(
    messengerLinks({
      ...seller,
      telegram: "Oleksandr_21_08",
      viber: "+380501234568",
      whatsapp: "+380501234569",
    }).map((link) => link.href),
    [
      "https://t.me/Oleksandr_21_08",
      "viber://chat?number=%2B380501234568",
      "https://wa.me/380501234569",
    ],
  );
});
test("malicious contact URLs and invalid phones are rejected with Ukrainian validation", () => {
  for (const field of ["phone", "telegram", "viber", "whatsapp"])
    for (const value of [
      "javascript:alert(1)",
      "https://evil.test",
      "bad/name",
    ]) {
      const result = profileInputSchema.safeParse({ ...input, [field]: value });
      assert.equal(result.success, false);
      assert.match(result.error.issues[0].message, /[А-Яа-яІі]/);
    }
});
test("profile query is private while seller and seller listings stay public", () => {
  assert.ok(isSessionQuery({ queryKey: ["profile", seller.id] }));
  for (const key of ["seller", "seller-listings"])
    assert.equal(isSessionQuery({ queryKey: [key, seller.id] }), false);
});
function gallery(count) {
  return {
    images: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      url: `https://res.cloudinary.com/fixture/image/upload/f_auto,q_auto,c_limit,w_1200/v1/${i}.png`,
      thumbnailUrl: `https://res.cloudinary.com/fixture/image/upload/f_auto,q_auto,c_fill,w_480,h_360/v1/${i}.png`,
    })),
    pet: {
      species: { slug: "dog" },
      breed: { name: "Malinois", nameUk: "Малінуа" },
    },
  };
}
test("zero gallery retains honest placeholder without modal or arrows", () => {
  const html = render(ListingGallery, { listing: gallery(0) });
  assert.ok(html.includes("Фото ще не додано"));
  assert.ok(!html.includes("<dialog"));
});
test("one photo allows fullscreen and counter but no next/previous or thumbnails", () => {
  const html = render(ListingGallery, { listing: gallery(1) });
  assert.ok(html.includes("Відкрити фото на весь екран"));
  assert.ok(html.includes("1 / 1"));
  assert.ok(!html.includes("Попереднє фото"));
  assert.ok(!html.includes("Наступне фото"));
});
for (const count of [2, 10])
  test(`${count} photos expose arrows, accessible counter and selected thumbnail`, () => {
    const html = render(ListingGallery, { listing: gallery(count) });
    assert.ok(html.includes("Попереднє фото"));
    assert.ok(html.includes("Наступне фото"));
    assert.equal(
      (html.match(/class="gallery-arrow [^"]+"[^>]*><svg/g) || []).length,
      2,
    );
    assert.ok(!html.includes("‹") && !html.includes("›"));
    assert.ok(html.includes(`1 / ${count}`));
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.equal((html.match(/Показати фото/g) || []).length, count);
  });
test("lightbox upgrades only bounded optimized URL to 1800px, preserving provider path", () => {
  const image = gallery(1).images[0].url;
  assert.ok(lightboxUrl(image).includes("w_1800"));
  assert.ok(!lightboxUrl(image).includes("w_1200"));
  const original =
    "https://res.cloudinary.com/fixture/image/upload/v1/test.png";
  assert.ok(
    lightboxUrl(original).includes(
      "/image/upload/f_auto,q_auto,c_limit,w_1800/v1/",
    ),
  );
});
test("public profile handles empty ACTIVE list without private status hints", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["seller", seller.id], seller);
  client.setQueryData(["seller-listings", seller.id], {
    pages: [{ data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } }],
    pageParams: [1],
  });
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(SellerProfile, { id: seller.id }),
    ),
  );
  assert.ok(html.includes("Олександр Єпік"));
  assert.ok(html.includes("поки немає активних оголошень"));
  assert.ok(!html.includes("DRAFT"));
  client.clear();
});
