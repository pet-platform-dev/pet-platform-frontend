import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { startMessagingRealtime, messagingSocketUrl } = await load(
  "src/features/conversations/realtime.ts",
);
const { patchRealtimeMessage } = await load(
  "src/features/conversations/realtime-cache.ts",
);
const { mergeHistory } = await load(
  "src/features/conversations/history-scroll.ts",
);
const { conversationKeys: keys } = await load(
  "src/features/conversations/cache.ts",
);
const id = "76277b42-4a76-5c79-ab69-31acb61de011",
  other = "86277b42-4a76-5c79-ab69-31acb61de011";
const message = {
  id,
  text: "Привіт\n<script>text</script>",
  isOwn: false,
  createdAt: "2026-10-14T12:00:00.000Z",
  readAt: null,
};
const event = { conversationId: id, message };
const page = (data = []) => ({
  data,
  meta: { page: 1, limit: 20, pages: 1, total: data.length },
});
function client() {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: "A" });
  c.setQueryData(keys.history("A", id), { pages: [page()], pageParams: [1] });
  return c;
}
class FakeSocket {
  handlers = new Map();
  connects = 0;
  disconnects = 0;
  credentials = [];
  on(name, fn) {
    const list = this.handlers.get(name) ?? new Set();
    list.add(fn);
    this.handlers.set(name, list);
    return this;
  }
  off(name, fn) {
    this.handlers.get(name)?.delete(fn);
    return this;
  }
  connect() {
    this.connects++;
    this.auth?.((credentials) => this.credentials.push(credentials));
    return this;
  }
  disconnect() {
    this.disconnects++;
    return this;
  }
  emitLocal(name, data) {
    for (const fn of this.handlers.get(name) ?? []) fn(data);
  }
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 90));
test("socket credential refresh failure expires private UI once instead of reconnecting a cached identity indefinitely", async () => {
  const auth = await load("src/shared/api/client.ts"),
    previousFetch = globalThis.fetch,
    previousWindow = globalThis.window;
  const target = new EventTarget();
  let expired = 0;
  target.addEventListener("pet-platform-session-expired", () => expired++);
  globalThis.window = target;
  const reply = (data, status = 200) =>
    new Response(JSON.stringify({ data }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (url) =>
    url.endsWith("/csrf")
      ? reply({ csrfToken: "csrf" })
      : url.endsWith("/login")
        ? reply({ user: { id: "A" }, accessToken: "short", expiresIn: 1 })
        : reply({}, 401);
  try {
    await auth.signIn("login", {});
    await assert.rejects(
      auth.messagingAccessToken("A"),
      (error) => error.status === 401,
    );
    assert.equal(expired, 1);
  } finally {
    auth.clearSession();
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
test("one connection/listener set per session; navigation needs no new socket; cleanup rejects queued old events", async () => {
  const c = client(),
    socket = new FakeSocket();
  let generation = 1;
  const stop = startMessagingRealtime(c, "A", {
    socket,
    token: async () => "A-token",
    generation: () => generation,
  });
  await Promise.resolve();
  assert.equal(socket.connects, 1);
  assert.deepEqual(socket.credentials, [{ token: "A-token" }]);
  const queued = [...socket.handlers.get("message:new")][0];
  socket.emitLocal("message:new", event);
  socket.emitLocal("message:new", event);
  assert.equal(c.getQueryData(keys.history("A", id)).pages[0].data.length, 1);
  generation++;
  c.setQueryData(["current-user"], { id: "B" });
  stop();
  queued({ ...event, message: { ...message, id: other } });
  assert.equal(c.getQueryData(keys.history("A", id)).pages[0].data.length, 1);
  assert.equal(c.getQueryData(keys.history("B", id)), undefined);
  assert.equal(socket.disconnects, 1);
  assert.ok([...socket.handlers.values()].every((set) => set.size === 0));
  const b = new FakeSocket();
  const stopB = startMessagingRealtime(c, "B", {
    socket: b,
    token: async () => "B-token",
    generation: () => generation,
  });
  await Promise.resolve();
  assert.deepEqual(b.credentials, [{ token: "B-token" }]);
  stopB();
  c.clear();
});
test("incoming refresh targets inbox/detail/message total/bell, patches history once and never invalidates marketplace or other account", async () => {
  const c = client(),
    socket = new FakeSocket();
  for (const key of [
    keys.list("A", 1),
    keys.detail("A", id),
    keys.unreadCount("A"),
    ["notifications", "A", "unread-count"],
    ["notifications", "A", "list", 1],
    ["conversations", "B"],
    ["listings"],
  ])
    c.setQueryData(key, {});
  const stop = startMessagingRealtime(c, "A", {
    socket,
    token: async () => "token",
  });
  socket.emitLocal("message:new", event);
  socket.emitLocal("message:new", event);
  await pause();
  for (const key of [
    keys.list("A", 1),
    keys.detail("A", id),
    keys.unreadCount("A"),
    ["notifications", "A", "unread-count"],
    ["notifications", "A", "list", 1],
  ])
    assert.equal(c.getQueryState(key).isInvalidated, true);
  assert.equal(c.getQueryState(keys.history("A", id)).isInvalidated, false);
  assert.equal(c.getQueryState(["listings"]).isInvalidated, false);
  assert.equal(c.getQueryState(["conversations", "B"]).isInvalidated, false);
  assert.equal(c.getQueryData(keys.history("A", id)).pages[0].data.length, 1);
  stop();
  c.clear();
});
test("out-of-order realtime append and older-page prepend merge without duplicate IDs; HTTP read state wins", () => {
  const c = client();
  patchRealtimeMessage(c, "A", event);
  patchRealtimeMessage(c, "A", {
    ...event,
    message: { ...message, id: other, createdAt: "2026-10-14T11:00:00.000Z" },
  });
  const older = {
    ...message,
    id: "96277b42-4a76-5c79-ab69-31acb61de011",
    createdAt: "2026-10-13T12:00:00.000Z",
  };
  // Simulate an in-flight HTTP response replacing the page after socket delivery.
  const http = [
    page([{ ...message, readAt: "2026-10-14T12:01:00.000Z" }]),
    page([older]),
  ];
  const merged = mergeHistory([
    ...http,
    { data: c.getQueryData(keys.live("A", id)) },
  ]);
  assert.deepEqual(
    merged.map((m) => m.id),
    [older.id, other, id],
  );
  assert.equal(merged.at(-1).readAt, "2026-10-14T12:01:00.000Z");
  c.clear();
});
test("reconnect reconciles loaded history/inbox/both counters; read delivery is reader-account scoped", () => {
  const c = client(),
    socket = new FakeSocket();
  c.setQueryData(["notifications", "A", "unread-count"], { count: 2 });
  c.setQueryData(["listings"], {});
  const stop = startMessagingRealtime(c, "A", {
    socket,
    token: async () => "token",
  });
  socket.emitLocal("connect");
  assert.equal(c.getQueryState(keys.history("A", id)).isInvalidated, true);
  assert.equal(
    c.getQueryState(["notifications", "A", "unread-count"]).isInvalidated,
    true,
  );
  c.setQueryData(keys.history("A", id), { pages: [page()], pageParams: [1] });
  socket.emitLocal("messages:read", { conversationId: id });
  assert.equal(c.getQueryState(keys.history("A", id)).isInvalidated, true);
  assert.equal(c.getQueryState(["listings"]).isInvalidated, false);
  stop();
  c.clear();
});
test("malformed events and stale-account patches are rejected; closed conversations do not hydrate private history", () => {
  const c = client();
  assert.equal(patchRealtimeMessage(c, "B", event), false);
  assert.equal(
    patchRealtimeMessage(c, "A", { ...event, conversationId: "bad" }),
    false,
  );
  assert.equal(
    patchRealtimeMessage(c, "A", {
      ...event,
      message: { ...message, text: "x".repeat(3001) },
    }),
    false,
  );
  patchRealtimeMessage(c, "A", { ...event, conversationId: other });
  assert.equal(c.getQueryData(keys.history("A", other)), undefined);
  assert.equal(c.getQueryData(keys.live("A", other)), undefined);
  c.clear();
});
test("pending event overlay is bounded and API URL maps to one fixed namespace", () => {
  const c = client();
  for (let i = 0; i < 110; i++)
    patchRealtimeMessage(c, "A", {
      ...event,
      message: {
        ...message,
        id: `76277b42-4a76-5c79-ab69-${String(i).padStart(12, "0")}`,
      },
    });
  assert.equal(c.getQueryData(keys.live("A", id)).length, 100);
  assert.equal(
    messagingSocketUrl(
      "https://api.example.test/api/v1",
      "https://site.example.test",
    ),
    "https://api.example.test/messaging",
  );
  assert.equal(
    messagingSocketUrl("/api/v1", "https://site.example.test"),
    "https://site.example.test/messaging",
  );
  assert.throws(() =>
    messagingSocketUrl("javascript:alert(1)", "https://site.example.test"),
  );
  c.clear();
});
