import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/load-frontend.mjs";
const api = await load("src/features/reports/api.ts"),
  client = await load("src/shared/api/client.ts");
const id = "76277b42-4a76-5c79-ab69-31acb61de011",
  stamp = "2026-10-13T00:00:00.000Z";
const record = {
  id,
  targetType: "REVIEW",
  targetId: id,
  targetPreview: "Відгук",
  reason: "SPAM",
  status: "OPEN",
  createdAt: stamp,
  updatedAt: stamp,
  resolvedAt: null,
  reporter: { id, displayName: "Заявник" },
  details: null,
  resolutionReason: null,
};
async function transport(work, handler) {
  const saved = fetch,
    calls = [];
  client.clearSession();
  globalThis.fetch = async (url, init) => {
    if (url.endsWith("/csrf"))
      return new Response(JSON.stringify({ data: { csrfToken: "csrf" } }));
    if (url.endsWith("/refresh"))
      return new Response(
        JSON.stringify({
          data: { user: { id }, accessToken: "fixture", expiresIn: 900 },
        }),
      );
    calls.push({ url, init });
    return handler(url, init);
  };
  try {
    await work(calls);
  } finally {
    globalThis.fetch = saved;
    client.clearSession();
  }
}
test("report POST sends only target/reason/trimmed details with CSRF and bounded success", async () => {
  await transport(
    async (calls) => {
      const r = await api.createReport(
        "REVIEW",
        id,
        "OTHER",
        "  Детальні обставини  ",
      );
      assert.equal(r.id, id);
      assert.deepEqual(JSON.parse(calls[0].init.body), {
        targetType: "REVIEW",
        targetId: id,
        reason: "OTHER",
        details: "Детальні обставини",
      });
      assert.equal(calls[0].init.headers["X-CSRF-Token"], "csrf");
      assert.equal(r.reporterId, undefined);
    },
    () =>
      new Response(
        JSON.stringify({
          data: { id, status: "OPEN", createdAt: stamp, reporterId: "PRIVATE" },
        }),
      ),
  );
});

test("MESSAGE submission reuses report API and duplicate conflict is authoritative without retry", async () => {
  await transport(
    async (calls) => {
      const result = await api.createReport("MESSAGE", id, "SPAM", "  Текст  ");
      assert.equal(result.status, "OPEN");
      assert.deepEqual(JSON.parse(calls[0].init.body), {
        targetType: "MESSAGE",
        targetId: id,
        reason: "SPAM",
        details: "Текст",
      });
      assert.equal(calls[0].init.headers["X-CSRF-Token"], "csrf");
    },
    () =>
      new Response(
        JSON.stringify({ data: { id, status: "OPEN", createdAt: stamp } }),
      ),
  );
  await transport(
    async (calls) => {
      await assert.rejects(
        api.createReport("MESSAGE", id, "SPAM", ""),
        (e) => e.status === 409,
      );
      assert.equal(calls.length, 1);
    },
    () =>
      new Response(
        JSON.stringify({ message: "Ваша скарга на цей матеріал уже відкрита" }),
        { status: 409 },
      ),
  );
});
test("report queue is one request with24/page and URL filters, detail only on open", async () => {
  await transport(
    async (calls) => {
      const q = await api.getReports({
        status: "DISMISSED",
        type: "REVIEW",
        page: 2,
      });
      assert.equal(calls.length, 1);
      assert.match(
        calls[0].url,
        /status=DISMISSED&page=2&limit=24&type=REVIEW/,
      );
      assert.equal(q.data[0].reporter.email, undefined);
    },
    () =>
      new Response(
        JSON.stringify({
          data: [
            {
              ...record,
              detailsExcerpt: null,
              reporter: { ...record.reporter, email: "PRIVATE" },
            },
          ],
          meta: { page: 2, limit: 24, total: 25, pages: 2 },
        }),
      ),
  );
  await transport(
    async (calls) => {
      assert.equal((await api.getReport(id)).target, null);
      assert.equal(calls.length, 1);
    },
    () => new Response(JSON.stringify({ data: { ...record, target: null } })),
  );
});
test("resolve/dismiss are separate revision-checked requests;409 never retries", async () => {
  for (const action of ["resolve", "dismiss"])
    await transport(
      async (calls) => {
        await api.decideReport(id, action, stamp, "  Детальна примітка  ");
        assert.ok(calls[0].url.endsWith("/" + action));
        assert.deepEqual(JSON.parse(calls[0].init.body), {
          expectedUpdatedAt: stamp,
          reason: "Детальна примітка",
        });
      },
      () =>
        new Response(
          JSON.stringify({ data: { ...record, status: "RESOLVED" } }),
        ),
    );
  await transport(
    async (calls) => {
      await assert.rejects(
        api.createReport("REVIEW", id, "SPAM", ""),
        (e) => e.status === 409,
      );
      assert.equal(calls.length, 1);
    },
    () =>
      new Response(JSON.stringify({ message: "duplicate" }), { status: 409 }),
  );
});
