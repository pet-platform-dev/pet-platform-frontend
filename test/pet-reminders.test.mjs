import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { load } from "./helpers/load-frontend.mjs";
const m = await load("src/features/pet-care/reminders/model.ts"),
  api = await load("src/features/pet-care/reminders/api.ts"),
  auth = await load("src/shared/api/client.ts"),
  session = await load("src/features/auth/session-provider.tsx");
const { ReminderCard } = await load(
    "src/features/pet-care/reminders/reminder-card.tsx",
  ),
  { ReminderForm } = await load(
    "src/features/pet-care/reminders/reminder-form.tsx",
  ),
  { ReminderList } = await load(
    "src/features/pet-care/reminders/reminder-list.tsx",
  ),
  { RemindersPreview } = await load(
    "src/features/pet-care/reminders/reminders-preview.tsx",
  );
const uid = "76277b42-4a76-5c79-ab69-31acb61de011",
  pid = "86277b42-4a76-5c79-ab69-31acb61de011",
  id = "96277b42-4a76-5c79-ab69-31acb61de011";
const row = {
  id,
  petId: pid,
  title: "Подія <script>alert(1)</script>",
  notes: "Нотатка\nдругий рядок",
  dueAt: "2027-01-20T09:00:00.000Z",
  recurrenceType: "WEEKLY",
  intervalDays: null,
  seriesId: uid,
  status: "PENDING",
  completedAt: null,
  createdAt: "2026-10-14T09:00:00.000Z",
  updatedAt: "2026-10-14T09:00:00.001Z",
};
const page = (rows = [row]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, pages: rows.length ? 1 : 0 },
});
const client = () => {
  const c = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  c.setQueryData(session.sessionKey, { id: uid, role: "USER" });
  return c;
};
function render(c, Component, props) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Component, props),
    ),
  );
}
test("local date/time roundtrip, invalid calendar/time, normalized UTC and past rejection", () => {
  const fields = m.localFields("2027-01-20T09:30:00Z");
  assert.equal(
    m.localDueAt(fields.date, fields.time),
    "2027-01-20T09:30:00.000Z",
  );
  assert.equal(m.localDueAt("2027-02-31", "10:00"), null);
  assert.equal(m.localDueAt("2027-01-20", "25:00"), null);
  assert.throws(
    () => m.formInput("", "", fields.date, fields.time, "NONE", "1"),
    /назву/,
  );
  assert.throws(
    () => m.formInput("Подія", "", "2000-01-01", "10:00", "NONE", "1"),
    /майбутньому/,
  );
  assert.throws(
    () =>
      m.formInput(
        "Подія",
        "x".repeat(1001),
        fields.date,
        fields.time,
        "NONE",
        "1",
      ),
    /1000/,
  );
  assert.deepEqual(
    m.formInput(" Подія ", "  ", fields.date, fields.time, "NONE", "1"),
    {
      title: "Подія",
      notes: null,
      dueAt: "2027-01-20T09:30:00.000Z",
      recurrenceType: "NONE",
      intervalDays: null,
    },
  );
});
test("custom recurrence bounds and Ukrainian labels; overdue is derived only for pending", () => {
  for (const interval of ["0", "366", "1.5", "no"])
    assert.throws(
      () =>
        m.formInput(
          "Подія",
          "",
          "2027-01-20",
          "09:00",
          "CUSTOM_DAYS",
          interval,
        ),
      /365/,
    );
  assert.equal(
    m.formInput("Подія", "", "2027-01-20", "09:00", "CUSTOM_DAYS", "365")
      .intervalDays,
    365,
  );
  assert.equal(m.recurrenceLabel(row), "Щотижня");
  assert.equal(
    m.recurrenceLabel({
      ...row,
      recurrenceType: "CUSTOM_DAYS",
      intervalDays: 3,
    }),
    "Кожні 3 дн.",
  );
  assert.equal(m.overdue(row, Date.parse(row.dueAt) + 1), true);
  assert.equal(
    m.overdue({ ...row, status: "COMPLETED" }, Date.parse(row.dueAt) + 1),
    false,
  );
});
test("card escapes plain text; pending actions/optional notes and completed immutable UI", () => {
  const html = render(client(), ReminderCard, {
    reminder: { ...row, dueAt: "2000-01-01T09:00:00Z" },
    onEdit() {},
    onComplete() {},
    onDelete() {},
  });
  assert.match(html, /Прострочено/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Редагувати/);
  assert.match(html, /Видалити/);
  assert.match(html, /Щотижня/);
  const done = render(client(), ReminderCard, {
    reminder: {
      ...row,
      notes: null,
      status: "COMPLETED",
      completedAt: row.updatedAt,
    },
    onEdit() {},
    onComplete() {},
    onDelete() {},
  });
  assert.doesNotMatch(done, /Прострочено|Редагувати|Нотатка/);
  assert.match(done, /Виконано:/);
  assert.match(done, /Видалити/);
});
test("create/edit form uses labelled shared custom recurrence with no native select; error keeps draft", () => {
  const html = render(client(), ReminderForm, {
    reminder: row,
    onSubmit() {},
    onCancel() {},
    pending: false,
    error: "Не вдалося зберегти нагадування.",
  });
  for (const text of [
    "Назва",
    "Дата",
    "Час",
    "Повторення",
    "Нотатка",
    "Зберегти",
    "Скасувати",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /<select\b/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Час: години/);
  assert.match(html, /value="Подія &lt;script&gt;/);
  assert.match(html, /role="alert"/);
  assert.match(html, /UTC/);
});
test("preview empty/populated/error/loading and nearest five bounded key", () => {
  const c = client(),
    key = m.reminderKeys.list(uid, pid, "PENDING", 1, 5);
  assert.match(render(c, RemindersPreview, { id: pid }), /Завантажуємо/);
  c.setQueryData(key, page([]));
  let html = render(c, RemindersPreview, { id: pid });
  assert.match(html, /Нагадувань ще немає/);
  assert.match(html, /Усі нагадування/);
  assert.match(html, /Додати нагадування/);
  c.setQueryData(key, page());
  html = render(c, RemindersPreview, { id: pid });
  assert.match(html, /Подія/);
  assert.match(html, /Щотижня/);
  c.clear();
});
test("list completed empty, loading, pagination and access error hide stale rows", () => {
  const c = client(),
    props = {
      userId: uid,
      petId: pid,
      status: "COMPLETED",
      onEdit() {},
      onComplete() {},
      onDelete() {},
      pending: false,
    };
  assert.match(render(c, ReminderList, props), /Завантажуємо/);
  const key = m.reminderKeys.list(uid, pid, "COMPLETED");
  c.setQueryData(key, { pages: [page([])], pageParams: [1] });
  assert.match(render(c, ReminderList, props), /Виконаних нагадувань ще немає/);
  c.setQueryData(key, {
    pages: [{ ...page(), meta: { page: 1, limit: 20, total: 21, pages: 2 } }],
    pageParams: [1],
  });
  assert.match(render(c, ReminderList, props), /Показати ще/);
  c.clear();
});
test("logout cancels/removes reminder lists and drafts remain component/session-scoped", async () => {
  const c = client(),
    key = m.reminderKeys.list(uid, pid, "PENDING");
  let resolve;
  const work = c
    .fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise((r) => {
          resolve = r;
        }),
    })
    .catch(() => {});
  const mutation = c.getMutationCache().build(c, {
    mutationKey: ["pet-care", uid, pid, "mutation"],
    mutationFn: async () => row,
  });
  await mutation.execute(undefined);
  assert.equal(c.getMutationCache().getAll().length, 1);
  session.clearPrivateQueries(c);
  assert.equal(c.getMutationCache().getAll().length, 0);
  c.setQueryData(session.sessionKey, { id: "new" });
  resolve(page());
  await work;
  assert.equal(c.getQueryData(key), undefined);
  const source = readFileSync("src/features/auth/require-session.tsx", "utf8");
  assert.match(source, /Fragment key=\{session.data\?\.id\}/);
  c.clear();
});
test("mutation invalidation targets this Pet only and rejects late previous-account results", async () => {
  const c = client(),
    calls = [];
  c.invalidateQueries = async (x) => {
    calls.push(x);
  };
  await api.refreshReminders(c, uid, pid);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].queryKey, ["pet-care", uid, pid, "reminders"]);
  assert.deepEqual(calls[1].queryKey, ["pet-care", uid, pid]);
  assert.equal(calls[1].exact, true);
  c.setQueryData(session.sessionKey, { id: "other" });
  await api.refreshReminders(c, uid, pid);
  assert.equal(calls.length, 2);
  c.clear();
});
test("nested safe login return supports reminders but rejects external/traversal", async () => {
  const { favoriteLoginReturn } = await load(
    "src/features/favorites/login-return.ts",
  );
  const path = m.remindersHref(pid);
  assert.equal(favoriteLoginReturn(path + "?add=1"), path + "?add=1");
  for (const v of [
    "https://evil.invalid" + path,
    path + "/../reminders",
    path + "/edit",
  ])
    assert.equal(favoriteLoginReturn(v), "/account");
});
test("API scopes Pet/id, passes revision and enforces session generation with confirmed responses", async () => {
  const original = global.fetch;
  const calls = [];
  let release;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/auth/login"))
      return new Response(
        JSON.stringify({
          data: {
            user: { id: uid, role: "USER" },
            accessToken: "fixture",
            expiresIn: 900,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    if (String(url).endsWith("/auth/csrf"))
      return new Response(
        JSON.stringify({ data: { csrfToken: "a".repeat(43) } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    return new Response(
      JSON.stringify({
        data: String(url).includes("?") ? [row] : row,
        ...(String(url).includes("?") ? { meta: page().meta } : {}),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    auth.clearSession();
    await auth.signIn("login", {
      email: "fixture@example.invalid",
      password: "password",
    });
    const saved = await api.saveReminder(
      pid,
      {
        title: row.title,
        notes: row.notes,
        dueAt: row.dueAt,
        recurrenceType: row.recurrenceType,
        intervalDays: null,
      },
      row,
    );
    assert.equal(saved.id, id);
    assert.equal(
      JSON.parse(calls.at(-1).options.body).expectedUpdatedAt,
      row.updatedAt,
    );
    assert.equal(calls.at(-1).options.method, "PATCH");
    await api.changeReminder(pid, row, "complete");
    assert.match(calls.at(-1).url, /\/complete$/);
    await api.changeReminder(pid, row, "delete");
    assert.equal(calls.at(-1).options.method, "DELETE");
    assert.equal((await api.getReminders(pid, "PENDING")).data[0].id, id);
    global.fetch = () =>
      new Promise((r) => {
        release = r;
      });
    const pending = api.getReminders(pid, "PENDING");
    await new Promise((r) => setTimeout(r, 0));
    auth.clearSession();
    release(
      new Response(JSON.stringify({ data: [row], meta: page().meta }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await assert.rejects(pending, /Session changed/);
  } finally {
    global.fetch = original;
    auth.clearSession();
  }
});
