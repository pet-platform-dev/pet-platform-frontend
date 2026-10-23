import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { load } from "./helpers/load-frontend.mjs";
import { renderToStaticMarkup } from "./helpers/render-with-session.mjs";

const { forgotPasswordSchema, resetPasswordSchema } = await load(
  "src/features/auth/password-recovery/validation.ts",
);
const { createConfirmationState } = await load(
  "src/features/auth/email-verification/verification-state.ts",
);
const { ApiError } = await load("src/shared/api/client.ts");
const api = await load("src/features/auth/password-recovery/api.ts");
const { ForgotPassword, recoveryAcceptedCopy } = await load(
  "src/features/auth/password-recovery/forgot-password.tsx",
);
const { ResetPassword } = await load(
  "src/features/auth/password-recovery/reset-password.tsx",
);
const { ResetSession } = await load(
  "src/features/auth/password-recovery/reset-session.tsx",
);
const token = "r".repeat(43),
  password = "Synthetic-password-42";
const capture = (controller, search = `?token=${token}`) => {
  const history = [];
  controller.capture(
    { pathname: "/reset-password", search },
    { replaceState: (...args) => history.push(args) },
  );
  assert.deepEqual(history, [[null, "", "/reset-password"]]);
};
test("recovery normalizes email and reuses the exact existing password bounds without trimming passwords", () => {
  assert.equal(
    forgotPasswordSchema.parse({ email: " USER@Example.invalid " }).email,
    "user@example.invalid",
  );
  assert(!forgotPasswordSchema.safeParse({ email: "bad" }).success);
  for (const value of ["short", "x".repeat(129)])
    assert(
      !resetPasswordSchema.safeParse({
        newPassword: value,
        confirmPassword: value,
      }).success,
    );
  assert(
    !resetPasswordSchema.safeParse({
      newPassword: password,
      confirmPassword: "other",
    }).success,
  );
  assert.equal(
    resetPasswordSchema.parse({
      newPassword: " password ",
      confirmPassword: " password ",
    }).newPassword,
    " password ",
  );
});
test("reset captures before URL cleanup, retains original token across strict replay and sends only explicit input once", async () => {
  let release;
  const calls = [];
  const controller = createConfirmationState(async (raw, input) => {
    calls.push({ raw, input });
    await new Promise((resolve) => {
      release = resolve;
    });
  });
  capture(controller);
  controller.capture(
    { pathname: "/reset-password", search: "" },
    { replaceState: () => assert.fail("capture repeated") },
  );
  assert.equal(controller.snapshot().status, "ready");
  assert.equal(calls.length, 0);
  const first = controller.submit(password);
  await controller.submit(password);
  assert.deepEqual(calls, [{ raw: token, input: password }]);
  assert(!JSON.stringify(controller.snapshot()).includes(token));
  assert(!JSON.stringify(controller.snapshot()).includes(password));
  release();
  await first;
  assert.equal(controller.snapshot().status, "success");
  await controller.submit(password);
  assert.equal(calls.length, 1);
});
test("missing/malformed tokens including a cleaned full reload cannot submit", async () => {
  for (const search of ["", "?token=bad", `?token=${token}&token=${token}`]) {
    let count = 0;
    const controller = createConfirmationState(async () => {
      count++;
    });
    capture(controller, search);
    await controller.submit(password);
    assert.equal(count, 0);
    assert.equal(
      controller.snapshot().status,
      search ? "malformed" : "missing",
    );
  }
});
test("temporary errors preserve token for retry; terminal invalid response clears it", async () => {
  for (const status of [0, 503, 400]) {
    let count = 0;
    const controller = createConfirmationState(async (raw, input) => {
      assert.equal(raw, token);
      assert.equal(input, password);
      if (count++ === 0) throw new ApiError(status, "synthetic");
    });
    capture(controller);
    await controller.submit(password);
    await controller.submit(password);
    assert.equal(count, status === 400 ? 1 : 2);
    assert.equal(
      controller.snapshot().status,
      status === 400 ? "invalid" : "success",
    );
  }
});
test("public recovery mutations use CSRF/cookies/no-store without auth refresh or adopting identities", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/auth/csrf"))
      return Response.json({ data: { csrfToken: "synthetic-csrf" } });
    return Response.json({
      data: { status: String(url).endsWith("/request") ? "accepted" : "reset" },
    });
  });
  await api.requestPasswordReset("synthetic@example.invalid");
  await api.confirmPasswordReset(token, password);
  for (const call of calls.filter((value) => !value.url.endsWith("/csrf"))) {
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.credentials, "include");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.headers.Authorization, undefined);
    assert.equal(call.init.headers["X-CSRF-Token"], "synthetic-csrf");
  }
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    token,
    newPassword: password,
  });
  assert(!calls.some((call) => /refresh|login/.test(call.url)));
});
test("public SSR uses existing auth surfaces and neutral reset markup without credentials", () => {
  const forgot = renderToStaticMarkup(React.createElement(ForgotPassword));
  assert.match(forgot, /auth-card/);
  assert.match(forgot, /Електронна адреса/);
  assert.match(forgot, /href="\/login"/);
  assert.match(recoveryAcceptedCopy, /Якщо акаунт/);
  const reset = renderToStaticMarkup(
    React.createElement(ResetSession, null, React.createElement(ResetPassword)),
  );
  assert.match(reset, /Новий пароль/);
  assert(!reset.includes(token));
  assert(!reset.includes('name="newPassword"'));
});
test("recovery routes are public/dynamic/no-referrer and sensitive code has no persistence/logging", async () => {
  for (const route of ["forgot-password", "reset-password"]) {
    const text = await readFile(`src/app/${route}/page.tsx`, "utf8");
    assert.match(text, /force-dynamic/);
    assert.match(text, /no-referrer/);
    assert.match(text, /index: false/);
    assert.doesNotMatch(text, /RequireSession|searchParams/);
  }
  assert.match(
    await readFile("src/features/auth/auth-form.tsx", "utf8"),
    /Забули пароль\?/,
  );
  for (const file of [
    "reset-session.tsx",
    "reset-password.tsx",
    "forgot-password.tsx",
    "api.ts",
  ]) {
    const source = await readFile(
      `src/features/auth/password-recovery/${file}`,
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|document\.cookie|console\./,
    );
  }
  const provider = await readFile(
    "src/features/favorites/favorite-provider.tsx",
    "utf8",
  );
  assert.doesNotMatch(provider, /<RegisteredFavorites key=/);
});
