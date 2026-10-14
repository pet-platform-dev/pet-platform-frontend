import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const m = await load("src/features/pet-care/health-records/model.ts"),
  api = await load("src/features/pet-care/health-records/api.ts"),
  auth = await load("src/shared/api/client.ts"),
  session = await load("src/features/auth/session-provider.tsx"),
  time = await load("src/features/pet-care/date-time.ts"),
  cal = await load("src/shared/ui/date-time/calendar.ts");
const { RecordForm } = await load(
    "src/features/pet-care/health-records/record-form.tsx",
  ),
  { RecordCard } = await load(
    "src/features/pet-care/health-records/record-card.tsx",
  ),
  { RecordPreview } = await load(
    "src/features/pet-care/health-records/record-preview.tsx",
  ),
  { RecordList } = await load(
    "src/features/pet-care/health-records/record-list.tsx",
  ),
  { RecordsContent } = await load(
    "src/features/pet-care/health-records/records-page.tsx",
  ),
  { DatePicker } = await load("src/shared/ui/date-time/date-picker.tsx"),
  { TimePicker } = await load("src/shared/ui/date-time/time-picker.tsx");
const uid = "76277b42-4a76-5c79-ab69-31acb61de011",
  pid = "86277b42-4a76-5c79-ab69-31acb61de011",
  id = "96277b42-4a76-5c79-ab69-31acb61de011",
  date = "2020-01-20T09:00:00.000Z";
const row = {
    id,
    petId: pid,
    name: "Запис <script>plain</script>",
    notes: null,
    administeredAt: date,
    nextDueAt: null,
    createdAt: date,
    updatedAt: date,
  },
  med = {
    id,
    petId: pid,
    name: "Ліки",
    notes: null,
    startedAt: date,
    endedAt: null,
    createdAt: date,
    updatedAt: date,
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
function render(c, C, props) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(C, props),
    ),
  );
}
test("calendar Monday-first grid, leap years, month clamping and boundary navigation", () => {
  assert.equal(cal.calendarWeekdays[0], "Пн");
  assert.equal(cal.monthLength(2024, 1), 29);
  assert.equal(cal.monthLength(2025, 1), 28);
  assert.equal(cal.calendarMonth("2024-01-31", 2024, 1), "2024-02-29");
  assert.equal(cal.moveCalendar("2024-02-29", 1), "2024-03-01");
  assert.equal(cal.moveCalendar("2025-01-01", -1), "2024-12-31");
  const cells = cal.monthCells("2026-10-15");
  assert.equal(cells.length, 42);
  assert.equal(cells[3], "2026-10-01");
  assert.equal(cells.filter(Boolean).length, 31);
  assert.equal(cal.dateButtonLabel("2026-10-15"), "15.10.2026");
});
test("custom calendar trigger and 24h minute-precision dropdowns have no native browser inputs or AM/PM", () => {
  const c = client();
  const dateHtml = render(c, DatePicker, {
    label: "Дата",
    value: "2026-10-15",
    onChange() {},
  });
  assert.match(dateHtml, /aria-haspopup="dialog"/);
  assert.match(dateHtml, /15.10.2026/);
  assert.doesNotMatch(dateHtml, /<input|<select/);
  for (const value of ["00:00", "08:00", "16:00", "23:45", "09:32"]) {
    const html = render(c, TimePicker, { label: "Час", value, onChange() {} });
    assert.ok(html.includes(value));
    assert.doesNotMatch(html, /<input|<select|\bAM\b|\bPM\b/);
    assert.match(html, /Час: години/);
    assert.match(html, /Час: хвилини/);
  }
  assert.equal(cal.timeHours.length, 24);
  assert.equal(cal.timeHours[23].value, "23");
  assert.equal(cal.timeMinutes.length, 60);
  assert.equal(cal.timeMinutes[32].value, "32");
  assert.doesNotMatch(time.careDate(date), /\bAM\b|\bPM\b/);
  c.clear();
});
test("UTC/local roundtrip and explicit optional pair/date ordering validation", () => {
  const f = time.localFields(date);
  assert.equal(time.localDueAt(f.date, f.time), date);
  assert.equal(time.localDueAt("2025-02-29", "10:00"), null);
  const valid = m.healthInput(
    "vaccinations",
    " Назва ",
    " ",
    f.date,
    f.time,
    false,
    "",
    "",
  );
  assert.equal(valid.nextDueAt, null);
  assert.equal(valid.notes, null);
  for (const args of [
    ["vaccinations", "", "", f.date, f.time, false, "", ""],
    ["vaccinations", "Назва", "", f.date, f.time, true, f.date, ""],
    ["vaccinations", "Назва", "", f.date, f.time, true, f.date, f.time],
    ["medications", "Назва", "", f.date, f.time, true, "2019-01-01", "10:00"],
    ["medications", "Назва", "", "2090-01-01", "10:00", false, "", ""],
  ])
    assert.throws(() => m.healthInput(...args));
  assert.equal(
    m.healthInput(
      "medications",
      "Назва",
      "",
      f.date,
      f.time,
      true,
      f.date,
      f.time,
    ).endedAt,
    date,
  );
});
for (const kind of ["vaccinations", "medications"]) {
  const r = kind === "vaccinations" ? row : med;
  test(
    kind +
      " form uses shared custom controls, optional dates are explicit, failed input retained",
    () => {
      const c = client(),
        html = render(c, RecordForm, {
          kind,
          record: r,
          onSubmit() {},
          onCancel() {},
          pending: false,
          error: "Не вдалося зберегти запис.",
        });
      assert.match(html, /aria-haspopup="dialog"/);
      assert.match(html, /години/);
      assert.match(html, /хвилини/);
      assert.match(html, /type="checkbox"/);
      assert.doesNotMatch(
        html,
        /<select|type="date"|type="time"|\bAM\b|\bPM\b/,
      );
      assert.match(html, /role="alert"/);
      assert.ok(
        html.includes(
          kind === "vaccinations" ? "Назва вакцини" : "Дата початку",
        ),
      );
      assert.ok(
        html.includes(
          kind === "vaccinations" ? "Запис &lt;script&gt;" : "Ліки",
        ),
      );
      c.clear();
    },
  );
  test(
    kind +
      " preview/list empty, bounded load-more, safe stale error and public/private projection",
    async () => {
      const c = client(),
        previewKey = m.healthKeys.list(uid, pid, kind, 3);
      assert.match(
        render(c, RecordPreview, { id: pid, kind }),
        /Завантажуємо записи/,
      );
      c.setQueryData(previewKey, page([]));
      assert.ok(
        render(c, RecordPreview, { id: pid, kind }).includes(
          m.healthEmpty(kind),
        ),
      );
      c.setQueryData(previewKey, page([r]));
      assert.ok(
        render(c, RecordPreview, { id: pid, kind }).includes(
          r.name.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
        ),
      );
      const key = m.healthKeys.list(uid, pid, kind),
        props = {
          uid,
          id: pid,
          kind,
          onEdit() {},
          onDelete() {},
          pending: false,
        };
      c.setQueryData(key, {
        pages: [
          { ...page([r]), meta: { page: 1, limit: 20, total: 21, pages: 2 } },
        ],
        pageParams: [1],
      });
      assert.match(render(c, RecordList, props), /Показати ще/);
      await c
        .fetchQuery({
          queryKey: key,
          queryFn: () => Promise.reject(new auth.ApiError(500, "PRIVATE_RAW")),
        })
        .catch(() => {});
      const html = render(c, RecordList, props);
      assert.match(html, /Не вдалося завантажити записи/);
      assert.doesNotMatch(html, /PRIVATE_RAW|&lt;script&gt;/);
      c.clear();
    },
  );
}
test("cards escape text, show neutral past-next date, open-ended medication and expandable notes", () => {
  const c = client();
  let html = render(c, RecordCard, {
    record: {
      ...row,
      nextDueAt: "2021-01-20T09:00:00Z",
      notes: "Нотатка ".repeat(100),
    },
    onEdit() {},
    onDelete() {},
  });
  assert.match(html, /Запланована дата минула/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<details/);
  assert.match(html, /Редагувати/);
  assert.match(html, /Видалити/);
  assert.doesNotMatch(html, /<script>|небезпека|доза/);
  assert.match(render(c, RecordCard, { record: med }), /Триває/);
  assert.match(
    render(c, RecordCard, { record: { ...med, endedAt: "2021-01-20T09:00Z" } }),
    /Завершення:/,
  );
  c.clear();
});
test("foreign page hides controls/records; logout clears query/mutation and late old responses", async () => {
  const c = client(),
    careKey = ["pet-care", uid, pid];
  c.setQueryData(careKey, {
    id: pid,
    name: "PRIVATE_A",
    gender: "UNKNOWN",
    birthDate: null,
    breed: null,
    profileImage: null,
    species: { id: uid, name: "Dog", slug: "dog" },
  });
  await c
    .fetchQuery({
      queryKey: careKey,
      queryFn: () => Promise.reject(new auth.ApiError(404, "RAW")),
    })
    .catch(() => {});
  assert.match(
    render(c, RecordsContent, { id: pid, kind: "vaccinations" }),
    /Тварину не знайдено або у вас немає доступу/,
  );
  assert.doesNotMatch(
    render(c, RecordsContent, { id: pid, kind: "vaccinations" }),
    /PRIVATE_A|Додати вакцинацію/,
  );
  const key = m.healthKeys.list(uid, pid, "medications");
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
    mutationKey: ["pet-care", uid, pid, "medications", "mutation"],
    mutationFn: async () => med,
  });
  await mutation.execute(undefined);
  session.clearPrivateQueries(c);
  c.setQueryData(session.sessionKey, { id: "B" });
  release(page([med]));
  await pending;
  assert.equal(c.getQueryData(key), undefined);
  assert.equal(c.getMutationCache().getAll().length, 0);
  c.clear();
});
test("only relevant Pet/kind list and preview invalidate; safe returns and no public canary", async () => {
  const c = client(),
    calls = [];
  c.invalidateQueries = async (v) => {
    calls.push(v.queryKey);
  };
  await api.refreshHealth(c, uid, pid, "vaccinations");
  assert.deepEqual(calls, [["pet-care", uid, pid, "vaccinations"]]);
  c.setQueryData(session.sessionKey, { id: "B" });
  await api.refreshHealth(c, uid, pid, "medications");
  assert.equal(calls.length, 1);
  const { favoriteLoginReturn } = await load(
    "src/features/favorites/login-return.ts",
  );
  for (const kind of ["vaccinations", "medications"])
    assert.equal(
      favoriteLoginReturn(m.healthHref(pid, kind)),
      m.healthHref(pid, kind),
    );
  assert.equal(
    favoriteLoginReturn(
      "https://evil.invalid" + m.healthHref(pid, "vaccinations"),
    ),
    "/account",
  );
  const { PublicAnimalCard } = await load(
    "src/features/breeder/animals/public-breeder-animals.tsx",
  );
  const html = render(c, PublicAnimalCard, {
    animal: {
      id: pid,
      name: "Публічна тварина",
      species: { id: uid, name: "Dog", slug: "dog" },
      breed: null,
      gender: "UNKNOWN",
      birthDate: null,
      previewImage: null,
      currentListing: null,
      activeMatingListing: null,
      vaccinations: [{ ...row, name: "PRIVATE_VAX" }],
      medications: [{ ...med, name: "PRIVATE_MED" }],
    },
  });
  assert.doesNotMatch(
    html,
    /PRIVATE_VAX|PRIVATE_MED|care\/vaccinations|care\/medications/,
  );
  c.clear();
});
test("authenticated APIs preserve scope/revision and reject late session changes", async () => {
  const saved = global.fetch,
    calls = [];
  let release;
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const r = String(url).includes("medications") ? med : row;
    const data = String(url).endsWith("/auth/csrf")
      ? { csrfToken: "a".repeat(43) }
      : String(url).endsWith("/auth/login")
        ? { user: { id: uid }, accessToken: "fixture", expiresIn: 900 }
        : String(url).includes("?")
          ? [r]
          : r;
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
    for (const [kind, r] of [
      ["vaccinations", row],
      ["medications", med],
    ]) {
      const input =
        kind === "vaccinations"
          ? { name: r.name, notes: null, administeredAt: date, nextDueAt: null }
          : { name: r.name, notes: null, startedAt: date, endedAt: null };
      assert.equal((await api.saveHealth(pid, kind, input, r)).id, id);
      assert.equal(
        JSON.parse(calls.at(-1).options.body).expectedUpdatedAt,
        date,
      );
      assert.equal((await api.getHealth(pid, kind)).data[0].id, id);
      await api.deleteHealth(pid, kind, r);
      assert.equal(calls.at(-1).options.method, "DELETE");
    }
    global.fetch = () =>
      new Promise((r) => {
        release = r;
      });
    const pending = api.getHealth(pid, "vaccinations");
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

test("Kyiv DST boundary preserves valid local instants and rejects nonexistent spring time", async () => {
  const { spawnSync } = await import("node:child_process");
  const run = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from 'node:assert/strict';
    import { load } from './test/helpers/load-frontend.mjs';
    const {localDueAt, localFields}=await load('src/features/pet-care/date-time.ts');
    for(const [date,time,utc] of [
      ['2026-03-29','02:30','2026-03-29T00:30:00.000Z'],
      ['2026-03-29','04:30','2026-03-29T01:30:00.000Z'],
      ['2026-10-25','02:30','2026-10-24T23:30:00.000Z'],
      ['2026-10-25','04:30','2026-10-25T02:30:00.000Z']
    ]) { assert.equal(localDueAt(date,time),utc);assert.deepEqual(localFields(utc),{date,time}); }
    assert.equal(localDueAt('2026-03-29','03:30'),null);
  `,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, TZ: "Europe/Kyiv" },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
