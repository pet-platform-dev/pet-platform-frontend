import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";

const client = await load("src/shared/api/client.ts");
const model = await load(
  "src/features/auth/email-verification/verification-state.ts",
);
const api = await load("src/features/auth/email-verification/api.ts");
const sync = await load("src/features/auth/email-verification/session-sync.ts");
const { AccountVerification } = await load(
  "src/features/auth/email-verification/account-verification.tsx",
);
const { EmailConfirmation } = await load(
  "src/features/auth/email-verification/confirmation.tsx",
);
const { ConfirmationSession } = await load(
  "src/features/auth/email-verification/confirmation-session.tsx",
);
const token = "a".repeat(43);
const user = {
  id: "self",
  email: "synthetic@example.invalid",
  firstName: "Тест",
  lastName: "Перевірка",
  avatarUrl: null,
  accountType: "SELLER",
  role: "USER",
  verificationStatus: "UNVERIFIED",
  createdAt: "2026-01-01T00:00:00Z",
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const capture = (controller, search = `?token=${token}`) => {
  const calls = [],
    original = { __NA: true, tree: "synthetic" };
  controller.capture(
    { search, pathname: "/verify-email" },
    { state: original, replaceState: (...args) => calls.push(args) },
  );
  assert.deepEqual(calls, [[null, "", "/verify-email"]]);
  return calls;
};

test("capture removes credential query/history but never confirms on opening, including strict effect replay", async () => {
  let calls = 0;
  const controller = model.createConfirmationState(async () => {
    calls++;
  });
  capture(controller);
  assert.equal(controller.snapshot().status, "ready");
  assert.equal(calls, 0);
  controller.capture(
    { search: "", pathname: "/verify-email" },
    {
      replaceState() {
        throw Error("recapture");
      },
    },
  );
  assert.equal(controller.snapshot().status, "ready");
  assert(!JSON.stringify(controller.snapshot()).includes(token));
  await controller.submit();
  assert.equal(calls, 1);
  assert.equal(controller.snapshot().status, "success");
  await controller.submit();
  assert.equal(calls, 1);
});
test("missing, malformed and duplicate credentials never POST; refresh after scrub is graceful", async () => {
  for (const [query, status] of [
    ["", "missing"],
    ["?code=anything", "missing"],
    ["?token=bad", "malformed"],
    [`?token=${token}&token=${token}`, "malformed"],
    ["?token=" + token + "a", "malformed"],
  ]) {
    let calls = 0;
    const controller = model.createConfirmationState(async () => {
      calls++;
    });
    capture(controller, query);
    await controller.submit();
    assert.equal(calls, 0);
    assert.equal(controller.snapshot().status, status);
  }
});
test("explicit confirmation is single-flight and transient errors retain memory for retry", async () => {
  const wait = deferred();
  let calls = 0;
  const controller = model.createConfirmationState(async () => {
    calls++;
    if (calls === 1) await wait.promise;
  });
  capture(controller);
  const pending = controller.submit();
  await controller.submit();
  assert.equal(calls, 1);
  assert.equal(controller.snapshot().status, "pending");
  wait.reject(new client.ApiError(503, "secret internal error"));
  await pending;
  assert.equal(controller.snapshot().status, "temporary");
  await controller.submit();
  assert.equal(calls, 2);
  assert.equal(controller.snapshot().status, "success");
});
test("expired/used/unknown/already-verified share safe 400 state and cannot replay from UI", async () => {
  for (const message of ["expired", "used", "unknown", "already verified"]) {
    let calls = 0;
    const controller = model.createConfirmationState(async () => {
      calls++;
      throw new client.ApiError(400, message);
    });
    capture(controller);
    await controller.submit();
    assert.equal(controller.snapshot().status, "invalid");
    await controller.submit();
    assert.equal(calls, 1);
  }
});
test("confirmation throttling respects optional Retry-After without guessing time when absent", async () => {
  let now = 1000,
    calls = 0;
  const controller = model.createConfirmationState(
    async () => {
      calls++;
      if (calls === 1) throw new client.ApiError(429, "private", [], 10);
    },
    () => now,
  );
  capture(controller);
  await controller.submit();
  assert.equal(controller.snapshot().retryAt, 11000);
  await controller.submit();
  assert.equal(calls, 1);
  now = 11000;
  await controller.submit();
  assert.equal(controller.snapshot().status, "success");
});
test("resend is self-only, single-flight, local cooldown follows acceptance and server stays authoritative", async () => {
  let now = 1000,
    calls = 0;
  const wait = deferred();
  const controller = model.createResendState(
    async () => {
      calls++;
      if (calls === 1) await wait.promise;
      return "accepted";
    },
    () => true,
    () => now,
  );
  const pending = controller.submit();
  await controller.submit();
  assert.equal(calls, 1);
  wait.resolve();
  await pending;
  assert.deepEqual(controller.snapshot(), {
    status: "accepted",
    retryAt: 61000,
  });
  await controller.submit();
  assert.equal(calls, 1);
  now = 61000;
  await controller.submit();
  assert.equal(calls, 2);
});
test("resend handles 429 without invented cooldown, provider uncertainty, expiry and already-verified", async () => {
  for (const [error, status] of [
    [new client.ApiError(429, "server"), "limited"],
    [new client.ApiError(503, "provider"), "temporary"],
    [new client.ApiError(401, "session"), "unauthenticated"],
  ]) {
    const controller = model.createResendState(
      async () => {
        throw error;
      },
      () => true,
    );
    await controller.submit();
    assert.deepEqual(controller.snapshot(), { status, retryAt: 0 });
  }
  let calls = 0;
  const verified = model.createResendState(
    async () => {
      calls++;
      return "already_verified";
    },
    () => true,
  );
  await verified.submit();
  await verified.submit();
  assert.equal(calls, 1);
});
test("late resend response after account/session change is discarded", async () => {
  let current = true;
  const wait = deferred();
  const controller = model.createResendState(
    async () => {
      await wait.promise;
      return "accepted";
    },
    () => current,
  );
  const pending = controller.submit();
  current = false;
  wait.resolve();
  await pending;
  assert.notEqual(controller.snapshot().status, "accepted");
});
test("public confirmation uses CSRF, cookies and no-store, without refresh/login/session acceptance", async () => {
  client.clearSession();
  const saved = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/csrf"))
      return Response.json({ data: { csrfToken: "synthetic-csrf" } });
    if (url.endsWith("/confirm"))
      return Response.json({ data: { verificationStatus: "VERIFIED" } });
    throw Error("Unexpected auth request");
  };
  try {
    const generation = client.currentSessionGeneration();
    await api.confirmEmail(token);
    assert.equal(client.currentSessionGeneration(), generation);
    const call = calls.find((row) => row.url.endsWith("/confirm"));
    assert(call);
    assert.equal(call.init.method, "POST");
    assert.deepEqual(JSON.parse(call.init.body), { token });
    assert.equal(call.init.headers["X-CSRF-Token"], "synthetic-csrf");
    assert.equal(call.init.headers.Authorization, undefined);
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.credentials, "include");
    assert(!calls.some((row) => /refresh|login|register/.test(row.url)));
  } finally {
    globalThis.fetch = saved;
    client.clearSession();
  }
});
test("authenticated resend uses shared bearer/CSRF and exact empty body; safe retry metadata does not expose provider body", async () => {
  const saved = globalThis.fetch,
    calls = [];
  let limited = false;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/csrf"))
      return Response.json({ data: { csrfToken: "synthetic-csrf" } });
    if (url.endsWith("/login"))
      return Response.json({
        data: { user, accessToken: "synthetic-access", expiresIn: 900 },
      });
    if (url.endsWith("/resend"))
      return limited
        ? Response.json(
            { message: "SECRET_PROVIDER_TOKEN" },
            { status: 429, headers: { "Retry-After": "90" } },
          )
        : Response.json({ data: { status: "accepted" } });
    throw Error("Unexpected request");
  };
  try {
    await client.signIn("login", { email: user.email, password: "synthetic" });
    assert.equal(await api.resendEmail(), "accepted");
    const call = calls.find((row) => row.url.endsWith("/resend"));
    assert.deepEqual(JSON.parse(call.init.body), {});
    assert.equal(call.init.headers.Authorization, "Bearer synthetic-access");
    assert.equal(call.init.headers["X-CSRF-Token"], "synthetic-csrf");
    limited = true;
    await assert.rejects(
      api.resendEmail(),
      (error) =>
        error.retryAfterSeconds === 90 && !error.message.includes("SECRET"),
    );
  } finally {
    globalThis.fetch = saved;
    client.clearSession();
  }
});
test("Retry-After accepts bounded seconds or HTTP dates, rejects absent/unsafe values", () => {
  assert.equal(client.retryAfterSeconds("60"), 60);
  assert.equal(
    client.retryAfterSeconds("Thu, 01 Jan 1970 00:01:00 GMT", 0),
    60,
  );
  for (const value of [null, "garbage", "0", "999999999", "-1"])
    assert.equal(client.retryAfterSeconds(value), undefined);
});
test("session sync re-reads current account for same-user or different-user confirmation without adopting a foreign identity", async () => {
  for (const id of ["self", "different"]) {
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    let calls = 0;
    cache.setQueryData(["current-user"], { ...user, id });
    const observer = new QueryObserver(cache, {
      queryKey: ["current-user"],
      queryFn: async () => {
        calls++;
        return {
          ...user,
          id,
          verificationStatus: id === "self" ? "VERIFIED" : "UNVERIFIED",
        };
      },
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await sync.refreshVerificationSession(
        cache,
        client.currentSessionGeneration(),
      );
      assert.equal(calls, 1);
      assert.equal(cache.getQueryData(["current-user"]).id, id);
      assert.equal(
        cache.getQueryData(["current-user"]).verificationStatus,
        id === "self" ? "VERIFIED" : "UNVERIFIED",
      );
    } finally {
      unsubscribe();
      cache.clear();
    }
  }
});
test("guest and obsolete generation never refetch or repopulate private identity", async () => {
  const cache = new QueryClient();
  cache.setQueryData(["current-user"], null);
  await sync.refreshVerificationSession(
    cache,
    client.currentSessionGeneration(),
  );
  assert.equal(cache.getQueryData(["current-user"]), null);
  cache.setQueryData(["current-user"], user);
  const generation = client.currentSessionGeneration();
  client.clearSession();
  await sync.refreshVerificationSession(cache, generation);
  assert.equal(cache.getQueryState(["current-user"]).isInvalidated, false);
  cache.clear();
});
test("SSR public confirmation is neutral, account status/email use server projection without claiming delivery", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      ConfirmationSession,
      null,
      React.createElement(EmailConfirmation),
    ),
  );
  assert.match(markup, /Підтвердження пошти/);
  assert(!markup.includes(token));
  for (const status of ["UNVERIFIED", "PENDING", "REJECTED", "VERIFIED"]) {
    const html = renderToStaticMarkup(
      React.createElement(AccountVerification, {
        user: { ...user, verificationStatus: status },
      }),
    );
    assert.match(html, /synthetic@example.invalid/);
    assert.match(
      html,
      status === "VERIFIED"
        ? /Електронну пошту підтверджено/
        : /Електронну пошту не підтверджено/,
    );
    assert.equal(
      html.includes("Надіслати лист повторно"),
      status !== "VERIFIED",
    );
    assert(!html.includes("Ми надіслали"));
  }
});
test("route is public, noindex/no-referrer/dynamic; credential code has no persistent storage or logs", async () => {
  const route = await readFile("src/app/verify-email/page.tsx", "utf8"),
    config = await readFile("next.config.ts", "utf8");
  assert.match(route, /force-dynamic/);
  assert.match(route, /index: false/);
  assert.match(route, /no-referrer/);
  assert.doesNotMatch(route, /RequireSession|searchParams/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /X-Robots-Tag/);
  for (const file of [
    "verification-state.ts",
    "confirmation.tsx",
    "confirmation-session.tsx",
    "api.ts",
  ]) {
    const source = await readFile(
      "src/features/auth/email-verification/" + file,
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|document\.cookie|console\./,
    );
  }
});
