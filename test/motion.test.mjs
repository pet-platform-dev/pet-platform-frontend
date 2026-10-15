import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { SelectDropdown } = await load("src/shared/ui/select-dropdown.tsx");
const { DatePicker } = await load("src/shared/ui/date-time/date-picker.tsx");
const { TimePicker } = await load("src/shared/ui/date-time/time-picker.tsx");
const { NotificationPanel } = await load(
  "src/features/notifications/notification-panel.tsx",
);
test("shared closed selector has no exposed or mounted options before its first open", () => {
  const html = renderToStaticMarkup(
    React.createElement(SelectDropdown, {
      label: "Вид",
      value: "dog",
      options: [{ value: "dog", label: "Собака" }],
      onChange() {},
    }),
  );
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /role="listbox"|<select/);
});
test("calendar and 24-hour time retain labelled custom controls and closed popup semantics", () => {
  const date = renderToStaticMarkup(
    React.createElement(DatePicker, {
      label: "Дата",
      value: "2026-10-15",
      onChange() {},
    }),
  );
  assert.match(date, /aria-expanded="false"/);
  assert.doesNotMatch(date, /role="dialog"|<select/);
  const time = renderToStaticMarkup(
    React.createElement(TimePicker, {
      label: "Час",
      value: "23:59",
      onChange() {},
    }),
  );
  assert.equal((time.match(/role="combobox"/g) || []).length, 2);
  assert.match(time, /23:59/);
  assert.doesNotMatch(time, /AM|PM|<select/);
});
test("closing notification surface is immediately inert and hidden from accessibility", () => {
  const html = renderToStaticMarkup(
    React.createElement(NotificationPanel, {
      id: "notices",
      open: false,
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
    }),
  );
  assert.match(html, /data-motion="closed"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /inert=""/);
});
test("motion policy has bounded shared timings, restrained easing and complete reduced-motion fallback", async () => {
  const css = await readFile("src/shared/ui/motion.css", "utf8");
  assert.match(css, /--motion-fast:\s*160ms/);
  assert.match(css, /--motion-standard:\s*220ms/);
  assert.match(css, /--motion-large:\s*280ms/);
  const reduced = css.slice(
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  assert.match(reduced, /animation:\s*none\s*!important/);
  assert.match(reduced, /transition:\s*none\s*!important/);
  assert.match(reduced, /transform:\s*none\s*!important/);
  assert.match(reduced, /scroll-behavior:\s*auto\s*!important/);
  assert.match(css, /\.button:is\(:disabled,\s*\[aria-disabled="true"\]\)/);
  assert.equal((css.match(/cubic-bezier\(/g) || []).length, 2);
});
