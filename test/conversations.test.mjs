import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/features/conversations/model.ts");
const cache = await load("src/features/conversations/cache.ts");
const session = await load("src/features/auth/session-provider.tsx");
const scroll = await load("src/features/conversations/history-scroll.ts");

test("scroll history merges overlapping bounded pages chronologically and prefers fresh read state", () => {
  const old = { id: "a", createdAt: "2026-10-01", readAt: null };
  const recent = { id: "b", createdAt: "2026-10-02", readAt: null };
  const read = { ...recent, readAt: "2026-10-03" };
  assert.deepEqual(
    scroll.mergeHistory([{ data: [read] }, { data: [old, recent] }]),
    [old, read],
  );
  assert.equal(
    scroll.nearBottom({
      scrollHeight: 1000,
      scrollTop: 640,
      clientHeight: 300,
    }),
    true,
  );
  assert.equal(
    scroll.nearBottom({
      scrollHeight: 1000,
      scrollTop: 100,
      clientHeight: 300,
    }),
    false,
  );
});

test("conversation read invalidates only the current account's conversation and notification families", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id: "A" });
  for (const key of [
    ["conversations", "A", "history", "id"],
    ["conversations", "A", "list", 1],
    ["notifications", "A", "unread-count"],
    ["notifications", "A", "list", 1],
    ["notifications", "B"],
    ["listings"],
  ])
    client.setQueryData(key, {});
  await cache.refreshConversationRead(client, "B");
  assert.equal(
    client.getQueryState(["notifications", "B"]).isInvalidated,
    false,
  );
  await cache.refreshConversationRead(client, "A");
  assert.equal(
    client.getQueryState(["notifications", "A", "unread-count"]).isInvalidated,
    true,
  );
  assert.equal(
    client.getQueryState(["notifications", "A", "list", 1]).isInvalidated,
    true,
  );
  assert.equal(
    client.getQueryState(["conversations", "A", "history", "id"]).isInvalidated,
    true,
  );
  assert.equal(
    client.getQueryState(["conversations", "A", "list", 1]).isInvalidated,
    true,
  );
  assert.equal(
    client.getQueryState(["notifications", "B"]).isInvalidated,
    false,
  );
  assert.equal(client.getQueryState(["listings"]).isInvalidated, false);
  client.clear();
});
const id = "76277b42-4a76-5c79-ab69-31acb61de011",
  stamp = "2026-10-14T12:00:00.000Z";
const conversation = {
  id,
  createdAt: stamp,
  updatedAt: stamp,
  lastMessageAt: stamp,
  listing: {
    id,
    title: "Малінуа, 4 місяці",
    breed: "Малінуа",
    imageUrl: null,
    available: true,
    href: "/listings/" + id,
  },
  otherParticipant: { id, displayName: "Олександр Єпік" },
  canSend: true,
  unreadCount: 1,
  lastMessage: {
    id,
    text: "Добрий день",
    isOwn: false,
    createdAt: stamp,
    readAt: null,
  },
};

test("late inbox/detail/messages/count/start/send/read responses are rejected after account switch", async () => {
  const auth = await load("src/shared/api/client.ts"),
    api = await load("src/features/conversations/api.ts"),
    saved = globalThis.fetch;
  const reply = (data) =>
    new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
    });
  try {
    for (const operation of [
      () => api.getInbox(1),
      () => api.getConversation(id),
      () => api.getMessages(id, 1),
      () => api.getConversationUnreadCount(),
      () => api.startConversation(id, "Привіт"),
      () => api.sendMessage(id, "Привіт"),
      () => api.readConversation(id, id),
    ]) {
      let actor = "A",
        started,
        finish;
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
        started();
        return new Promise((resolve) => {
          finish = () => resolve(reply({ private: "A" }));
        });
      };
      await auth.signIn("login", {});
      const pending = operation();
      const rejected = assert.rejects(
        pending,
        (error) => error.name === "AbortError",
      );
      await ready;
      actor = "B";
      await auth.signIn("login", {});
      finish();
      await rejected;
    }
  } finally {
    globalThis.fetch = saved;
    auth.clearSession();
  }
});
function render(client, Component, props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Component, props),
    ),
  );
}
test("trimmed message validation rejects whitespace, excessive text and identity injection", () => {
  assert.equal(
    model.messageInputSchema.parse({ text: "  Вітаю\nВас  " }).text,
    "Вітаю\nВас",
  );
  for (const x of [
    { text: " " },
    { text: "x".repeat(3001) },
    { text: "ok", senderId: id },
    { text: "ok", readAt: stamp },
  ])
    assert.equal(model.messageInputSchema.safeParse(x).success, false);
});
test("conversation context keeps safe current Listing link only, including hostile target defense", () => {
  assert.equal(
    model.conversationSchema.parse(conversation).listing.href,
    "/listings/" + id,
  );
  for (const href of [
    "https://evil.invalid",
    "//evil.invalid",
    "javascript:alert(1)",
    "/listings/../account",
  ])
    assert.equal(
      model.conversationSchema.parse({
        ...conversation,
        listing: { ...conversation.listing, href },
      }).listing.href,
      null,
    );
  assert.equal(
    model.conversationSchema.parse({
      ...conversation,
      listing: { ...conversation.listing, available: false },
    }).listing.href,
    null,
  );
});
test("CTA policy hides own/unavailable listing; SSR is stable before restored-session hydration", async () => {
  const { ListingMessageButton } = await load(
    "src/features/conversations/listing-message-button.tsx",
  );
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  const listing = {
    id,
    status: "ACTIVE",
    seller: { id: "seller", displayName: "Олександр Єпік" },
    title: "Малінуа",
    pet: { breed: null },
    images: [],
  };
  client.setQueryData(session.sessionKey, { id: "seller" });
  assert.equal(render(client, ListingMessageButton, { listing }), "");
  client.setQueryData(session.sessionKey, { id: "buyer" });
  assert.equal(model.canMessageListing("ACTIVE", "buyer", "seller"), true);
  assert.equal(model.canMessageListing("ACTIVE", "seller", "seller"), false);
  assert.equal(model.canMessageListing("DRAFT", "buyer", "seller"), false);
  assert.equal(model.canMessageListing("ACTIVE", undefined, "seller"), true);
  assert.equal(render(client, ListingMessageButton, { listing }), "");
  client.setQueryData(session.sessionKey, null);
  assert.equal(render(client, ListingMessageButton, { listing }), "");
  const { favoriteLoginHref } = await load(
    "src/features/favorites/login-return.ts",
  );
  assert.match(favoriteLoginHref("/listings/" + id), /returnTo=%2Flistings%2F/);
  assert.equal(
    render(client, ListingMessageButton, {
      listing: { ...listing, status: "DRAFT" },
    }),
    "",
  );
  client.clear();
});
test("inbox/context show listing and full participant identity, explicit unread; unavailable context hides public link", async () => {
  const { ConversationCard, ConversationContext } = await load(
    "src/features/conversations/conversation-context.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(ConversationCard, { conversation }),
  );
  assert.match(html, /Малінуа, 4 місяці/);
  assert.match(html, /Олександр Єпік/);
  assert.match(html, /Непрочитаних: 1/);
  assert.match(html, /href="\/messages\//);
  const hidden = renderToStaticMarkup(
    React.createElement(ConversationContext, {
      conversation: {
        ...conversation,
        listing: { ...conversation.listing, available: false, href: null },
      },
    }),
  );
  assert.match(hidden, /Оголошення більше не активне/);
  assert.doesNotMatch(hidden, /href="\/listings/);
});
test("message bubbles render escaped plain text, timestamp and own/other sides without fake receipt states", async () => {
  const { MessageHistory } = await load(
    "src/features/conversations/message-history.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(MessageHistory, {
      messages: [
        { ...conversation.lastMessage, text: "<script>private</script>" },
        {
          ...conversation.lastMessage,
          id: "86277b42-4a76-5c79-ab69-31acb61de011",
          isOwn: true,
        },
      ],
    }),
  );
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /is-own/);
  assert.match(html, /datetime=/i);
  assert.doesNotMatch(html, /Прочитано|Доставлено|online|<script>/);
});
test("session cleanup cancels in-flight chat data and removes inbox/detail/messages/count/mutation results while retaining public caches", async () => {
  const c = new QueryClient();
  c.setQueryData(session.sessionKey, { id: "A" });
  for (const key of [
    cache.conversationKeys.list("A", 1),
    cache.conversationKeys.detail("A", id),
    cache.conversationKeys.messages("A", id, 1),
    cache.conversationKeys.unreadCount("A"),
  ])
    c.setQueryData(key, { private: "A" });
  c.setQueryData(["listings"], ["public"]);
  const m = c.getMutationCache().build(c, {
    mutationKey: cache.conversationKeys.root("A"),
    mutationFn: async () => conversation,
  });
  await m.execute();
  session.clearPrivateQueries(c);
  assert.equal(c.getMutationCache().getAll().length, 0);
  assert.equal(
    c.getQueryData(cache.conversationKeys.detail("A", id)),
    undefined,
  );
  assert.equal(c.getQueriesData({ queryKey: ["conversations"] }).length, 0);
  assert.deepEqual(c.getQueryData(["listings"]), ["public"]);
  c.clear();
});
test("old-account mutation settlement cannot invalidate new-account chat queries", async () => {
  const c = new QueryClient();
  c.setQueryData(session.sessionKey, { id: "B" });
  c.setQueryData(cache.conversationKeys.list("B", 1), { private: "B" });
  await cache.refreshConversations(c, "A");
  assert.equal(
    c.getQueryState(cache.conversationKeys.list("B", 1)).isInvalidated,
    false,
  );
  c.clear();
});
test("login return accepts only internal message paths", async () => {
  const { favoriteLoginReturn } = await load(
    "src/features/favorites/login-return.ts",
  );
  assert.equal(favoriteLoginReturn("/messages/" + id), "/messages/" + id);
  assert.equal(favoriteLoginReturn("/messages"), "/messages");
  for (const path of [
    "//evil.invalid/messages",
    "/messages/../account",
    "/messages/bad",
    "https://evil.invalid/messages",
  ])
    assert.equal(favoriteLoginReturn(path), "/account");
});
