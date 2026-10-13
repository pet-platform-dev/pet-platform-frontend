import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const m = await load("src/features/reports/model.ts"),
  n = await load("src/features/reports/navigation.ts");
const id = "76277b42-4a76-5c79-ab69-31acb61de011";
test("foreign public report eligibility hides own content; anonymous can start login", () => {
  assert.equal(m.canReport(id, id), false);
  assert.equal(m.canReport(undefined, id), true);
  assert.equal(m.canReport("other", id), true);
});
test("controlled report reasons and OTHER meaningful details validation", () => {
  const input = { targetType: "LISTING", targetId: id, reason: "OTHER" };
  assert.equal(m.reportInputSchema.safeParse(input).success, false);
  assert.equal(
    m.reportInputSchema.safeParse({ ...input, details: "   " }).success,
    false,
  );
  assert.equal(
    m.reportInputSchema.safeParse({ ...input, details: "Детальний опис" })
      .success,
    true,
  );
  assert.equal(
    m.reportInputSchema.safeParse({ ...input, details: "x".repeat(1001) })
      .success,
    false,
  );
  assert.equal(
    m.reportInputSchema.safeParse({
      ...input,
      details: "Детальний опис",
      status: "OPEN",
    }).success,
    false,
  );
});
test("report queue URL preserves pagination/filters and rejects malicious returns", () => {
  const state = { status: "DISMISSED", type: "REVIEW", page: 2 };
  const url = n.reportsHref(state);
  assert.deepEqual(
    n.parseReportsState(
      Object.fromEntries(new URL(url, "https://x").searchParams),
    ),
    state,
  );
  assert.equal(n.safeReportsReturn(url), url);
  for (const x of [
    "https://evil.invalid",
    "//evil.invalid",
    "/admin/moderation/reports/../reports",
    "/admin/moderation/reports?page=2&page=3",
  ])
    assert.equal(n.safeReportsReturn(x), n.reportsPath);
  const detail = n.reportDetailHref(id, url);
  assert.equal(n.safeReportDetailReturn(detail), detail);
  assert.equal(n.safeReportDetailReturn("https://evil.invalid/" + id), null);
});
test("decisions require inspected report revision and bounded reason", () => {
  assert.equal(
    m.reportDecisionSchema.safeParse({ reason: "Детальна причина" }).success,
    false,
  );
  assert.equal(
    m.reportDecisionSchema.safeParse({
      expectedUpdatedAt: "2026-10-13T00:00:00.000Z",
      reason: "Детальна причина",
    }).success,
    true,
  );
});
const session = await load("src/features/auth/session-provider.tsx"),
  keys = await load("src/features/reports/admin-cache.ts");
const owner = "86277b42-4a76-5c79-ab69-31acb61de011",
  stamp = "2026-10-13T00:00:00.000Z";
const record = {
  id,
  targetType: "LISTING",
  targetId: owner,
  targetPreview: "Матеріал",
  reason: "SPAM",
  status: "OPEN",
  createdAt: stamp,
  updatedAt: stamp,
  resolvedAt: null,
  reporter: { id: owner, displayName: "Заявник" },
  details: "Детальний опис",
  resolutionReason: null,
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
test("button shown for foreign content, hidden for own, and success per user/target", async () => {
  const { ReportButton, reportSentKey } = await load(
    "src/features/reports/report-button.tsx",
  );
  const c = new QueryClient();
  c.setQueryData(session.sessionKey, { id, role: "USER" });
  assert.equal(
    render(c, ReportButton, {
      targetType: "LISTING",
      targetId: owner,
      ownerId: id,
    }),
    "",
  );
  assert.match(
    render(c, ReportButton, {
      targetType: "LISTING",
      targetId: owner,
      ownerId: owner,
    }),
    /Поскаржитися/,
  );
  c.setQueryData(reportSentKey(id, "LISTING", owner), true);
  assert.match(
    render(c, ReportButton, {
      targetType: "LISTING",
      targetId: owner,
      ownerId: owner,
    }),
    /Скаргу надіслано/,
  );
  c.clear();
});
test("dialog uses custom labelled dropdown, bounded details, associated errors and compact actions", async () => {
  const { ReportDialog } = await load("src/features/reports/report-dialog.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ReportDialog, {
      reason: "OTHER",
      details: "",
      onReason() {},
      onDetails() {},
      onSubmit() {},
      onClose() {},
      pending: false,
      error: "Додайте опис",
      returnFocus() {},
    }),
  );
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /Надіслати скаргу/);
  assert.match(html, /aria-describedby/);
});
test("safe projections strip reporter private data and permit unavailable target", () => {
  const data = m.reportDetailSchema.parse({
    ...record,
    target: null,
    email: "PRIVATE",
    reporter: { ...record.reporter, email: "PRIVATE", passwordHash: "PRIVATE" },
  });
  assert.equal(data.target, null);
  assert.equal(data.email, undefined);
  assert.equal(data.reporter.email, undefined);
});
test("report snapshots accept200 Unicode code points like PostgreSQL varchar", () => {
  assert.equal(
    m.reportDetailSchema.safeParse({
      ...record,
      target: null,
      targetPreview: "🐾".repeat(200),
    }).success,
    true,
  );
  assert.equal(
    m.reportDetailSchema.safeParse({
      ...record,
      target: null,
      targetPreview: "🐾".repeat(201),
    }).success,
    false,
  );
});
test("admin queue shows snapshots/filters/pagination; detail reuses separate moderation action", async () => {
  const c = new QueryClient({
    defaultOptions: { queries: { refetchOnMount: false } },
  });
  c.setQueryData(session.sessionKey, { id, role: "ADMIN" });
  const state = { status: "OPEN", page: 2 };
  c.setQueryData(keys.reportKeys.queue(id, state), {
    data: [{ ...record, detailsExcerpt: "Опис" }],
    meta: { page: 2, limit: 24, total: 25, pages: 2 },
  });
  const { AdminReportQueue } = await load(
    "src/features/reports/admin-queue.tsx",
  );
  const html = render(c, AdminReportQueue, { state });
  assert.match(html, /Скарги користувачів/);
  assert.match(html, /Спам/);
  assert.match(html, /Статус скарги/);
  assert.match(html, /Сторінки скарг/);
  c.setQueryData(keys.reportKeys.detail(id, id), { ...record, target: null });
  const { AdminReportDetail } = await load(
    "src/features/reports/admin-detail.tsx",
  );
  const detail = render(c, AdminReportDetail, { id, returnTo: n.reportsPath });
  assert.match(detail, /Матеріал видалено або недоступний/);
  assert.match(detail, /Опрацювати/);
  assert.match(detail, /Відхилити скаргу/);
  assert.match(detail, /не приховує контент/);
  c.clear();
});
test("session clearing removes report success/admin reports/decision cache, preserves public content", async () => {
  const c = new QueryClient();
  c.setQueryData(["report-sent", id, "LISTING", owner], true);
  c.setQueryData(keys.reportKeys.detail(id, id), record);
  c.setQueryData(["listing", owner], { title: "Public" });
  c.getMutationCache().build(
    c,
    { mutationKey: ["user-reports", id] },
    {
      status: "success",
      data: record,
      variables: undefined,
      context: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    },
  );
  session.clearPrivateQueries(c);
  assert.equal(
    c.getQueryData(["report-sent", id, "LISTING", owner]),
    undefined,
  );
  assert.equal(c.getQueryData(keys.reportKeys.detail(id, id)), undefined);
  assert.equal(c.getMutationCache().getAll().length, 0);
  assert.equal(c.getQueryData(["listing", owner]).title, "Public");
  c.clear();
});
test("safe login restores public mating and admin report context", async () => {
  const login = await load("src/features/favorites/login-return.ts");
  assert.equal(
    login.favoriteLoginReturn("/mating/" + id + "?returnTo=%2Fmating"),
    "/mating/" + id + "?returnTo=%2Fmating",
  );
  assert.equal(
    login.favoriteLoginReturn(n.reportDetailHref(id, n.reportsPath)),
    n.reportDetailHref(id, n.reportsPath),
  );
  assert.equal(
    login.favoriteLoginReturn("/admin/moderation/reports/evil"),
    "/account",
  );
});
