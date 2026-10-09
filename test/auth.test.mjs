import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function load(relative) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(
      'from "zod"',
      `from "${pathToFileURL(`${process.cwd()}/node_modules/zod/index.js`).href}"`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(output + `\n// instance ${Math.random()}`).toString("base64")}`
  );
}
const validation = await load("../src/features/auth/validation.ts");
const user = {
  id: "test-user",
  email: "test@example.invalid",
  firstName: "Тест",
  lastName: null,
  avatarUrl: null,
  role: "USER",
  verificationStatus: "UNVERIFIED",
  createdAt: new Date().toISOString(),
};
const auth = { user, accessToken: "test-access", expiresIn: 900 };
const reply = (data, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("an in-flight refresh cannot restore access after a logout/account change", async () => {
  const client = await load("../src/shared/api/client.ts");
  const saved = globalThis.fetch;
  let finish, started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf")) return reply({ csrfToken: "csrf" });
    if (url.endsWith("/refresh")) {
      started();
      return new Promise((resolve) => {
        finish = () => resolve(reply(auth));
      });
    }
    throw new Error("Private request should never follow a discarded refresh");
  };
  try {
    const pending = client.authenticatedRequest("/listings/me");
    const rejected = assert.rejects(
      pending,
      (error) => error.name === "AbortError",
    );
    await ready;
    client.clearSession();
    finish();
    await rejected;
  } finally {
    globalThis.fetch = saved;
  }
});
test("conflicts keep registration wording only on registration and hide unknown provider diagnostics", async () => {
  const client = await load("../src/shared/api/client.ts");
  const saved = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      { message: "PRIVATE_CONSTRAINT_PROVIDER_SECRET" },
      { status: 409 },
    );
  try {
    await assert.rejects(
      () => client.publicRequest("/listings"),
      (error) =>
        error.status === 409 &&
        error.message === "Дані змінилися. Оновіть сторінку та спробуйте знову",
    );
    await assert.rejects(
      () => client.publicRequest("/auth/register"),
      (error) =>
        error.message === "Користувач із такою електронною адресою вже існує",
    );
  } finally {
    globalThis.fetch = saved;
  }
});

test("login validates email, password and normalizes email", () => {
  assert.equal(
    validation.loginSchema.safeParse({ email: "bad", password: "short" })
      .success,
    false,
  );
  assert.equal(
    validation.loginSchema.parse({
      email: " TEST@EXAMPLE.INVALID ",
      password: "test-password",
    }).email,
    user.email,
  );
});
test("registration requires names and matching confirmation", () => {
  const input = {
    email: user.email,
    password: "test-password",
    firstName: "Тест",
    lastName: "Тестовий",
    confirmPassword: "wrong",
  };
  const result = validation.registerSchema.safeParse(input);
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].message, "Паролі не збігаються");
  assert.equal(
    validation.registerSchema.safeParse({
      ...input,
      confirmPassword: input.password,
    }).success,
    true,
  );
  assert.equal(
    validation.registerSchema.safeParse({
      ...input,
      firstName: " ",
      confirmPassword: input.password,
    }).success,
    false,
  );
});
test("session restoration coordinates concurrent refresh and uses credentials", async () => {
  const client = await load("../src/shared/api/client.ts");
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/csrf")) return reply({ csrfToken: "test-csrf" });
    if (url.endsWith("/refresh")) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return reply(auth);
    }
    return reply(user);
  };
  const result = await Promise.all([
    client.currentUser(),
    client.currentUser(),
    client.currentUser(),
  ]);
  assert.equal(
    result.every((value) => value.id === user.id),
    true,
  );
  assert.equal(calls.filter((call) => call.url.endsWith("/refresh")).length, 1);
  assert.equal(
    calls.every((call) => call.init.credentials === "include"),
    true,
  );
  assert.equal(
    calls.find((call) => call.url.endsWith("/me")).init.headers.Authorization,
    "Bearer test-access",
  );
});
test("401 triggers one refresh and never loops on a second failure", async () => {
  const client = await load("../src/shared/api/client.ts");
  let refreshes = 0;
  let me = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf")) return reply({ csrfToken: "csrf" });
    if (url.endsWith("/refresh")) {
      refreshes++;
      return reply(auth);
    }
    me++;
    return reply(null, 401);
  };
  assert.equal(await client.currentUser(), null);
  assert.equal(refreshes, 2);
  assert.equal(me, 2);
});
test("logout clears memory and restoration cannot reuse the old access token", async () => {
  const client = await load("../src/shared/api/client.ts");
  let loggedOut = false;
  let privateCalls = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf")) return reply({ csrfToken: "csrf" });
    if (url.endsWith("/login")) return reply(auth);
    if (url.endsWith("/logout")) {
      loggedOut = true;
      return reply(null, 204);
    }
    if (url.endsWith("/refresh")) return reply(null, 401);
    privateCalls++;
    return reply(user);
  };
  await client.signIn("login", {});
  assert.equal((await client.currentUser()).id, user.id);
  await client.signOut();
  assert.equal(loggedOut, true);
  assert.equal(await client.currentUser(), null);
  assert.equal(privateCalls, 1);
});
test("failed logout does not claim success or silently discard the session", async () => {
  const client = await load("../src/shared/api/client.ts");
  globalThis.fetch = async (url) =>
    url.endsWith("/csrf")
      ? reply({ csrfToken: "csrf" })
      : url.endsWith("/login")
        ? reply(auth)
        : url.endsWith("/logout")
          ? reply(null, 500)
          : reply(user);
  await client.signIn("login", {});
  await assert.rejects(client.signOut(), { status: 500 });
  assert.equal((await client.currentUser()).id, user.id);
});
test("API errors are localized and server internals are not rendered", async () => {
  const client = await load("../src/shared/api/client.ts");
  globalThis.fetch = async (url) =>
    url.endsWith("/csrf")
      ? reply({ csrfToken: "csrf" })
      : reply({ message: "INTERNAL DATABASE DETAIL" }, 409);
  await assert.rejects(client.signIn("register", {}), {
    status: 409,
    message: "Користувач із такою електронною адресою вже існує",
  });
  globalThis.fetch = async () => {
    throw new Error("sensitive network internals");
  };
  await assert.rejects(client.signIn("login", {}), {
    status: 0,
    message: "Не вдалося виконати запит. Спробуйте ще раз.",
  });
});
