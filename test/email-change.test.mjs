import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";
const { emailChangeSchema } = await load(
  "src/features/auth/email-change/validation.ts",
);
const api = await load("src/features/auth/email-change/api.ts");
const session = await load("src/features/auth/session-provider.tsx");
const { EmailChangeSettings } = await load(
  "src/features/auth/email-change/settings.tsx",
);
const { EmailChangeConfirmation } = await load(
  "src/features/auth/email-change/confirmation.tsx",
);
const { EmailChangeSession } = await load(
  "src/features/auth/email-change/confirmation-session.tsx",
);
const { AccountVerification } = await load(
  "src/features/auth/email-verification/account-verification.tsx",
);
const user = {
  id: "self",
  email: "current@example.invalid",
  verificationStatus: "VERIFIED",
};
test("email change normalizes address and reuses current password rules without trimming", () => {
  assert.deepEqual(
    emailChangeSchema.parse({
      newEmail: " NEW@Example.invalid ",
      currentPassword: " password ",
    }),
    { newEmail: "new@example.invalid", currentPassword: " password " },
  );
  for (const input of [
    { newEmail: "bad", currentPassword: "valid-pass" },
    { newEmail: "x@example.invalid", currentPassword: "short" },
    { newEmail: "x@example.invalid", currentPassword: "x".repeat(129) },
  ])
    assert(!emailChangeSchema.safeParse(input).success);
});
test("settings integrates without replacing current email/status or exposing passwords in SSR", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      AccountVerification,
      { user },
      React.createElement(EmailChangeSettings, { user }),
    ),
  );
  assert.match(html, /current@example.invalid/);
  assert.match(html, /Електронну пошту підтверджено/);
  assert.match(html, /Змінити електронну пошту/);
  assert(!html.includes('name="currentPassword"'));
});
test("pending response is minimal/nullable and owner cache is removed at session boundaries", () => {
  assert.deepEqual(
    api.pendingChangeSchema.parse({
      pending: {
        newEmail: "new@example.invalid",
        expiresAt: "2026-10-24T10:00:00.000Z",
        tokenHash: "private",
        userId: "other",
      },
      token: "private",
    }),
    {
      pending: {
        newEmail: "new@example.invalid",
        expiresAt: "2026-10-24T10:00:00.000Z",
      },
    },
  );
  assert.deepEqual(api.pendingChangeSchema.parse({ pending: null }), {
    pending: null,
  });
  const client = new QueryClient();
  client.setQueryData(api.pendingChangeKey("self"), { pending: null });
  client.setQueryData(["public-catalog"], "public");
  session.clearPrivateQueries(client);
  assert.equal(client.getQueryData(api.pendingChangeKey("self")), undefined);
  assert.equal(client.getQueryData(["public-catalog"]), "public");
  client.clear();
});
test("public confirmation sends only token through CSRF/no-store without auth adoption", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({
      data: String(url).endsWith("/csrf")
        ? { csrfToken: "synthetic-csrf" }
        : { status: "changed" },
    });
  });
  await api.confirmEmailChange("a".repeat(43));
  const request = calls.at(-1);
  assert(request.url.endsWith("/auth/email-change/confirm"));
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, undefined);
  assert.equal(request.init.headers["X-CSRF-Token"], "synthetic-csrf");
  assert.equal(request.init.credentials, "include");
  assert.equal(request.init.cache, "no-store");
  assert.deepEqual(JSON.parse(request.init.body), { token: "a".repeat(43) });
  assert(!calls.some((call) => /login|refresh/.test(call.url)));
});
test("public SSR is neutral and no credential enters server markup", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      EmailChangeSession,
      null,
      React.createElement(EmailChangeConfirmation),
    ),
  );
  assert.match(html, /Підтвердження зміни пошти/);
  assert.match(html, /Готуємо підтвердження/);
  assert(!html.includes("Підтвердити зміну пошти"));
  assert.match(html, /href="\/login"/);
});
test("sensitive route/controller stays public, dynamic, private-memory only and does not auto-submit", async () => {
  const page = await readFile("src/app/confirm-email-change/page.tsx", "utf8");
  assert.match(page, /force-dynamic/);
  assert.match(page, /no-referrer/);
  assert.match(page, /index: false/);
  assert.doesNotMatch(page, /searchParams|RequireSession/);
  for (const file of [
    "confirmation-session.tsx",
    "confirmation.tsx",
    "settings.tsx",
    "api.ts",
  ]) {
    const s = await readFile("src/features/auth/email-change/" + file, "utf8");
    assert.doesNotMatch(
      s,
      /localStorage|sessionStorage|document\.cookie|console\./,
    );
  }
  const settings = await readFile(
    "src/features/auth/email-change/settings.tsx",
    "utf8",
  );
  assert.match(settings, /currentSessionGeneration/);
  assert.doesNotMatch(settings, /setQueryData/);
});
