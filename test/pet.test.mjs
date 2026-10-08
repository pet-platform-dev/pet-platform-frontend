import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const { petFormSchema } = await load("../src/features/pet/validation.ts");
const { breedLabel } = await load("../src/entities/breed/model.ts");
const input = {
  name: " Локі ",
  speciesId: randomUUID(),
  breedId: "",
  gender: "MALE",
  birthDate: "2024-02-29",
  color: " Рудий ",
  description: "",
  chipNumber: "",
  hasPassport: true,
  hasPedigree: false,
  vaccinated: false,
};
const reply = (data, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("pet form normalizes input and permits unknown breed without inventing a classification", () => {
  const result = petFormSchema.parse(input);
  assert.equal(result.name, "Локі");
  assert.equal(result.color, "Рудий");
  assert.equal(result.breedId, null);
  assert.equal(result.description, null);
  assert.equal(result.chipNumber, null);
});
test("pet form requires species and valid enum/id values", () => {
  for (const extra of [
    { speciesId: "" },
    { gender: "OTHER" },
    { breedId: "invalid" },
  ])
    assert.equal(
      petFormSchema.safeParse({ ...input, ...extra }).success,
      false,
    );
});
test("pet form accepts omitted/null/empty names and preserves named values", () => {
  const unnamed = { ...input };
  delete unnamed.name;
  assert.equal(petFormSchema.parse(unnamed).name, null);
  for (const name of [null, "", "  "])
    assert.equal(petFormSchema.parse({ ...input, name }).name, null);
  assert.equal(
    petFormSchema.parse({ ...input, name: "  Міла  " }).name,
    "Міла",
  );
  assert.equal(
    petFormSchema.safeParse({ ...input, name: "x".repeat(151) }).success,
    false,
  );
});
test("pet form rejects impossible and future dates in Ukrainian", () => {
  for (const birthDate of ["2025-02-29", "2099-01-01"]) {
    const result = petFormSchema.safeParse({ ...input, birthDate });
    assert.equal(result.success, false);
    assert.ok(/[А-Яа-яІіЇїЄєҐґ]/.test(result.error.issues[0].message));
  }
  assert.equal(
    petFormSchema.parse({ ...input, birthDate: "" }).birthDate,
    null,
  );
});
test("pet form bounds optional metadata and preserves boolean values", () => {
  assert.equal(
    petFormSchema.safeParse({ ...input, description: "x".repeat(5001) })
      .success,
    false,
  );
  const result = petFormSchema.parse(input);
  assert.equal(result.hasPassport, true);
  assert.equal(result.vaccinated, false);
});
test("breed display uses nonblank curated Ukrainian name and canonical fallback", () => {
  assert.equal(
    breedLabel({ name: "Belgian Malinois", nameUk: "  Тестова назва  " }),
    "Тестова назва",
  );
  for (const nameUk of [null, "", "   "])
    assert.equal(
      breedLabel({ name: "Belgian Malinois", nameUk }),
      "Belgian Malinois",
    );
});
test("central client sends Bearer and CSRF on pet mutations and preserves pagination envelopes", async () => {
  const client = await load("../src/shared/api/client.ts");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/csrf")) return reply({ csrfToken: "csrf-test" });
    if (url.endsWith("/login"))
      return reply({
        user: { id: "user" },
        accessToken: "test-access",
        expiresIn: 900,
      });
    if (options.method === "POST") return reply({ id: "pet" });
    return new Response(
      JSON.stringify({ data: [], meta: { page: 1, total: 0 } }),
      { status: 200 },
    );
  };
  await client.signIn("login", {});
  await client.authenticatedRequest("/pets", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const create = calls.find((call) => call.url.endsWith("/pets"));
  assert.equal(create.options.headers.Authorization, "Bearer test-access");
  assert.equal(create.options.headers["X-CSRF-Token"], "csrf-test");
  assert.equal(create.options.credentials, "include");
  const page = await client.authenticatedRequest("/pets/me", {}, true);
  assert.equal(page.meta.page, 1);
  assert.deepEqual(page.data, []);
});
test("backend pet validation details are localized while unknown internals are excluded", async () => {
  const client = await load("../src/shared/api/client.ts");
  globalThis.fetch = async (url) =>
    url.endsWith("/csrf")
      ? reply({ csrfToken: "csrf-test" })
      : url.endsWith("/login")
        ? reply({
            user: { id: "user" },
            accessToken: "test-access",
            expiresIn: 900,
          })
        : new Response(
            JSON.stringify({
              statusCode: 400,
              message: "Дата народження не може бути в майбутньому",
              details: [
                {
                  field: "birthDate",
                  message: "Дата народження не може бути в майбутньому",
                },
                { field: "passwordHash", message: "internal detail" },
              ],
            }),
            { status: 400 },
          );
  await client.signIn("login", {});
  try {
    await client.authenticatedRequest("/pets", { method: "POST", body: "{}" });
    assert.fail("Expected validation error");
  } catch (error) {
    assert.equal(error.message, "Дата народження не може бути в майбутньому");
    assert.deepEqual(error.details, [
      {
        field: "birthDate",
        message: "Дата народження не може бути в майбутньому",
      },
    ]);
  }
});
