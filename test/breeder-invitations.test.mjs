import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "./helpers/load-frontend.mjs";
const { createClaimState } = await load(
  "src/features/breeder/claim/claim-state.ts",
);
const { ApiError } = await load("src/shared/api/client.ts");
const token = "s".repeat(43),
  preview = {
    kennelName: "Синтетичний розплідник",
    description: "Опис",
    website: null,
    startedYear: null,
    expiresAt: "2026-11-01T00:00:00Z",
    draftRevision: "2026-10-24T00:00:00Z",
  };
function capture(c, query = `?token=${token}`) {
  const calls = [];
  c.capture(
    { search: query, pathname: "/claim-breeder" },
    { replaceState: (...args) => calls.push(args) },
  );
  assert.deepEqual(calls, [[null, "", "/claim-breeder"]]);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test("URL capture is memory-only, idempotent under Strict Mode replay, and never auto-claims", async () => {
  const calls = [];
  const c = createClaimState(
    async (raw) => {
      assert.equal(raw, token);
      calls.push("preview");
      return preview;
    },
    async (raw, revision) => {
      assert.equal(raw, token);
      assert.equal(revision, preview.draftRevision);
      calls.push("accept");
      return { ownerId: "owner" };
    },
  );
  capture(c);
  assert.equal(c.snapshot().status, "ready");
  c.capture(
    { search: "", pathname: "/claim-breeder" },
    {
      replaceState() {
        throw Error("must not recapture");
      },
    },
  );
  assert.deepEqual(calls, []);
  c.session("owner:verified");
  await c.inspect();
  assert.equal(c.snapshot().status, "preview");
  assert.deepEqual(calls, ["preview"]);
  await c.accept();
  assert.equal(c.snapshot().status, "success");
  await c.accept();
  assert.deepEqual(calls, ["preview", "accept"]);
  assert(!JSON.stringify(c.snapshot()).includes(token));
});
test("missing, malformed and cleaned full reload cannot submit; duplicate tokens rejected", async () => {
  for (const [q, status] of [
    ["", "missing"],
    ["?token=bad", "malformed"],
    [`?token=${token}&token=${token}`, "malformed"],
  ]) {
    const c = createClaimState(
      async () => {
        throw Error("unexpected");
      },
      async () => {
        throw Error("unexpected");
      },
    );
    capture(c, q);
    c.session("owner");
    await c.inspect();
    await c.accept();
    assert.equal(c.snapshot().status, status);
  }
});
test("duplicate clicks are excluded, temporary failure permits explicit preview and retry", async () => {
  let calls = 0;
  const pending = deferred();
  const c = createClaimState(
    async () => preview,
    async () => {
      calls++;
      if (calls === 1) return pending.promise;
      return { ownerId: "owner" };
    },
  );
  capture(c);
  c.session("owner");
  await c.inspect();
  const first = c.accept();
  await c.accept();
  assert.equal(calls, 1);
  pending.reject(new ApiError(503, "Temporary"));
  await first;
  assert.equal(c.snapshot().status, "error");
  await c.inspect();
  await c.accept();
  assert.equal(c.snapshot().status, "success");
  assert.equal(calls, 2);
});
test("terminal invalid clears token; conflicts preserve invitation for operator resolution", async () => {
  for (const status of [400, 403, 409, 429]) {
    let calls = 0;
    const c = createClaimState(
      async () => {
        calls++;
        if (calls === 1) throw new ApiError(status, "Синтетична помилка");
        return preview;
      },
      async () => ({ ownerId: "owner" }),
    );
    capture(c);
    c.session("owner");
    await c.inspect();
    assert.equal(c.snapshot().status, status === 400 ? "invalid" : "error");
    await c.inspect();
    assert.equal(calls, status === 400 ? 1 : 2);
  }
});
test("logout/account switch discards private preview and ignores delayed old-account responses", async () => {
  const delayed = deferred();
  const c = createClaimState(
    async () => delayed.promise,
    async () => ({ ownerId: "owner" }),
  );
  capture(c);
  c.session("owner-a");
  const request = c.inspect();
  c.session("");
  delayed.resolve(preview);
  await request;
  assert.equal(c.snapshot().preview, null);
  assert.equal(c.snapshot().status, "ready");
  c.session("owner-b");
  await c.inspect();
  assert.equal(c.snapshot().status, "preview");
  assert.equal(c.snapshot().sessionKey, "owner-b");
  assert.notEqual(c.snapshot().sessionKey, "owner-a");
  c.session("owner-a");
  assert.equal(c.snapshot().preview, null);
});
test("a committed old-account acceptance cannot redirect after an account switch", async () => {
  const delayed = deferred();
  const c = createClaimState(
    async () => preview,
    async () => delayed.promise,
  );
  capture(c);
  c.session("owner-a");
  await c.inspect();
  const request = c.accept();
  c.session("owner-b");
  delayed.resolve({ ownerId: "owner-a" });
  assert.equal(await request, null);
  assert.equal(c.snapshot().preview, null);
  await c.inspect();
  assert.equal(c.snapshot().status, "invalid");
});
test("session restoration preserves captured token without a cache or module-global secret", async () => {
  const c = createClaimState(
    async () => preview,
    async () => ({ ownerId: "owner" }),
  );
  capture(c);
  c.session("");
  await c.inspect();
  assert.equal(c.snapshot().status, "ready");
  c.session("restored-owner");
  await c.inspect();
  assert.equal(c.snapshot().status, "preview");
  for (const file of [
    "claim-state.ts",
    "claim-session.tsx",
    "claim-page.tsx",
    "api.ts",
  ]) {
    const source = await readFile("src/features/breeder/claim/" + file, "utf8");
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|document\.cookie|console\./,
    );
  }
});
test("invitation status schema refuses fabricated states and includes claim identity", async () => {
  const { invitationsSchema } = await load(
    "src/features/admin/invitations/api.ts",
  );
  for (const status of ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"])
    assert(
      invitationsSchema.safeParse({
        claimedProfileId: null,
        claimedAt: null,
        claimedOwnerId: null,
        invitations: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            recipientEmail: "synthetic@example.invalid",
            status,
            deliveryState: "CAPTURED",
            createdAt: preview.draftRevision,
            expiresAt: preview.expiresAt,
            terminalAt: null,
            acceptedById: null,
          },
        ],
      }).success,
    );
  assert(
    !invitationsSchema.safeParse({
      claimedProfileId: null,
      claimedAt: null,
      claimedOwnerId: null,
      invitations: [{ status: "DELIVERED" }],
    }).success,
  );
});
