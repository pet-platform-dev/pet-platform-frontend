import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/features/reports/model.ts");
const contextModel = await load(
  "src/features/reports/message-context-model.ts",
);
const navigation = await load("src/features/reports/navigation.ts");
const session = await load("src/features/auth/session-provider.tsx");
const cache = await load("src/features/reports/admin-cache.ts");
const adminCache = await load("src/features/admin/moderation/cache.ts");
const { ApiError } = await load("src/shared/api/client.ts");
const uid = "76277b42-4a76-5c79-ab69-31acb61de011",
  id = "86277b42-4a76-5c79-ab69-31acb61de011",
  stamp = "2026-10-14T12:00:00.000Z";
const person = { id: uid, displayName: "Повне ім’я" };
const context = {
  conversationId: id,
  listing: { title: "Контекст оголошення", breed: "Порода", imageUrl: null },
  participants: [person, { id, displayName: "Продавець" }],
  message: {
    id,
    text: "<script>private</script>",
    createdAt: stamp,
    sender: person,
  },
  messages: [
    {
      id,
      text: "<script>private</script>",
      createdAt: stamp,
      sender: person,
      isReported: true,
    },
  ],
  available: true,
};
const report = {
  id,
  targetType: "MESSAGE",
  targetId: id,
  targetPreview: "Фрагмент",
  reason: "SPAM",
  status: "OPEN",
  createdAt: stamp,
  updatedAt: stamp,
  resolvedAt: null,
  reporter: person,
  details: null,
  resolutionReason: null,
  target: null,
  messageContext: context,
};
function render(client, component, props) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(component, props),
    ),
  );
}
test("MESSAGE shares strict report validation and controlled reasons; spoofed context rejected", () => {
  const input = { targetType: "MESSAGE", targetId: id, reason: "SPAM" };
  assert.deepEqual(model.reportInputSchema.parse(input), input);
  for (const key of ["conversationId", "senderId", "reporterId", "status"])
    assert.equal(
      model.reportInputSchema.safeParse({ ...input, [key]: id }).success,
      false,
    );
  assert.equal(model.typeLabels.MESSAGE, "Повідомлення");
  assert.equal(
    navigation.parseReportsState({ type: "MESSAGE", page: "2" }).type,
    "MESSAGE",
  );
  assert.equal(
    navigation.safeReportsReturn(
      "/admin/moderation/reports?type=MESSAGE&page=2",
    ),
    "/admin/moderation/reports?type=MESSAGE&page=2",
  );
});
test("only incoming message gets touch/keyboard SVG action; own has none", async () => {
  const { MessageHistory } = await load(
    "src/features/conversations/message-history.tsx",
  );
  const client = new QueryClient();
  client.setQueryData(session.sessionKey, { id: uid, role: "USER" });
  const base = { id, text: "Повідомлення", createdAt: stamp, readAt: null };
  const html = render(client, MessageHistory, {
    reportActions: true,
    messages: [
      { ...base, isOwn: false },
      { ...base, id: uid, isOwn: true },
    ],
  });
  assert.equal((html.match(/Дії з повідомленням/g) ?? []).length, 2); // summary label + title, one incoming only
  assert.equal((html.match(/<summary/g) ?? []).length, 1);
  assert.match(html, /<svg/);
  assert.match(html, /Поскаржитися/);
  assert.doesNotMatch(html, /<select/);
  client.clear();
});
test("reused dialog has message title, bounded escaped preview and continuation copy", async () => {
  const { ReportDialog } = await load("src/features/reports/report-dialog.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ReportDialog, {
      reason: "SPAM",
      details: "",
      pending: false,
      error: "",
      messagePreview: "<script>private</script>" + "x".repeat(400),
      onReason() {},
      onDetails() {},
      onSubmit() {},
      onClose() {},
      returnFocus() {},
    }),
  );
  assert.match(html, /Поскаржитися на повідомлення/);
  assert.match(html, /не закриває розмову/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|x{201}/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /Надіслати скаргу/);
});
test("MESSAGE detail highlights reported message, safe text, deliberate report scoped link", async () => {
  const { MessageReportContext } = await load(
    "src/features/reports/message-report-context.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(MessageReportContext, { id, context }),
  );
  assert.match(html, /Повідомлення, на яке поскаржилися/);
  assert.match(html, /is-reported/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(
    html,
    new RegExp("/admin/moderation/reports/" + id + "/conversation"),
  );
  assert.match(html, /До 10 повідомлень/);
  const unavailable = renderToStaticMarkup(
    React.createElement(MessageReportContext, {
      id,
      context: { ...context, available: false },
    }),
  );
  assert.match(unavailable, /Контекст розмови недоступний/);
  assert.doesNotMatch(unavailable, /Переглянути контекст розмови/);
});
test("queue and detail integrate MESSAGE without content moderation actions", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { refetchOnMount: false } },
  });
  client.setQueryData(session.sessionKey, { id: uid, role: "ADMIN" });
  const state = { status: "OPEN", type: "MESSAGE", page: 1 };
  client.setQueryData(cache.reportKeys.queue(uid, state), {
    data: [
      {
        ...report,
        detailsExcerpt: null,
        contextSummary: "Контекст оголошення",
      },
    ],
    meta: { page: 1, limit: 24, total: 1, pages: 1 },
  });
  const { AdminReportQueue } = await load(
    "src/features/reports/admin-queue.tsx",
  );
  assert.match(
    render(client, AdminReportQueue, { state }),
    /Контекст оголошення/,
  );
  client.setQueryData(cache.reportKeys.detail(uid, id), report);
  const { AdminReportDetail } = await load(
    "src/features/reports/admin-detail.tsx",
  );
  const html = render(client, AdminReportDetail, {
    id,
    returnTo: navigation.reportsPath,
  });
  assert.match(html, /Повідомлення, на яке поскаржилися/);
  assert.match(html, /Опрацювати/);
  assert.doesNotMatch(html, /Відкрити модерацію матеріалу/);
  client.clear();
});
test("full-context DTO bounded and private extras stripped, no participant cache keys", () => {
  const parsed = contextModel.fullContextSchema.parse({
    data: {
      ...context,
      moderatorId: uid,
      participants: [{ ...person, email: "PRIVATE" }, person],
    },
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
  assert.equal(parsed.data.moderatorId, undefined);
  assert.equal(parsed.data.participants[0].email, undefined);
  assert.equal(
    contextModel.fullContextSchema.safeParse({
      ...parsed,
      data: { ...context, messages: Array(22).fill(context.messages[0]) },
    }).success,
    false,
  );
  assert.equal(
    model.reportDetailSchema.parse(report).messageContext.message.id,
    id,
  );
  assert.deepEqual(cache.reportKeys.conversation(uid, id), [
    "admin-moderation",
    uid,
    "reports",
    "conversation",
    id,
  ]);
});
test("role loss403 clears private report context immediately; late response cannot restore it", async () => {
  const client = new QueryClient();
  client.setQueryData(session.sessionKey, { id: uid, role: "ADMIN" });
  const key = cache.reportKeys.conversation(uid, id);
  client.setQueryData(key, context);
  await assert.rejects(
    adminCache.runAdminRequest(client, uid, async () => {
      throw new ApiError(403, "denied");
    }),
  );
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(adminCache.currentAdmin(client, uid), false);
  await assert.rejects(
    adminCache.runAdminRequest(client, uid, async () => context),
    /Admin session changed/,
  );
  client.clear();
});
test("logout clears own sent-state and admin history without touching public cache", async () => {
  const client = new QueryClient();
  const { reportSentKey } = await load(
    "src/features/reports/report-button.tsx",
  );
  const key = cache.reportKeys.conversation(uid, id);
  client.setQueryData(key, context);
  client.setQueryData(reportSentKey(uid, "MESSAGE", id), true);
  client.setQueryData(["public"], 1);
  session.clearPrivateQueries(client);
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(
    client.getQueryData(reportSentKey(uid, "MESSAGE", id)),
    undefined,
  );
  assert.equal(client.getQueryData(["public"]), 1);
  client.clear();
});
