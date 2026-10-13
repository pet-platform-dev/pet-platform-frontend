import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
import {
  adminId,
  id,
  timestamp,
  queueItem,
  detail,
  result,
} from "./helpers/moderation-data.mjs";
const api = await load("src/features/admin/moderation/api.ts"),
  client = await load("src/shared/api/client.ts");
async function transport(work, handler) {
  const saved = globalThis.fetch,
    calls = [];
  client.clearSession();
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/csrf"))
      return new Response(
        JSON.stringify({ data: { csrfToken: "fixture-csrf" } }),
      );
    if (url.endsWith("/refresh"))
      return new Response(
        JSON.stringify({
          data: {
            user: { id: adminId, role: "ADMIN" },
            accessToken: "fixture-token",
            expiresIn: 900,
          },
        }),
      );
    calls.push({ url, init });
    return handler(url, init, calls);
  };
  try {
    await work(calls);
  } finally {
    globalThis.fetch = saved;
    client.clearSession();
  }
}
test("one typed authenticated queue request carries page/filter state and strips private metadata", async () => {
  await transport(
    async (calls) => {
      const response = await api.getModerationQueue({
        type: "REVIEW",
        status: "PENDING",
        page: 2,
      });
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /page=2&limit=24&status=PENDING&type=REVIEW/);
      assert.equal(response.data[0].type, "REVIEW");
      assert.equal(response.data[0].email, undefined);
    },
    () =>
      new Response(
        JSON.stringify({
          data: [{ ...queueItem("REVIEW"), email: "PRIVATE" }],
          meta: { page: 2, limit: 24, total: 25, pages: 2 },
        }),
      ),
  );
});
test("each detail type uses its exact endpoint and requires matching id/type", async () => {
  for (const [type, segment] of [
    ["LISTING", "listings"],
    ["MATING_LISTING", "mating-listings"],
    ["REVIEW", "reviews"],
  ])
    await transport(
      async (calls) => {
        assert.equal((await api.getModerationDetail(type, id)).type, type);
        assert.ok(calls[0].url.endsWith("/" + segment + "/" + id));
      },
      () => new Response(JSON.stringify({ data: detail(type) })),
    );
});
test("all9 decisions send only expected revision and required trimmed reason via CSRF transport", async () => {
  for (const type of ["LISTING", "MATING_LISTING", "REVIEW"])
    for (const action of ["approve", "reject", "hide"])
      await transport(
        async (calls) => {
          await api.moderateContent(
            type,
            id,
            action,
            timestamp,
            action === "approve" ? undefined : "  Виправте опис оголошення.  ",
          );
          const request = calls[0];
          assert.equal(request.init.method, "POST");
          assert.equal(request.init.headers["X-CSRF-Token"], "fixture-csrf");
          assert.match(request.init.headers.Authorization, /Bearer/);
          assert.deepEqual(
            JSON.parse(request.init.body),
            action === "approve"
              ? { expectedUpdatedAt: timestamp }
              : {
                  expectedUpdatedAt: timestamp,
                  reason: "Виправте опис оголошення.",
                },
          );
        },
        () => new Response(JSON.stringify({ data: result(type, action) })),
      );
});
test("409 is surfaced once and never silently retried using a new revision", async () => {
  await transport(
    async (calls) => {
      await assert.rejects(
        () => api.moderateContent("LISTING", id, "approve", timestamp),
        (error) => error.status === 409,
      );
      assert.equal(calls.length, 1);
    },
    () => new Response(JSON.stringify({ message: "stale" }), { status: 409 }),
  );
});
test("malformed id, timestamp or short reason makes no moderation request", async () => {
  await transport(
    async (calls) => {
      await assert.rejects(() => api.getModerationDetail("LISTING", "bad"));
      await assert.rejects(() =>
        api.moderateContent("LISTING", id, "approve", "bad"),
      );
      await assert.rejects(() =>
        api.moderateContent("LISTING", id, "reject", timestamp, "short"),
      );
      assert.equal(calls.length, 0);
    },
    () => {
      throw Error("Unexpected transport");
    },
  );
});
