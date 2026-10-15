import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const { RemindersPage } = await load(
  "src/features/pet-care/reminders/reminders-page.tsx",
);
const { HistoryPage } = await load(
  "src/features/pet-care/history/history-page.tsx",
);
const { RecordsPage } = await load(
  "src/features/pet-care/health-records/records-page.tsx",
);
const { healthDeleteTitle } = await load(
  "src/features/pet-care/health-records/model.ts",
);
const a = "76277b42-4a76-5c79-ab69-31acb61de011",
  b = "86277b42-4a76-5c79-ab69-31acb61de011";
test("Pet Care local draft/dialog/filter/mutation state is remounted when Pet changes", () => {
  for (const [Page, extra] of [
    [RemindersPage, {}],
    [HistoryPage, {}],
    [RecordsPage, { kind: "vaccinations" }],
    [RecordsPage, { kind: "medications" }],
  ]) {
    const first = Page({ id: a, ...extra }).props.children,
      second = Page({ id: b, ...extra }).props.children;
    assert.ok(first.key);
    assert.notEqual(first.key, second.key);
    assert.equal(first.props.id, a);
    assert.equal(second.props.id, b);
  }
  assert.notEqual(
    RecordsPage({ id: a, kind: "vaccinations" }).props.children.key,
    RecordsPage({ id: a, kind: "medications" }).props.children.key,
  );
});
test("health record destructive confirmation explicitly identifies vaccination versus medication", () => {
  assert.equal(
    healthDeleteTitle("vaccinations"),
    "Видалити запис про вакцинацію?",
  );
  assert.equal(healthDeleteTitle("medications"), "Видалити запис про ліки?");
});
