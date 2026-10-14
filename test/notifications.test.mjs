import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/features/notifications/model.ts");
const cache = await load("src/features/notifications/cache.ts");
const session = await load("src/features/auth/session-provider.tsx");
const stamp = "2026-10-14T10:00:00.000Z";
const row = {
  id: "76277b42-4a76-5c79-ab69-31acb61de011",
  type: "SYSTEM",
  title: "Новина",
  body: "Текст повідомлення",
  href: "/account",
  readAt: null,
  createdAt: stamp,
};

test("late notification list/count and read mutations cannot complete into a new session", async () => {
  const client = await load("src/shared/api/client.ts");
  const api = await load("src/features/notifications/api.ts");
  const saved = globalThis.fetch;
  const reply = (data) =>
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  try {
    for (const operation of [
      () => api.getNotifications(1),
      () => api.getUnreadCount(),
      () => api.readNotification(row.id),
      () => api.readAllNotifications(),
    ]) {
      let finish,
        started,
        actor = "A",
        calls = 0;
      const ready = new Promise((resolve) => {
        started = resolve;
      });
      globalThis.fetch = async (url) => {
        if (url.endsWith("/csrf")) return reply({ csrfToken: "csrf" });
        if (url.endsWith("/login"))
          return reply({
            user: { id: actor },
            accessToken: actor,
            expiresIn: 900,
          });
        calls++;
        started();
        return new Promise((resolve) => {
          finish = () => resolve(reply({ private: "A" }));
        });
      };
      await client.signIn("login", {});
      const pending = operation();
      const rejected = assert.rejects(
        pending,
        (error) => error.name === "AbortError",
      );
      await ready;
      actor = "B";
      await client.signIn("login", {});
      finish();
      await rejected;
      assert.equal(calls, 1);
    }
  } finally {
    globalThis.fetch = saved;
    client.clearSession();
  }
});
test("badge formatting and accessible count do not expose enum values", () => {
  assert.equal(model.notificationCount(0), "");
  assert.equal(model.notificationCount(3), "3");
  assert.equal(model.notificationCount(100), "99+");
  assert.match(model.notificationLabel(3), /3/);
});
test("unsafe navigation is removed even for a compromised stored DTO", () => {
  for (const href of [
    "https://evil.invalid",
    "//evil.invalid",
    "javascript:alert(1)",
    "/\\evil",
    "/%2fevil",
    "/x/../account",
    "/login?next=//evil.invalid",
    "/%252f%252fevil",
  ])
    assert.equal(model.notificationSchema.parse({ ...row, href }).href, null);
  assert.equal(model.notificationSchema.parse(row).href, "/account");
});
test("private queries and mutation cache are cleared on logout; public cache survives", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id: "A" });
  client.setQueryData(cache.notificationKeys.list("A", 1), { data: [row] });
  client.setQueryData(cache.notificationKeys.unreadCount("A"), { count: 1 });
  client.setQueryData(["listings"], { data: ["public"] });
  const mutation = client
    .getMutationCache()
    .build(client, { mutationKey: ["notifications", "A"] });
  mutation.state.data = row;
  session.clearPrivateQueries(client);
  assert.equal(
    client.getQueryData(cache.notificationKeys.list("A", 1)),
    undefined,
  );
  assert.equal(
    client.getQueryData(cache.notificationKeys.unreadCount("A")),
    undefined,
  );
  assert.equal(client.getMutationCache().getAll().length, 0);
  assert.deepEqual(client.getQueryData(["listings"]), { data: ["public"] });
  client.clear();
});
test("late user A refresh cannot invalidate or populate user B notification queries", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id: "B" });
  client.setQueryData(cache.notificationKeys.unreadCount("B"), { count: 2 });
  await cache.refreshNotifications(client, "A");
  assert.deepEqual(
    client.getQueryData(cache.notificationKeys.unreadCount("B")),
    { count: 2 },
  );
  assert.equal(
    client.getQueryState(cache.notificationKeys.unreadCount("B")).isInvalidated,
    false,
  );
  client.clear();
});
test("bell is absent for anonymous and accessible for authenticated users", async () => {
  const { NotificationBell } = await load(
    "src/features/notifications/notification-bell.tsx",
  );
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  const render = () =>
    renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(NotificationBell),
      ),
    );
  client.setQueryData(["current-user"], null);
  assert.equal(render(), "");
  client.setQueryData(["current-user"], { id: "A" });
  client.setQueryData(cache.notificationKeys.unreadCount("A"), { count: 103 });
  const html = render();
  assert.match(html, /Сповіщення, непрочитаних: 103/);
  assert.match(html, /99\+/);
  assert.match(html, /aria-expanded="false"/);
  client.clear();
});
test("item displays explicit read state, timestamp, safe link and plain escaped snapshots", async () => {
  const { NotificationItem } = await load(
    "src/features/notifications/notification-item.tsx",
  );
  const render = (item) =>
    renderToStaticMarkup(
      React.createElement(NotificationItem, {
        item,
        onRead() {},
        pending: false,
      }),
    );
  assert.match(render(row), /Непрочитане/);
  assert.match(render(row), /datetime=/i);
  assert.match(render(row), /href="\/account"/);
  assert.doesNotMatch(render({ ...row, readAt: stamp }), /Непрочитане/);
  assert.match(
    render({ ...row, title: "<script>private</script>", href: null }),
    /&lt;script&gt;/,
  );
  assert.doesNotMatch(render(row), />SYSTEM</);
});
test("panel renders compact empty/loading/retry and bounded pagination states", async () => {
  const { NotificationPanel } = await load(
    "src/features/notifications/notification-panel.tsx",
  );
  const base = {
    id: "panel",
    count: 0,
    page: 1,
    pending: false,
    error: false,
    mutating: false,
    mutationError: false,
    onRetry() {},
    onPage() {},
    onRead() {},
    onReadAll() {},
  };
  const render = (props) =>
    renderToStaticMarkup(
      React.createElement(NotificationPanel, { ...base, ...props }),
    );
  assert.match(
    render({ data: { data: [], meta: { page: 1, pages: 0 } } }),
    /Сповіщень поки немає/,
  );
  assert.match(render({ pending: true }), /Завантаження/);
  assert.match(render({ error: true }), /Спробувати ще раз/);
  const html = render({
    count: 1,
    data: { data: [row], meta: { page: 1, pages: 2 } },
  });
  assert.match(html, /Позначити всі як прочитані/);
  assert.match(html, /Наступні/);
  assert.doesNotMatch(html, /<select/);
});

test("Pet reminder notification renders owner snapshot, local HH:mm, safe link and no note metadata", async () => {
  const { NotificationItem } = await load(
    "src/features/notifications/notification-item.tsx",
  );
  const item = model.notificationSchema.parse({
    ...row,
    type: "PET_REMINDER_DUE",
    title: "Нагадування про Локі",
    body: "Дати препарат",
    dueAt: "2026-10-15T13:00:00.000Z",
    href: "/pets/" + row.id + "/care/reminders",
  });
  const html = renderToStaticMarkup(
    React.createElement(NotificationItem, {
      item,
      pending: false,
      onRead() {},
    }),
  );
  assert.match(html, /Нагадування про Локі/);
  assert.match(html, /Дати препарат/);
  assert.match(html, /is-pet-reminder/);
  assert.ok(html.includes(item.href));
  assert.match(model.notificationBody(item), /\d{2}:\d{2}/);
  assert.doesNotMatch(html, /\bAM\b|\bPM\b|PRIVATE_NOTE|reminderId|userId/);
  assert.equal(
    model.notificationSchema.parse({ ...item, href: "//evil.invalid" }).href,
    null,
  );
});
test("Pet notification body renders Kyiv16:00 and00:00 without AM/PM; moderation/message copy unchanged", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
 import assert from 'node:assert/strict';import {load} from './test/helpers/load-frontend.mjs';const {notificationBody}=await load('src/features/notifications/model.ts');
 for(const [dueAt,expected] of [['2026-10-15T13:00Z','16:00'],['2026-10-14T21:00Z','00:00']]){const text=notificationBody({type:'PET_REMINDER_DUE',body:'Дати препарат',dueAt});assert.ok(text.includes(expected));assert.doesNotMatch(text,/\\bAM\\b|\\bPM\\b/);}
 `,
    ],
    { env: { ...process.env, TZ: "Europe/Kyiv" }, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  for (const type of [
    "MODERATION_APPROVED",
    "MODERATION_REJECTED",
    "NEW_MESSAGE",
    "SYSTEM",
  ])
    assert.equal(
      model.notificationBody({ ...row, type }),
      "Текст повідомлення",
    );
});
