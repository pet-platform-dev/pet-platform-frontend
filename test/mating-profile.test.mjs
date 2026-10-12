import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { PublicProfileMating } = await load(
  "src/features/mating/profile/public-profile-mating.tsx",
);
const { recoverMatingPage, profileMatingHref } = await load(
  "src/features/mating/profile/profile-mating-query.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  id,
  fee: null,
  owner: { id, displayName: "Олександр Єпік" },
  location: { city: "Київ", region: "Київська область" },
  pet: {
    id,
    name: null,
    gender: "MALE",
    birthDate: null,
    species: { id, slug: "dog" },
    breed: null,
    profileImage: null,
  },
};
function html(data) {
  const c = new QueryClient({
    defaultOptions: { queries: { enabled: false } },
  });
  c.setQueryData(["mating-public", "seller", id, 1], data);
  try {
    return renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: c },
        React.createElement(PublicProfileMating, { ownerId: id }),
      ),
    );
  } finally {
    c.clear();
  }
}
test("successful zero total omits profile mating section", () =>
  assert.equal(html({ data: [], meta: { page: 1, total: 0, pages: 0 } }), ""));
test("profile reuses mating card in separate heading without invented Pet name", () => {
  const s = html({ data: [row], meta: { page: 1, total: 1, pages: 1 } });
  assert.match(s, /Оголошення про в’язку/);
  assert.match(s, /mating-public-card/);
  assert.match(s, /class="listings-grid"/);
  assert.match(s, /returnTo=%2Fsellers%2F/);
  assert.doesNotMatch(s, /Без імені/);
  assert.doesNotMatch(s, /Олександр Єпік|Переглянути профіль<\/a>/);
});
test("page shrinking recovers an available page and restores safe profile context", () => {
  assert.equal(recoverMatingPage(2, 1), 1);
  assert.equal(recoverMatingPage(2, 0), 1);
  assert.equal(recoverMatingPage(2, 3), 2);
  assert.equal(profileMatingHref(id, 2), "/sellers/" + id + "?matingPage=2");
});
test("failed profile refresh replaces cached ACTIVE cards with retry, not an empty section", async () => {
  const key = ["mating-public", "seller", id, 1];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(key, {
    data: [row],
    meta: { page: 1, total: 1, pages: 1 },
  });
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => {
      throw new Error("Unavailable");
    },
    retry: false,
  });
  const done = new Promise((resolve) => {
    const stop = observer.subscribe((result) => {
      if (result.isError) {
        stop();
        resolve();
      }
    });
  });
  try {
    await done;
    client.setDefaultOptions({
      queries: { enabled: false, retry: false, gcTime: Infinity },
    });
    const markup = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(PublicProfileMating, { ownerId: id }),
      ),
    );
    assert.match(markup, /Оголошення про в’язку/);
    assert.match(markup, /Спробувати ще раз/);
    assert.doesNotMatch(markup, /mating-public-card/);
  } finally {
    client.clear();
  }
});
