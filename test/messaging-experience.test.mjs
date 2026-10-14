import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/features/conversations/model.ts");
const { MessageNavigation } = await load(
  "src/features/conversations/message-navigation.tsx",
);
const { Header } = await load("src/widgets/header/header.tsx");
const { MessageHistory } = await load(
  "src/features/conversations/message-history.tsx",
);
const { MessagesLoading } = await load(
  "src/features/conversations/messages-loading.tsx",
);
const { ConversationCard } = await load(
  "src/features/conversations/conversation-context.tsx",
);
const cache = await load("src/features/conversations/cache.ts");
function render(client, component, props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(component, props),
    ),
  );
}
function client(user = "A", count = 3) {
  const c = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  c.setQueryData(["current-user"], user ? { id: user } : null);
  if (user) c.setQueryData(cache.conversationKeys.unreadCount(user), { count });
  return c;
}
test("authenticated Header has one Messages entry with SVG, independent message badge and current-page label", () => {
  const c = client();
  c.setQueryData(["notifications", "A", "unread-count"], { count: 91 });
  const html = render(c, Header);
  assert.match(html, /aria-label="Повідомлення, непрочитаних: 3"/);
  assert.match(html, /aria-label="Сповіщення, непрочитаних: 91"/);
  assert.equal((html.match(/href="\/messages"/g) ?? []).length, 1);
  assert.match(
    render(c, MessageNavigation, { active: true }),
    /aria-current="page"/,
  );
  assert.match(render(c, MessageNavigation), /<svg/);
  assert.doesNotMatch(html, /<select/);
  c.clear();
});
test("anonymous Header has no private Messages link or unread request component", () => {
  const c = client(null);
  assert.equal(render(c, MessageNavigation), "");
  assert.doesNotMatch(
    render(c, Header),
    /href="\/messages"|message-navigation-count/,
  );
  c.clear();
});
test("badge uses exact accessible count, caps visual count and has no zero badge", () => {
  const c = client("A", 103);
  const html = render(c, MessageNavigation);
  assert.match(html, /Повідомлення, непрочитаних: 103/);
  assert.match(html, /99\+/);
  c.setQueryData(cache.conversationKeys.unreadCount("A"), { count: 0 });
  assert.doesNotMatch(render(c, MessageNavigation), /message-navigation-count/);
  assert.equal(model.messageNavigationLabel(0), "Повідомлення");
  c.clear();
});
test("account switch cannot reuse A unread badge and cleanup removes infinite history and count", async () => {
  const c = client("A", 9);
  c.setQueryData(cache.conversationKeys.history("A", "conversation"), {
    pages: [{ private: "A" }],
  });
  c.setQueryData(["current-user"], { id: "B" });
  c.setQueryData(cache.conversationKeys.unreadCount("B"), { count: 1 });
  const html = render(c, MessageNavigation);
  assert.match(html, /Повідомлення, непрочитаних: 1/);
  assert.doesNotMatch(html, /непрочитаних: 9/);
  const { clearPrivateQueries } = await load(
    "src/features/auth/session-provider.tsx",
  );
  clearPrivateQueries(c);
  assert.equal(c.getQueriesData({ queryKey: ["conversations"] }).length, 0);
  c.clear();
});
test("Ukrainian dates use Kyiv calendar boundaries, compact time/yesterday and past year", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  assert.equal(model.inboxDate("2026-10-14T11:32:00Z", now), "14:32");
  assert.equal(model.inboxDate("2026-10-13T12:00:00Z", now), "Учора");
  assert.equal(model.historyDay("2026-10-13T22:30:00Z", now), "Сьогодні");
  assert.match(model.historyDay("2025-10-01T12:00:00Z", now), /2025/);
  assert.equal(
    model.messagePreview(" \nВи\t  написали\r\n  текст  "),
    "Ви написали текст",
  );
});
test("inbox card retains listing/identity and normalizes own preview without losing unread text", () => {
  const c = {
    id: "76277b42-4a76-5c79-ab69-31acb61de011",
    listing: { title: "Рекс шукає родину", imageUrl: null, breed: "Малінуа" },
    otherParticipant: { displayName: "Олександр Єпік" },
    lastMessageAt: "2026-10-14T12:00:00Z",
    unreadCount: 2,
    lastMessage: { isOwn: true, text: "  Вітаю\n\nЦікавить  оголошення " },
  };
  const html = renderToStaticMarkup(
    React.createElement(ConversationCard, { conversation: c }),
  );
  for (const text of [
    "Рекс шукає родину",
    "Малінуа",
    "Олександр Єпік",
    "Непрочитаних: 2",
    "Ви: Вітаю Цікавить оголошення",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /is-unread/);
  assert.match(html, /<time datetime=/i);
});
test("history groups consecutive messages/days with accessible sender labels and escaped multiline content", () => {
  const base = {
    id: "1",
    isOwn: true,
    text: "<img src=x onerror=alert(1)>\nдругий рядок",
    createdAt: "2026-10-13T12:00:00Z",
    readAt: null,
  };
  const html = renderToStaticMarkup(
    React.createElement(MessageHistory, {
      messages: [
        base,
        { ...base, id: "2" },
        { ...base, id: "3", isOwn: false },
        { ...base, id: "4", createdAt: "2026-10-14T12:00:00Z" },
      ],
    }),
  );
  assert.equal((html.match(/class="message-day"/g) ?? []).length, 2);
  assert.equal((html.match(/is-consecutive/g) ?? []).length, 1);
  assert.match(html, /aria-label="Ваше повідомлення"/);
  assert.match(html, /aria-label="Повідомлення співрозмовника"/);
  assert.doesNotMatch(html, />Ви<|<img src=x|Прочитано|Доставлено/);
  assert.match(html, /&lt;img/);
  assert.match(html, /\nдругий рядок/);
});
test("loading skeletons reserve context/history space and announce one safe status", () => {
  for (const kind of ["inbox", "conversation", "history"]) {
    const html = renderToStaticMarkup(
      React.createElement(MessagesLoading, { kind }),
    );
    assert.match(html, /role="status"/);
    assert.match(html, /Завантаження/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /<button|<textarea/);
    if (kind !== "inbox") assert.match(html, /message-viewport/);
  }
});
