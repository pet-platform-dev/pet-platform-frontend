import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { dashboardSchema, metricLabels } = await load(
  "src/features/admin/dashboard/model.ts",
);
const { DashboardCards } = await load("src/features/admin/dashboard/cards.tsx");
const { RequireAdmin } = await load(
  "src/features/admin/moderation/require-admin.tsx",
);
const { clearPrivateQueries, isSessionQuery } = await load(
  "src/features/auth/session-provider.tsx",
);
const { runAdminRequest } = await load(
  "src/features/admin/moderation/cache.ts",
);
const { ApiError } = await load("src/shared/api/client.ts");
const { favoriteLoginReturn } = await load(
  "src/features/favorites/login-return.ts",
);
const snapshot = () => ({
  asOf: "2026-10-24T10:00:00.000Z",
  metrics: Object.fromEntries(Object.keys(metricLabels).map((key) => [key, 0])),
});
const owner = {
  id: "admin-A",
  role: "ADMIN",
  email: "synthetic@example.invalid",
};
test("dashboard contract accepts genuine zero counts, rejects impossible counters and strips unexpected private fields", () => {
  const value = snapshot();
  assert.deepEqual(
    dashboardSchema.parse({ ...value, passwordHash: "private" }),
    value,
  );
  for (const users of [-1, 1.5, "3", Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      dashboardSchema.safeParse({
        ...value,
        metrics: { ...value.metrics, users },
      }).success,
      false,
    );
  assert.equal(
    dashboardSchema.safeParse({ ...value, asOf: "invalid" }).success,
    false,
  );
});
test("cards render eight labelled real counts including zero and formatted large values without invented trends", () => {
  const data = snapshot();
  data.metrics.users = 12345;
  const html = renderToStaticMarkup(
    React.createElement(DashboardCards, { data }),
  );
  assert.equal((html.match(/<dt>/g) ?? []).length, 8);
  assert(html.includes(new Intl.NumberFormat("uk-UA").format(12345)));
  for (const { title, description } of Object.values(metricLabels)) {
    assert(html.includes(title));
    assert(html.includes(description));
  }
  assert.equal((html.match(/<dd>0<\/dd>/g) ?? []).length, 7);
});
test("shared admin boundary renders no dashboard during guest restoration or for technical non-admin roles", () => {
  for (const actor of [
    null,
    { ...owner, role: "USER" },
    { ...owner, role: "BREEDER" },
    owner,
  ]) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["current-user"], actor);
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          RequireAdmin,
          { returnTo: "/admin" },
          "PRIVATE-ADMIN-CONTENT",
        ),
      ),
    );
    assert.equal(
      html.includes("PRIVATE-ADMIN-CONTENT"),
      actor?.role === "ADMIN",
    );
    if (actor && actor.role !== "ADMIN")
      assert(html.includes("лише адміністратору"));
    client.clear();
  }
});
test("dashboard belongs to private cache cleanup and a 403 removes existing statistics without touching public listings", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], owner);
  client.setQueryData(["admin-dashboard", owner.id], snapshot());
  client.setQueryData(["listings"], ["public"]);
  assert.equal(
    isSessionQuery({ queryKey: ["admin-dashboard", owner.id] }),
    true,
  );
  await assert.rejects(
    runAdminRequest(client, owner.id, async () => {
      throw new ApiError(403, "denied");
    }),
  );
  assert.equal(client.getQueryData(["admin-dashboard", owner.id]), undefined);
  assert.deepEqual(client.getQueryData(["listings"]), ["public"]);
  client.setQueryData(["admin-dashboard", owner.id], snapshot());
  clearPrivateQueries(client);
  assert.equal(client.getQueryData(["admin-dashboard", owner.id]), undefined);
  client.clear();
});
test("late aggregate response is rejected after switching away from its administrator", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], owner);
  let release;
  const pending = runAdminRequest(
    client,
    owner.id,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  client.setQueryData(["current-user"], { id: "user-B", role: "USER" });
  release(snapshot());
  await assert.rejects(pending, (error) => error.name === "AbortError");
  client.clear();
});
test("login return accepts only implemented admin routes and keeps redirect protection", () => {
  assert.equal(favoriteLoginReturn("/admin"), "/admin");
  for (const target of [
    "/admin/settings",
    "https://evil.invalid/admin",
    "//evil.invalid/admin",
    "/admin/../users",
  ])
    assert.equal(favoriteLoginReturn(target), "/account");
});
