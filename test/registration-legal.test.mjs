import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { load } from "./helpers/load-frontend.mjs";

const model = await load("src/features/legal/registration/legal-metadata.ts");
const { createRegistrationLegalState } = await load(
  "src/features/legal/registration/registration-legal-state.ts",
);
const { RegistrationAcknowledgement } = await load(
  "src/features/legal/registration/registration-acknowledgement.tsx",
);
const client = await load("src/shared/api/client.ts");
const { legalContentIdentity } = await load(
  "src/features/legal/content/content-integrity.ts",
);
const draft = () => ({
  acceptanceRequired: false,
  terms: { ...legalContentIdentity.terms, effectiveAt: null },
  privacy: { ...legalContentIdentity.privacy, effectiveAt: null },
});
const published = (version = "synthetic-v1") => ({
  acceptanceRequired: true,
  ...Object.fromEntries(
    Object.entries(draft())
      .filter(([key]) => key !== "acceptanceRequired")
      .map(([kind, doc]) => [
        kind,
        {
          ...doc,
          version,
          status: "PUBLISHED",
          effectiveAt: "2020-01-01T00:00:00.000Z",
          contentDigest: "a".repeat(64),
        },
      ]),
  ),
});
const state = (loader, identity = published()) =>
  createRegistrationLegalState(loader, (metadata) =>
    model.matchesLegalContent(metadata, identity),
  );
const html = (snapshot, props = {}) =>
  renderToStaticMarkup(
    React.createElement(RegistrationAcknowledgement, {
      state: snapshot,
      pending: false,
      onCheck() {},
      onRetry() {},
      ...props,
    }),
  );
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

test("metadata validates draft and synthetic published contracts; unknown/incomplete/mixed metadata fails closed", () => {
  assert.equal(model.parseLegalMetadata(draft()).acceptanceRequired, false);
  assert.equal(model.parseLegalMetadata(published()).acceptanceRequired, true);
  for (const value of [
    null,
    {},
    { ...draft(), acceptanceRequired: true },
    { ...published(), acceptanceRequired: false },
    { ...draft(), token: "private" },
    { ...draft(), terms: { ...draft().terms, path: "https://evil.example" } },
    { ...published(), privacy: { ...published().privacy, effectiveAt: null } },
    {
      ...published(),
      terms: { ...published().terms, effectiveAt: "2999-01-01T00:00:00.000Z" },
    },
  ])
    assert.throws(() => model.parseLegalMetadata(value));
});
test("current frontend draft content cannot acknowledge published metadata; mismatched digest/version/status blocks", async () => {
  assert.equal(model.matchesLegalContent(published()), false);
  const metadata = published();
  assert.equal(model.matchesLegalContent(metadata, metadata), true);
  for (const field of ["version", "contentDigest", "status", "path"]) {
    const identity = structuredClone(metadata);
    identity.privacy[field] = "mismatch";
    assert.equal(model.matchesLegalContent(metadata, identity), false);
  }
  const controller = createRegistrationLegalState(async () => metadata);
  await controller.refresh();
  assert.equal(controller.snapshot().status, "mismatch");
  assert.deepEqual(controller.acceptance(), { ok: false });
});
test("loading renders no checkbox and prevents unknown registration", () => {
  const controller = state(async () => draft());
  assert.deepEqual(controller.acceptance(), { ok: false });
  assert.match(html(controller.snapshot()), /Завантажуємо/);
  assert.doesNotMatch(html(controller.snapshot()), /type="checkbox"/);
});
test("draft registration is usable without fabricating acceptance and links stay visible", async () => {
  const controller = state(async () => draft());
  await controller.refresh();
  controller.check(true);
  assert.equal(controller.snapshot().checked, false);
  assert.deepEqual(controller.acceptance(), { ok: true });
  assert.doesNotMatch(
    JSON.stringify(controller.acceptance()),
    /legalAcceptance/,
  );
  const output = html(controller.snapshot());
  assert.match(output, /чернетками/);
  assert.doesNotMatch(output, /type="checkbox"/);
  assert.match(output, /href="\/terms"/);
  assert.match(output, /href="\/privacy"/);
});
test("published checkbox starts unchecked, associates errors, and sends exactly the presented versions", async () => {
  const controller = state(async () => published());
  await controller.refresh();
  assert.equal(controller.snapshot().checked, false);
  assert.deepEqual(controller.acceptance(), { ok: false });
  const output = html(controller.snapshot());
  assert.match(output, /aria-invalid="true"/);
  assert.match(output, /aria-describedby="registration-legal-error"/);
  assert.match(output, /id="registration-legal-error"/);
  assert.doesNotMatch(output, / checked=""/);
  controller.check(true);
  assert.deepEqual(controller.acceptance(), {
    ok: true,
    legalAcceptance: {
      accepted: true,
      termsVersion: "synthetic-v1",
      privacyVersion: "synthetic-v1",
    },
  });
  assert.equal(controller.snapshot().error, "");
  controller.check(false);
  assert.deepEqual(controller.acceptance(), { ok: false });
});
test("legal links are independent from the checkbox label and announce a new tab", async () => {
  const controller = state(async () => published());
  await controller.refresh();
  const output = html(controller.snapshot());
  assert.doesNotMatch(output.match(/<label[\s\S]*?<\/label>/)[0], /<a /);
  assert.equal((output.match(/target="_blank"/g) ?? []).length, 2);
  assert.equal((output.match(/rel="noopener noreferrer"/g) ?? []).length, 2);
  assert.match(output, /відкриється в новій вкладці/);
  assert.match(html(controller.snapshot(), { pending: true }), /disabled=""/);
});
test("metadata outage is blocked with retry, never treated as draft; retry starts unchecked", async () => {
  let fail = true;
  const controller = state(async () => {
    if (fail) throw Error("PRIVATE_DIAGNOSTIC");
    return published();
  });
  await controller.refresh();
  assert.equal(controller.snapshot().status, "error");
  assert.deepEqual(controller.acceptance(), { ok: false });
  assert.match(html(controller.snapshot()), /Спробувати ще раз/);
  assert.doesNotMatch(html(controller.snapshot()), /PRIVATE_DIAGNOSTIC/);
  fail = false;
  await controller.refresh();
  assert.equal(controller.snapshot().status, "ready");
  assert.equal(controller.snapshot().checked, false);
});
for (const kind of ["terms", "privacy"])
  test(`stale ${kind} refresh resets acknowledgement and never silently accepts the new pair`, async () => {
    let metadata = published();
    const controller = state(async () => metadata, metadata);
    await controller.refresh();
    controller.check(true);
    assert.equal(controller.acceptance().ok, true);
    metadata = {
      ...metadata,
      [kind]: { ...metadata[kind], version: "synthetic-v2" },
    };
    await controller.refresh(true);
    assert.equal(controller.snapshot().status, "mismatch");
    assert.equal(controller.snapshot().checked, false);
    assert.equal(controller.snapshot().changed, true);
    assert.equal(controller.acceptance().ok, false);
    // Only a matching new frontend build can present the new pair for review.
    const updated = state(async () => metadata, metadata);
    await updated.refresh();
    assert.equal(updated.snapshot().checked, false);
    updated.check(true);
    assert.equal(
      updated.acceptance().legalAcceptance[`${kind}Version`],
      "synthetic-v2",
    );
  });
test("late in-flight metadata cannot overwrite newer state, and cancelled loads cannot update a remounted form", async () => {
  const slow = deferred();
  let calls = 0;
  const controller = state(async () =>
    ++calls === 1 ? slow.promise : draft(),
  );
  const old = controller.refresh();
  await controller.refresh(true);
  slow.resolve(published());
  await old;
  assert.equal(controller.snapshot().metadata.acceptanceRequired, false);
  assert.equal(controller.snapshot().changed, true);
  const pending = deferred();
  const cancelled = state(async () => pending.promise);
  const task = cancelled.refresh();
  cancelled.cancel();
  pending.resolve(published());
  await task;
  assert.equal(cancelled.snapshot().status, "loading");
});
test("metadata request contains no registration data or bearer token and uses no-store/AbortSignal on every load", async () => {
  const saved = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json({ data: draft() });
  };
  try {
    await model.loadLegalMetadata(new AbortController().signal);
    await model.loadLegalMetadata(new AbortController().signal);
    assert.equal(calls.length, 2);
    for (const { url, init } of calls) {
      assert.match(url, /\/api\/v1\/legal\/current$/);
      assert.equal(init.cache, "no-store");
      assert.ok(init.signal);
      assert.equal(init.body, undefined);
      assert.equal(init.headers.Authorization, undefined);
    }
  } finally {
    globalThis.fetch = saved;
  }
});
test("API preserves only allowlisted structured legal codes, never arbitrary server details", async () => {
  const saved = globalThis.fetch;
  try {
    for (const code of [
      "LEGAL_ACCEPTANCE_REQUIRED",
      "LEGAL_ACCEPTANCE_NOT_CONFIRMED",
      "LEGAL_ACCEPTANCE_INVALID",
      "LEGAL_VERSION_STALE",
      "LEGAL_VERSION_UNKNOWN",
      "LEGAL_DOCUMENTS_UNPUBLISHED",
      "LEGAL_REGISTRY_MISMATCH",
    ]) {
      globalThis.fetch = async () =>
        Response.json(
          {
            message: "PRIVATE_STACK",
            details: [
              { field: "legalAcceptance", code, message: "PRIVATE_STACK" },
              { field: "legalAcceptance", code: "PRIVATE_UNKNOWN" },
            ],
          },
          { status: 400 },
        );
      await assert.rejects(
        () => client.publicRequest("/auth/register"),
        (error) => {
          assert.equal(Boolean(model.legalRegistrationRecovery(error)), true);
          assert.equal(error.details.length, 1);
          assert.equal(error.details[0].code, code);
          assert.doesNotMatch(JSON.stringify(error), /PRIVATE/);
          return true;
        },
      );
    }
    assert.equal(
      Boolean(
        model.legalRegistrationRecovery(new client.ApiError(409, "duplicate")),
      ),
      false,
    );
    assert.equal(
      Boolean(model.legalRegistrationRecovery(Error("LEGAL_VERSION_STALE"))),
      false,
    );
  } finally {
    globalThis.fetch = saved;
  }
});
test("the generated small identity matches local source through the pinned legal digest contract", () => {
  execFileSync(
    process.execPath,
    ["scripts/sync-legal-integrity.mjs", "--check"],
    { stdio: "pipe" },
  );
});
