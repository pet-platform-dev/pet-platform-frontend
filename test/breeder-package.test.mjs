import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const { PackagePreview } = await load(
  "src/features/breeder/claim/package-preview.tsx",
);
const { createClaimState } = await load(
  "src/features/breeder/claim/claim-state.ts",
);
const { packageSchema } = await load(
  "src/features/breeder/claim/package-schema.ts",
);
const { RemainingPackage } = await load(
  "src/features/breeder/claim/remaining-package.tsx",
);
const item = (i) => ({
  id: `11111111-1111-4111-8111-11111111111${i}`,
  title: `Тварина ${i}`,
  description: "Приватні перевірені дані",
  gender: "FEMALE",
  birthDate: null,
  price: "100.00",
  kind: "SALE",
  status: "DRAFT",
  species: { name: "Dog", slug: "dog" },
  breed: { name: "Breed", nameUk: "Порода" },
  images: [],
});
const value = {
  revision: "a".repeat(64),
  count: 3,
  canAccept: true,
  blockers: [],
  listings: [1, 2, 3].map(item),
};
test("package preview shows all included private drafts with no separate acceptance controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(PackagePreview, { value, breederName: "Silver Paw" }),
  );
  for (const text of [
    "Оголошень у пакеті: 3",
    "Тварина 1",
    "Тварина 2",
    "Тварина 3",
    "Silver Paw",
    "100.00 грн",
    "Собака",
    "Порода",
  ])
    assert(html.includes(text), text);
  assert(!html.includes("Очікує передачі адміністратором"));
  assert(!html.includes("<input"));
});
test("blocked and empty packages have explicit explanations", () => {
  const html = renderToStaticMarkup(
    React.createElement(PackagePreview, {
      value: {
        ...value,
        canAccept: false,
        blockers: [
          { id: item(1).id, title: item(1).title, message: "Перевірте місце" },
        ],
      },
      breederName: "Silver Paw",
    }),
  );
  assert(html.includes('role="alert"'));
  assert(html.includes("Перевірте місце"));
  const empty = renderToStaticMarkup(
    React.createElement(PackagePreview, {
      value: { ...value, count: 0, listings: [] },
      breederName: "Silver Paw",
    }),
  );
  assert(empty.includes("Пакет не містить оголошень"));
});
test("blocked package cannot submit and allowed package passes exact viewed revision once", async () => {
  let blocked = true,
    calls = 0;
  const c = createClaimState(
    async () => ({
      draftRevision: "2026-10-28T00:00:00.000Z",
      package: { ...value, canAccept: !blocked },
    }),
    async (_token, _revision, packageRevision) => {
      assert.equal(packageRevision, value.revision);
      calls++;
      return { ownerId: "owner" };
    },
  );
  c.capture(
    { search: "?token=" + "s".repeat(43), pathname: "/claim-breeder" },
    { replaceState() {} },
  );
  c.session("owner");
  await c.inspect();
  await c.accept();
  assert.equal(calls, 0);
  blocked = false;
  await c.inspect();
  assert.equal(calls, 0);
  await Promise.all([c.accept(), c.accept()]);
  assert.equal(calls, 1);
});
test("package contract rejects missing or malformed revision", () => {
  assert(packageSchema.safeParse(value).success);
  assert(!packageSchema.safeParse({ ...value, revision: "bad" }).success);
});
test("cached recovery content is hidden after account/verification changes and has one package acceptance", () => {
  function render(currentId, verificationStatus) {
    const owner = item(1).id,
      profile = item(2).id,
      client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        },
      });
    client.setQueryData(["current-user"], {
      id: currentId,
      accountType: "BREEDER",
      verificationStatus,
    });
    client.setQueryData(["breeder-handoffs", owner, "package", profile], {
      ...value,
      breeder: { id: profile, kennelName: "Silver Paw" },
    });
    return renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(RemainingPackage, {
          userId: owner,
          profileId: profile,
        }),
      ),
    );
  }
  assert.equal(render(item(2).id, "VERIFIED"), "");
  assert(!render(item(1).id, "UNVERIFIED").includes("Тварина 1"));
  const html = render(item(1).id, "VERIFIED");
  assert.equal(html.split("Прийняти всі оголошення пакета").length - 1, 1);
});
