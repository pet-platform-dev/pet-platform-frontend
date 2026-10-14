import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/features/notifications/model.ts");
const { NotificationItem } = await load(
  "src/features/notifications/notification-item.tsx",
);
const { NotificationBell } = await load(
  "src/features/notifications/notification-bell.tsx",
);
const { notificationKeys } = await load("src/features/notifications/cache.ts");
const api = await load("src/features/notifications/api.ts");
const auth = await load("src/shared/api/client.ts");
const id = "76277b42-4a76-5c79-ab69-31acb61de011";
for (const [type, title, href] of [
  ["MODERATION_APPROVED", "Оголошення схвалено", `/listings/${id}/edit`],
  ["MODERATION_REJECTED", "Оголошення відхилено", `/listings/${id}/edit`],
  [
    "MODERATION_HIDDEN",
    "Оголошення про в’язку приховано",
    `/mating/${id}/edit`,
  ],
  ["REPORT_RESOLVED", "Вашу скаргу опрацьовано", null],
])
  test(`${type} renders Ukrainian snapshot and safe owned route without raw enum`, () => {
    const item = model.notificationSchema.parse({
      id,
      type,
      title,
      href,
      body: "Перегляньте оголошення у своєму кабінеті.",
      readAt: null,
      createdAt: "2026-10-14T12:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      React.createElement(NotificationItem, {
        item,
        pending: false,
        onRead() {},
      }),
    );
    assert.ok(html.includes(title));
    assert.ok(!html.includes(type));
    assert.ok(html.includes("Непрочитане"));
    if (href) {
      assert.ok(html.includes(`href="${href}"`));
      assert.ok(href.endsWith("/edit"));
    } else assert.doesNotMatch(html, /<a /);
    assert.doesNotMatch(html, /<select/);
  });
test("bell reflects a new unread count obtained from API truth without listing-derived count", async () => {
  const saved = globalThis.fetch;
  const client = new QueryClient();
  let unread = 1;
  const reply = (data) =>
    new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf")) return reply({ csrfToken: "csrf" });
    if (url.endsWith("/login"))
      return reply({
        user: { id: "owner" },
        accessToken: "fixture",
        expiresIn: 900,
      });
    assert.ok(url.endsWith("/notifications/unread-count"));
    return reply({ count: unread });
  };
  try {
    await auth.signIn("login", {});
    client.setQueryData(["current-user"], { id: "owner" });
    const render = () =>
      renderToStaticMarkup(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(NotificationBell),
        ),
      );
    const update = () =>
      client.fetchQuery({
        queryKey: notificationKeys.unreadCount("owner"),
        queryFn: () => api.getUnreadCount(),
        staleTime: 0,
      });
    await update();
    assert.match(render(), /непрочитаних: 1/);
    unread = 2;
    await update();
    assert.match(render(), /непрочитаних: 2/);
  } finally {
    globalThis.fetch = saved;
    auth.clearSession();
    client.clear();
  }
});
