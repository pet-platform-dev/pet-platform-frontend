import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { registerSchema } = await load("src/features/auth/validation.ts");
const { accountTypes, accountTypePresentation, nextAccountType } = await load(
  "src/entities/user/account-type.ts",
);
const { AccountTypeChoice } = await load(
  "src/features/auth/account-type-choice.tsx",
);
const valid = {
  email: "test@example.invalid",
  password: "Fixture-password-42",
  confirmPassword: "Fixture-password-42",
  firstName: "Олена",
  lastName: "Тестова",
};
test("registration accepts SELLER/BREEDER and defaults SELLER", () => {
  assert.equal(registerSchema.parse(valid).accountType, "SELLER");
  for (const accountType of accountTypes)
    assert.equal(
      registerSchema.parse({ ...valid, accountType }).accountType,
      accountType,
    );
});
test("registration rejects invalid account types and system enum values", () => {
  for (const accountType of ["ADMIN", "MODERATOR", "USER", "breeder", null, 42])
    assert.equal(
      registerSchema.safeParse({ ...valid, accountType }).success,
      false,
    );
});
test("registration renders labelled actual radios with default SELLER and described choices", () => {
  const html = renderToStaticMarkup(
    React.createElement(AccountTypeChoice, { disabled: false }),
  );
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert.match(html, /name="accountType" checked="" value="SELLER"/);
  assert.match(html, /value="BREEDER"/);
  for (const item of Object.values(accountTypePresentation)) {
    assert.ok(html.includes(item.label));
    assert.ok(html.includes(item.description));
  }
  assert.ok(html.includes("<legend>"));
  assert.ok(!html.includes("<select"));
});
test("pending/error radios are disabled and error is associated with group", () => {
  const html = renderToStaticMarkup(
    React.createElement(AccountTypeChoice, {
      disabled: true,
      error: "Оберіть тип акаунта",
    }),
  );
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-describedby="accountType-error"/);
  assert.match(html, /id="accountType-error"/);
});
test("one shared presentation maps both account transitions without changing auth roles", () => {
  assert.equal(nextAccountType("SELLER"), "BREEDER");
  assert.equal(nextAccountType("BREEDER"), "SELLER");
  assert.equal(accountTypePresentation.SELLER.label, "Власник тварини");
  assert.equal(accountTypePresentation.BREEDER.label, "Заводчик");
});
test("account update sends only explicit type via authenticated PATCH/CSRF and surfaces failures", async () => {
  const { updateAccountType } = await load(
    "src/features/auth/account-type-api.ts",
  );
  const saved = globalThis.fetch,
    calls = [];
  const user = { id: "fixture", accountType: "SELLER", role: "USER" };
  let fail = false;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/csrf"))
      return Response.json({ data: { csrfToken: "fixture-csrf" } });
    if (url.endsWith("/refresh"))
      return Response.json({
        data: { user, accessToken: "fixture-access", expiresIn: 900 },
      });
    return fail
      ? Response.json({ message: "private diagnostic" }, { status: 500 })
      : Response.json({
          data: { ...user, accountType: JSON.parse(init.body).accountType },
        });
  };
  try {
    assert.equal((await updateAccountType("BREEDER")).accountType, "BREEDER");
    const request = calls.find((c) => c.url.endsWith("/account/type"));
    assert.equal(request.init.method, "PATCH");
    assert.deepEqual(JSON.parse(request.init.body), { accountType: "BREEDER" });
    assert.equal(request.init.headers.Authorization, "Bearer fixture-access");
    assert.equal(request.init.headers["X-CSRF-Token"], "fixture-csrf");
    assert.equal(request.init.credentials, "include");
    fail = true;
    await assert.rejects(
      updateAccountType("SELLER"),
      (error) =>
        error.status === 500 && !error.message.includes("private diagnostic"),
    );
  } finally {
    globalThis.fetch = saved;
  }
});

test("existing breeder profile conflict keeps the localized account transition reason; unknown conflicts stay generic", async () => {
  const { updateAccountType } = await load(
    "src/features/auth/account-type-api.ts",
  );
  const saved = globalThis.fetch;
  let message = "Спочатку видаліть або деактивуйте профіль заводчика.";
  globalThis.fetch = async (url) => {
    if (url.endsWith("/csrf"))
      return Response.json({ data: { csrfToken: "fixture-csrf" } });
    if (url.endsWith("/refresh"))
      return Response.json({
        data: {
          user: { id: "fixture", accountType: "BREEDER" },
          accessToken: "fixture-access",
          expiresIn: 900,
        },
      });
    return Response.json({ message }, { status: 409 });
  };
  try {
    await assert.rejects(
      updateAccountType("SELLER"),
      (error) => error.status === 409 && error.message === message,
    );
    message = "PRIVATE_CONSTRAINT_PROVIDER";
    await assert.rejects(
      updateAccountType("SELLER"),
      (error) =>
        error.status === 409 &&
        error.message === "Дані змінилися. Оновіть сторінку та спробуйте знову",
    );
  } finally {
    globalThis.fetch = saved;
  }
});
