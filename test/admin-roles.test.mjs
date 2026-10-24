import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { hasAdminAccess, hasRoleManagement } = await load(
  "src/entities/user/permissions.ts",
);
const { RoleEditor } = await load("src/features/admin/roles/role-editor.tsx");
const { RolePanel } = await load("src/features/admin/roles/role-panel.tsx");
const { RoleDialog } = await load("src/features/admin/roles/role-dialog.tsx");
const { roleHistorySchema, editableRoles, runRoleRequest, changeRole } =
  await load("src/features/admin/roles/api.ts");
const { clearPrivateQueries, isSessionQuery } = await load(
  "src/features/auth/session-provider.tsx",
);
const { ApiError, clearSession } = await load("src/shared/api/client.ts");
const id = "11111111-1111-4111-8111-111111111111",
  targetId = "22222222-2222-4222-8222-222222222222",
  operationId = "33333333-3333-4333-8333-333333333333",
  timestamp = "2026-01-01T00:00:00.000Z";
const data = { currentRole: "USER", updatedAt: timestamp, entries: [] };
test("password dialog labels explicit validation feedback and keeps confirmation separate from cancellation", () => {
  const error = "Перевірте поточний пароль.";
  const html = renderToStaticMarkup(
    React.createElement(RoleDialog, {
      from: "Користувач",
      to: "Модератор",
      pending: false,
      error,
      onClose() {},
      onSubmit: async () => {},
      returnFocus() {},
    }),
  );
  assert(html.includes('noValidate=""'));
  assert(
    html.includes('type="password"') &&
      html.includes('autoComplete="current-password"'),
  );
  assert(html.includes('aria-invalid="true"') && html.includes('role="alert"'));
  assert(html.includes(error));
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
  assert.equal((html.match(/type="button"/g) ?? []).length, 1);
});
function render(actor, component) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["current-user"], actor);
  try {
    return renderToStaticMarkup(
      React.createElement(QueryClientProvider, { client }, component),
    );
  } finally {
    client.clear();
  }
}
test("explicit capabilities inherit ADMIN only for SUPER_ADMIN, while role management remains exclusive", () => {
  for (const role of [
    null,
    "USER",
    "BREEDER",
    "MODERATOR",
    "ADMIN",
    "SUPER_ADMIN",
  ]) {
    assert.equal(hasAdminAccess(role), ["ADMIN", "SUPER_ADMIN"].includes(role));
    assert.equal(hasRoleManagement(role), role === "SUPER_ADMIN");
  }
  assert.deepEqual(editableRoles, ["USER", "MODERATOR", "ADMIN"]);
});
test("editor renders only for SUPER_ADMIN, never for self/protected target; ordinary ADMIN has no privileged panel", () => {
  for (const role of ["USER", "BREEDER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]) {
    const actor = { id, role };
    const editor = render(
      actor,
      React.createElement(RoleEditor, {
        targetId,
        data,
        refresh() {},
        onSuccess() {},
      }),
    );
    assert.equal(editor.includes("Змінити роль"), role === "SUPER_ADMIN");
    if (role !== "SUPER_ADMIN")
      assert.equal(
        render(actor, React.createElement(RolePanel, { targetId })),
        "",
      );
  }
  assert.equal(
    render(
      { id, role: "SUPER_ADMIN" },
      React.createElement(RoleEditor, {
        targetId: id,
        data,
        refresh() {},
        onSuccess() {},
      }),
    ),
    "",
  );
  assert.equal(
    render(
      { id, role: "SUPER_ADMIN" },
      React.createElement(RoleEditor, {
        targetId,
        data: { ...data, currentRole: "SUPER_ADMIN" },
        refresh() {},
        onSuccess() {},
      }),
    ),
    "",
  );
});
test("history strips credentials, supports explicit operator origin and rejects unsupported roles", () => {
  const history = {
    ...data,
    entries: [
      {
        operationId,
        actorId: null,
        targetUserId: targetId,
        previousRole: "ADMIN",
        newRole: "SUPER_ADMIN",
        origin: "LOCAL_OPERATOR",
        createdAt: timestamp,
        currentPassword: "not-retained",
      },
    ],
  };
  assert.equal(
    roleHistorySchema.parse(history).entries[0].currentPassword,
    undefined,
  );
  assert.equal(
    roleHistorySchema.safeParse({ ...data, currentRole: "ROOT" }).success,
    false,
  );
});
test("same-account demotion blocks late privileged work and private cleanup removes role history without public invalidation", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id, role: "SUPER_ADMIN" });
  let release;
  const pending = runRoleRequest(
    client,
    id,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  client.setQueryData(["current-user"], { id, role: "ADMIN" });
  release(data);
  await assert.rejects(pending, { name: "AbortError" });
  let called = false;
  await assert.rejects(
    runRoleRequest(client, id, async () => {
      called = true;
    }),
  );
  assert.equal(called, false);
  const key = ["admin-roles", id, targetId];
  assert.equal(isSessionQuery({ queryKey: key }), true);
  client.setQueryData(key, data);
  client.setQueryData(["breeder-directory"], "public");
  clearPrivateQueries(client);
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(client.getQueryData(["breeder-directory"]), "public");
  client.clear();
});
test("role API sends one explicit revision/operation/password request through Bearer and CSRF, surfaces no-op and failures without retries", async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [200, 400, 401, 403, 409, 429]) {
      clearSession();
      let calls = 0;
      globalThis.fetch = async (url, init) => {
        if (url.endsWith("/csrf"))
          return new Response(
            JSON.stringify({ data: { csrfToken: "synthetic-csrf" } }),
          );
        if (url.endsWith("/refresh"))
          return new Response(
            JSON.stringify({
              data: {
                user: { id, role: "SUPER_ADMIN" },
                accessToken: "synthetic-token",
                expiresIn: 900,
              },
            }),
          );
        if (url.endsWith("/me"))
          return new Response(
            JSON.stringify({ data: { id, role: "SUPER_ADMIN" } }),
          );
        calls++;
        assert.equal(init.method, "PATCH");
        assert.equal(init.headers.Authorization, "Bearer synthetic-token");
        assert.equal(init.headers["X-CSRF-Token"], "synthetic-csrf");
        assert.deepEqual(JSON.parse(init.body), {
          role: "USER",
          expectedRole: "USER",
          expectedUpdatedAt: timestamp,
          operationId,
          currentPassword: "synthetic-password-18b1",
        });
        return new Response(
          JSON.stringify({
            data: {
              changed: false,
              role: "USER",
              updatedAt: timestamp,
              operationId,
            },
          }),
          { status },
        );
      };
      const work = changeRole(targetId, {
        role: "USER",
        expectedRole: "USER",
        expectedUpdatedAt: timestamp,
        operationId,
        currentPassword: "synthetic-password-18b1",
      });
      if (status === 200) assert.equal((await work).changed, false);
      else
        await assert.rejects(
          work,
          (error) => error instanceof ApiError && error.status === status,
        );
      assert.equal(calls, status === 401 ? 2 : 1);
    }
  } finally {
    globalThis.fetch = original;
    clearSession();
  }
});
