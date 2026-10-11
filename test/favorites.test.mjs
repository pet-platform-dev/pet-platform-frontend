import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { favoriteLoginReturn, favoriteLoginHref } = await load(
  "src/features/favorites/login-return.ts",
);
const {
  favoriteStateKey,
  optimisticFavorite,
  rollbackFavorite,
  lockFavorite,
  unlockFavorite,
} = await load("src/features/favorites/cache.ts");
const { FavoriteButton } = await load(
  "src/features/favorites/favorite-button.tsx",
);
const { FavoritesPage } = await load(
  "src/features/favorites/favorites-page.tsx",
);
const { isSessionQuery, clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
function client() {
  const c = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  c.setQueryData(["current-user"], { id: "owner" });
  return c;
}
function render(c, component, props) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(component, props),
    ),
  );
}
test("auth preserves filtered catalog, detail and favorites; rejects external or ambiguous targets", () => {
  for (const path of [
    "/listings?q=сві&sort=oldest&page=2",
    "/favorites",
    "/listings/45b62860-314e-484e-8888-a904901aaaaa",
  ]) {
    assert.equal(favoriteLoginReturn(path), path);
    assert.equal(
      new URL(
        favoriteLoginHref(path),
        "https://local.invalid",
      ).searchParams.get("returnTo"),
      path,
    );
  }
  for (const value of [
    undefined,
    [],
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/listings/../account",
    "/listings#evil",
    "javascript:alert(1)",
    "/admin",
  ])
    assert.equal(favoriteLoginReturn(value), "/account");
});
test("heart has SVG, accessible add/remove names, pressed state and button semantics", () => {
  const c = client();
  c.setQueryData(favoriteStateKey("owner", "listing"), false);
  let html = render(c, FavoriteButton, { listingId: "listing" });
  assert.match(html, /type="button"/);
  assert.match(html, /Додати в обране/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /<svg/);
  c.setQueryData(favoriteStateKey("owner", "listing"), true);
  html = render(c, FavoriteButton, { listingId: "listing", detail: true });
  assert.match(html, /Видалити з обраного/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /В обраному/);
  c.clear();
});
test("anonymous heart stays actionable after session is checked; unresolved state waits", () => {
  const c = client();
  c.setQueryData(["current-user"], null);
  assert.doesNotMatch(
    render(c, FavoriteButton, { listingId: "listing" }),
    /\sdisabled=/,
  );
  c.setQueryData(["current-user"], { id: "owner" });
  assert.match(
    render(c, FavoriteButton, { listingId: "listing" }),
    /\sdisabled=/,
  );
  c.clear();
});
test("optimistic add updates shared state without touching public listing/reference/session caches", () => {
  const c = client();
  c.setQueryData(["listings", {}], { data: ["public"] });
  c.setQueryData(["favorite-state", "other", "a"], true);
  c.setQueryData(favoriteStateKey("owner", "a"), false);
  const snap = optimisticFavorite(c, "owner", "a", true);
  assert.equal(c.getQueryData(favoriteStateKey("owner", "a")), true);
  rollbackFavorite(c, "owner", "a", snap);
  assert.equal(c.getQueryData(favoriteStateKey("owner", "a")), false);
  assert.deepEqual(c.getQueryData(["listings", {}]), { data: ["public"] });
  assert.equal(c.getQueryData(["favorite-state", "other", "a"]), true);
  c.clear();
});
test("removal immediately removes page card and final item adjusts total/pages", () => {
  const c = client();
  const key = ["favorites", "owner", 1];
  c.setQueryData(key, {
    data: [{ id: "a" }],
    meta: { page: 1, limit: 24, total: 1, pages: 1 },
  });
  c.setQueryData(favoriteStateKey("owner", "a"), true);
  const snap = optimisticFavorite(c, "owner", "a", false);
  assert.deepEqual(c.getQueryData(key).data, []);
  assert.equal(c.getQueryData(key).meta.pages, 0);
  assert.match(render(c, FavoritesPage), /В обраному поки нічого немає/);
  assert.match(render(c, FavoritesPage), /Переглянути оголошення/);
  rollbackFavorite(c, "owner", "a", snap);
  assert.equal(c.getQueryData(key).data[0].id, "a");
  assert.equal(c.getQueryData(key).meta.total, 1);
  c.clear();
});
test("rollback of one listing does not undo another simultaneous optimistic removal", () => {
  const c = client(),
    key = ["favorites", "owner", 1];
  c.setQueryData(key, {
    data: [{ id: "a" }, { id: "b" }, { id: "c" }],
    meta: { page: 1, limit: 24, total: 3, pages: 1 },
  });
  const a = optimisticFavorite(c, "owner", "a", false);
  optimisticFavorite(c, "owner", "b", false);
  rollbackFavorite(c, "owner", "a", a);
  assert.deepEqual(
    c.getQueryData(key).data.map((x) => x.id),
    ["a", "c"],
  );
  assert.equal(c.getQueryData(key).meta.total, 2);
  c.clear();
});
test("rapid repeated toggles share one owner/listing lock and release cleanly", () => {
  const c = client();
  assert.equal(lockFavorite(c, "owner", "a"), true);
  assert.equal(lockFavorite(c, "owner", "a"), false);
  assert.equal(lockFavorite(c, "owner", "b"), true);
  unlockFavorite(c, "owner", "a");
  assert.equal(lockFavorite(c, "owner", "a"), true);
  c.clear();
});
test("late mutation after logout/account switch cannot restore private favorite state", () => {
  const c = client();
  c.setQueryData(favoriteStateKey("owner", "a"), true);
  const snap = optimisticFavorite(c, "owner", "a", false);
  c.setQueryData(["current-user"], { id: "other" });
  clearPrivateQueries(c);
  rollbackFavorite(c, "owner", "a", snap);
  optimisticFavorite(c, "owner", "a", true);
  assert.equal(c.getQueryData(favoriteStateKey("owner", "a")), undefined);
  c.clear();
});
test("all favorite families are private session caches, public catalog remains public", () => {
  for (const kind of ["favorites", "favorite-state", "favorite-batch"])
    assert.equal(isSessionQuery({ queryKey: [kind, "owner"] }), true);
  assert.equal(isSessionQuery({ queryKey: ["listings"] }), false);
});
