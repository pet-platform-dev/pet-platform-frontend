import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const m = await load("src/features/pet-care/history/model.ts"),
  api = await load("src/features/pet-care/history/api.ts"),
  auth = await load("src/shared/api/client.ts"),
  session = await load("src/features/auth/session-provider.tsx"),
  time = await load("src/features/pet-care/date-time.ts");
const { HistoryCard } = await load(
    "src/features/pet-care/history/history-card.tsx",
  ),
  { HistoryForm } = await load(
    "src/features/pet-care/history/history-form.tsx",
  ),
  { HistoryPreview } = await load(
    "src/features/pet-care/history/history-preview.tsx",
  ),
  { HistoryList } = await load(
    "src/features/pet-care/history/history-list.tsx",
  ),
  { HistoryContent } = await load(
    "src/features/pet-care/history/history-page.tsx",
  );
const uid = "76277b42-4a76-5c79-ab69-31acb61de011",
  pid = "86277b42-4a76-5c79-ab69-31acb61de011",
  id = "96277b42-4a76-5c79-ab69-31acb61de011";
const row = {
  id,
  petId: pid,
  type: "GROOMING",
  title: "Купання <script>plain</script>",
  notes: null,
  occurredAt: "2020-01-20T09:00:00.000Z",
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
test("shared local conversion accepts past/now, rejects invalid/future and field bounds", () => {
  const f = time.localFields(row.occurredAt);
  assert.equal(time.localDueAt(f.date, f.time), row.occurredAt);
  assert.equal(
    m.historyInput("GROOMING", " Купання ", " ", f.date, f.time).notes,
    null,
  );
  for (const [title, notes, date, clock] of [
    ["", "", f.date, f.time],
    ["x".repeat(141), "", f.date, f.time],
    ["Подія", "x".repeat(2001), f.date, f.time],
    ["Подія", "", "2020-02-31", "10:00"],
    ["Подія", "", "2090-01-20", "10:00"],
  ])
    assert.throws(() => m.historyInput("OTHER", title, notes, date, clock));
  assert.equal(m.historyTypes.length, 6);
  assert.equal(m.historyTypeLabel("VET_VISIT"), "Візит до ветеринара");
  assert.equal(
    m.historyEntrySchema.safeParse({ ...row, type: "VACCINATION" }).success,
    false,
  );
});
test("card escapes plain text, shows type/date, optional notes and progressive long-note expansion", () => {
  let html = render(client(), HistoryCard, {
    entry: row,
    onEdit() {},
    onDelete() {},
  });
  assert.match(html, /Грумінг/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|<details|Нотатка:/);
  assert.match(html, /Редагувати/);
  assert.match(html, /Видалити/);
  html = render(client(), HistoryCard, {
    entry: { ...row, notes: "Нотатка ".repeat(100) },
  });
  assert.match(html, /<details/);
  assert.match(html, /Показати повністю/);
  assert.match(html, /<summary/);
  assert.doesNotMatch(
    render(client(), HistoryCard, {
      entry: { ...row, notes: "PRIVATE" },
      preview: true,
    }),
    /PRIVATE/,
  );
});
test("form reuses labelled custom dropdown/date/time, current default and preserves failed draft", () => {
  const html = render(client(), HistoryForm, {
    entry: row,
    onSubmit() {},
    onCancel() {},
    pending: false,
    error: "Не вдалося зберегти запис.",
  });
  for (const label of [
    "Тип події",
    "Назва",
    "Дата",
    "Час",
    "Нотатка",
    "Зберегти",
    "Скасувати",
  ])
    assert.ok(html.includes(label));
  assert.match(html, /role="combobox"/);
  assert.doesNotMatch(html, /<select\b|Діагноз|Дозування/);
  assert.match(html, /type="date"/);
  assert.match(html, /value="Купання &lt;script&gt;/);
  assert.match(html, /role="alert"/);
  const empty = render(client(), HistoryForm, {
    onSubmit() {},
    onCancel() {},
    pending: false,
    error: "",
  });
  assert.ok(
    empty.includes(
      'value="' + time.localFields(new Date().toISOString()).date + '"',
    ),
  );
});
test("dashboard latest-three preview skeleton, empty and canonical returned ordering", () => {
  const c = client(),
    key = m.historyKeys.list(uid, pid, "ALL", 3);
  assert.match(render(c, HistoryPreview, { id: pid }), /Завантажуємо історію/);
  c.setQueryData(key, page([]));
  assert.match(
    render(c, HistoryPreview, { id: pid }),
    /Історія догляду порожня/,
  );
  assert.match(render(c, HistoryPreview, { id: pid }), /Уся історія/);
  c.setQueryData(
    key,
    page([
      row,
      { ...row, id: uid, title: "Older", occurredAt: "2019-01-01T00:00:00Z" },
    ]),
  );
  const html = render(c, HistoryPreview, { id: pid });
  assert.ok(html.indexOf("Купання") < html.indexOf("Older"));
  assert.doesNotMatch(html, /Редагувати|Видалити/);
  c.clear();
});
test("bounded filtered infinite list empty/load-more and stale errors hide rows safely", async () => {
  const c = client(),
    key = m.historyKeys.list(uid, pid, "GROOMING"),
    props = {
      uid,
      id: pid,
      type: "GROOMING",
      onEdit() {},
      onDelete() {},
      pending: false,
    };
  c.setQueryData(key, { pages: [page([])], pageParams: [1] });
  assert.match(render(c, HistoryList, props), /Записів цього типу ще немає/);
  c.setQueryData(key, {
    pages: [{ ...page(), meta: { page: 1, limit: 20, total: 21, pages: 2 } }],
    pageParams: [1],
  });
  assert.match(render(c, HistoryList, props), /Показати ще/);
  await c
    .fetchQuery({
      queryKey: key,
      queryFn: () => Promise.reject(new auth.ApiError(500, "RAW_PRIVATE")),
    })
    .catch(() => {});
  const html = render(c, HistoryList, props);
  assert.match(html, /Не вдалося завантажити історію/);
  assert.match(html, /Спробувати ще раз/);
  assert.doesNotMatch(html, /Купання|RAW_PRIVATE/);
  c.clear();
});
test("foreign Pet page conceals cached identity/history and controls", async () => {
  const c = client();
  c.setQueryData(["pet-care", uid, pid], {
    id: pid,
    name: "PRIVATE",
    gender: "UNKNOWN",
    birthDate: null,
    breed: null,
    profileImage: null,
    species: { id: uid, name: "Dog", slug: "dog" },
  });
  await c
    .fetchQuery({
      queryKey: ["pet-care", uid, pid],
      queryFn: () => Promise.reject(new auth.ApiError(404, "RAW_PRIVATE")),
    })
    .catch(() => {});
  const html = render(c, HistoryContent, { id: pid });
  assert.match(html, /Тварину не знайдено або у вас немає доступу/);
  assert.doesNotMatch(html, /Тип події|Додати запис|RAW_PRIVATE/);
  c.clear();
});
test("logout removes entries/mutation results; late old request cannot repopulate new-account keys", async () => {
  const c = client(),
    key = m.historyKeys.list(uid, pid);
  let release;
  const pending = c
    .fetchQuery({
      queryKey: key,
      queryFn: () =>
        new Promise((r) => {
          release = r;
        }),
    })
    .catch(() => {});
  const mutation = c.getMutationCache().build(c, {
    mutationKey: ["pet-care", uid, pid, "history-mutation"],
    mutationFn: async () => row,
  });
  await mutation.execute(undefined);
  session.clearPrivateQueries(c);
  c.setQueryData(session.sessionKey, { id: "B" });
  release(page());
  await pending;
  assert.equal(c.getQueryData(key), undefined);
  assert.equal(c.getMutationCache().getAll().length, 0);
  c.clear();
});
test("history invalidation touches only this Pet history prefix, not reminders or another account", async () => {
  const c = client(),
    calls = [];
  c.invalidateQueries = async (v) => {
    calls.push(v.queryKey);
  };
  await api.refreshHistory(c, uid, pid);
  assert.deepEqual(calls, [["pet-care", uid, pid, "history"]]);
  c.setQueryData(session.sessionKey, { id: "B" });
  await api.refreshHistory(c, uid, pid);
  assert.equal(calls.length, 1);
  c.clear();
});
test("safe nested login return rejects external/traversal and public preview remains separate", async () => {
  const { favoriteLoginReturn } = await load(
    "src/features/favorites/login-return.ts",
  );
  const path = m.historyHref(pid);
  assert.equal(favoriteLoginReturn(path + "?add=1"), path + "?add=1");
  for (const v of [
    "https://evil.invalid" + path,
    path + "/../history",
    path + "/record",
  ])
    assert.equal(favoriteLoginReturn(v), "/account");
  const { PublicAnimalCard } = await load(
    "src/features/breeder/animals/public-breeder-animals.tsx",
  );
  assert.equal(typeof PublicAnimalCard, "function");
  const publicHtml = render(client(), PublicAnimalCard, {
    animal: {
      id: pid,
      name: "Публічна тварина",
      species: { id: uid, slug: "dog", name: "Dog" },
      breed: null,
      gender: "UNKNOWN",
      birthDate: null,
      previewImage: null,
      currentListing: null,
      activeMatingListing: null,
      careEntries: [{ ...row, title: "PRIVATE_HISTORY_CANARY" }],
    },
  });
  assert.doesNotMatch(
    publicHtml,
    /PRIVATE_HISTORY_CANARY|care\/history|Історія догляду/,
  );
  const parsed = m.historyEntrySchema.parse({
    ...row,
    ownerId: uid,
    healthNotes: "PRIVATE",
  });
  assert.equal(parsed.healthNotes, undefined);
  assert.equal(parsed.ownerId, undefined);
});
test("API creates/edits/deletes with revision, Pet scope and generation checks", async () => {
  const saved = global.fetch,
    calls = [];
  let release;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    let data = String(url).endsWith("/auth/csrf")
      ? { csrfToken: "a".repeat(43) }
      : String(url).endsWith("/auth/login")
        ? { user: { id: uid }, accessToken: "fixture", expiresIn: 900 }
        : String(url).includes("?")
          ? [row]
          : row;
    return new Response(
      JSON.stringify({
        data,
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
    assert.equal(
      (
        await api.saveHistory(pid, {
          type: row.type,
          title: row.title,
          notes: null,
          occurredAt: row.occurredAt,
        })
      ).id,
      id,
    );
    assert.equal(calls.at(-1).options.method, "POST");
    await api.saveHistory(
      pid,
      {
        type: row.type,
        title: row.title,
        notes: null,
        occurredAt: row.occurredAt,
      },
      row,
    );
    assert.equal(
      JSON.parse(calls.at(-1).options.body).expectedUpdatedAt,
      row.updatedAt,
    );
    await api.deleteHistory(pid, row);
    assert.equal(calls.at(-1).options.method, "DELETE");
    assert.equal((await api.getHistory(pid, "GROOMING")).data[0].id, id);
    assert.match(calls.at(-1).url, /type=GROOMING/);
    global.fetch = () =>
      new Promise((r) => {
        release = r;
      });
    const pending = api.getHistory(pid);
    await new Promise((r) => setTimeout(r, 0));
    auth.clearSession();
    release(
      new Response(JSON.stringify(page()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await assert.rejects(pending, /Session changed/);
  } finally {
    global.fetch = saved;
    auth.clearSession();
  }
});
