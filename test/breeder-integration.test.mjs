import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { navigationActive } = await load(
  "src/widgets/header/navigation-active.ts",
);
const { cachedPublicBreeder } = await load(
  "src/widgets/header/use-public-breeder-navigation.ts",
);
const { Header } = await load("src/widgets/header/header.tsx");
const { MobileNavigation } = await load(
  "src/widgets/header/mobile-navigation.tsx",
);
const { BrandLogo } = await load("src/shared/ui/brand-logo.tsx");
const { BreederProfilePage } = await load(
  "src/features/breeder/public-profile/breeder-profile-page.tsx",
);
const id = "11111111-1111-4111-8111-111111111111";
const profile = {
  userId: id,
  kennelName: "Теплі лапи",
  description: "Про наш розплідник.",
  location: { city: "Світловодськ", region: "Кіровоградська область" },
  contactPerson: {
    id,
    displayName: "Олександр Єпік",
    phone: "+380501112233",
    telegram: null,
    viber: null,
    whatsapp: null,
  },
  startedYear: null,
  website: null,
  media: { logo: null, cover: null, gallery: [], videos: [] },
  breeds: [
    { id, name: "Malinois", nameUk: "Малінуа", species: { slug: "dog" } },
    {
      id: "cat",
      name: "Maine Coon",
      nameUk: "Мейн-кун",
      species: { slug: "cat" },
    },
  ],
};
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
test("only resolved current public breeder profiles activate directory navigation", () => {
  const c = new QueryClient();
  const path = "/sellers/" + id;
  assert.equal(cachedPublicBreeder(c, path), false);
  c.setQueryData(["seller", id], { breeder: { kennelName: "Теплі лапи" } });
  assert.equal(cachedPublicBreeder(c, path), false);
  c.setQueryData(["breeder", id], { userId: id });
  assert.equal(cachedPublicBreeder(c, path), true);
  assert.equal(cachedPublicBreeder(c, "/sellers/other"), false);
  assert.equal(cachedPublicBreeder(c, "/account"), false);
  c.setQueryData(["breeder", id], null);
  assert.equal(cachedPublicBreeder(c, path), false);
  c.setQueryData(["breeder", id], { userId: id });
  c.setQueryData(["seller", id], { breeder: null });
  assert.equal(cachedPublicBreeder(c, path), false);
  c.clear();
  assert.ok(navigationActive("/breeders", "/breeders"));
  assert.ok(navigationActive(path, "/breeders", true));
  assert.ok(!navigationActive(path, "/breeders", false));
  for (const href of ["/account", "/my-listings", "/profile"])
    assert.ok(!navigationActive(path, href, true));
});
test("mobile menu marks only breeders active for a public breeder, with the new brand", () => {
  for (const authenticated of [false, true]) {
    const html = render(MobileNavigation, {
      pathname: "/sellers/" + id,
      authenticated,
      pending: false,
      publicBreeder: true,
    });
    const links = html.match(/<a[^>]+>/g);
    assert.ok(
      links
        .find((a) => a.includes('href="/breeders"'))
        .includes('aria-current="page"'),
    );
    assert.equal(
      links.filter((a) => a.includes('aria-current="page"')).length,
      1,
    );
    assert.ok(html.includes("/brand/logo.png") && html.includes('alt="Лапа"'));
    assert.ok(!html.includes("brand-mark") && !html.includes("✦"));
  }
});
test("desktop/shared header uses a single image brand source and no text approximation", () => {
  const c = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  c.setQueryData(["current-user"], null);
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Header),
    ),
  );
  assert.ok(html.includes('src="/brand/logo.png"'));
  assert.ok(!html.includes("brand-mark") && !html.includes("brand-dot"));
  c.clear();
  const image = render(BrandLogo);
  for (const text of [
    'width="1442"',
    'height="318"',
    'alt="Лапа"',
    'class="brand-logo"',
  ])
    assert.ok(image.includes(text));
});
test("profile identity is singular; species and breed chips precede public sections, contacts follow", () => {
  const children = React.createElement(
    "div",
    null,
    [
      "Наші тварини",
      "Оголошення розплідника",
      "Оголошення про в’язку",
      "Відгуки",
    ].map((t) => React.createElement("h2", { key: t }, t)),
  );
  const html = render(BreederProfilePage, { profile, children });
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.ok(html.includes("Собаки та коти"));
  assert.equal((html.match(/>Малінуа</g) || []).length, 1);
  assert.equal((html.match(/>Світловодськ/g) || []).length, 1);
  const order = [
    "<h1>",
    "Про розплідник",
    "Наші тварини",
    "Оголошення розплідника",
    "Оголошення про в’язку",
    "Відгуки",
    "Контакти",
  ];
  for (let i = 1; i < order.length; i++)
    assert.ok(html.indexOf(order[i]) > html.indexOf(order[i - 1]), order[i]);
  assert.ok(html.includes("breeder-profile-initial"));
  assert.ok(html.includes("Контактна особа: Олександр Єпік"));
  assert.ok(!html.includes("Приватний продавець") && !html.includes("email"));
});
test("empty optional sections stay omitted; full public description is retained once", () => {
  const html = render(BreederProfilePage, {
    profile: {
      ...profile,
      breeds: [],
      description: null,
      location: null,
      contactPerson: { ...profile.contactPerson, phone: null },
    },
  });
  for (const copy of [
    "Про розплідник",
    "Породи розплідника",
    "Контакти",
    "Вебсайт",
    "Досвід",
  ])
    assert.ok(!html.includes(copy));
  assert.equal(
    (
      render(BreederProfilePage, { profile }).match(/Про наш розплідник\./g) ||
      []
    ).length,
    1,
  );
});
test("brand and app icons reserve exact PNG dimensions and retain alpha; favicon uses the paw symbol", async () => {
  for (const [file, w, h] of [
    ["public/brand/logo.png", 1442, 318],
    ["src/app/icon.png", 512, 512],
    ["src/app/apple-icon.png", 180, 180],
  ]) {
    const data = await readFile(file);
    assert.equal(data.toString("ascii", 1, 4), "PNG");
    assert.equal(data.readUInt32BE(16), w);
    assert.equal(data.readUInt32BE(20), h);
    assert.equal(data[25], 6);
  }
  const ico = await readFile("src/app/favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico[6], 32);
  assert.equal(ico[7], 32);
  assert.equal(ico.readUInt16LE(12), 32);
});
