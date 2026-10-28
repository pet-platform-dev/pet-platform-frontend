import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { PreparedNotice } = await load(
  "src/features/breeder/handoff/prepared-notice.tsx",
);
const { PreparedCard } = await load(
  "src/features/breeder/handoff/prepared-card.tsx",
);
const { preparedEnvelope } = await load(
  "src/features/breeder/handoff/contracts.ts",
);
const owner = "11111111-1111-4111-8111-111111111111",
  profile = "22222222-2222-4222-8222-222222222222";
function notice(session = owner, total = 3) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  client.setQueryData(["current-user"], {
    id: session,
    accountType: "BREEDER",
    verificationStatus: "VERIFIED",
  });
  client.setQueryData(["own-breeder", owner], { id: profile });
  client.setQueryData(["breeder-handoffs", owner, "prepared", profile, 1], {
    breeder: { id: profile, kennelName: "Silver Paw" },
    data: [],
    meta: { total, pages: 1 },
  });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(PreparedNotice, { userId: owner }),
    ),
  );
}
test("my listings discovers prepared materials with exact count and real owner review link", () => {
  const html = notice();
  assert(html.includes("Переглянути підготовлені оголошення (3)"));
  assert(html.includes("/profile/breeder#prepared-listings"));
  assert(html.includes("Silver Paw"));
  assert(html.includes("Перегляньте та прийміть"));
  assert(!html.includes("/listings/new"));
});
test("cached prepared counts never leak after account change, and zero is compact", () => {
  assert.equal(notice(profile), "");
  assert.equal(notice(owner, 0), "");
});
test("private prepared card distinguishes type, preparation status, breed, breeder and price", () => {
  const html = renderToStaticMarkup(
    React.createElement(PreparedCard, {
      breederName: "Silver Paw",
      draft: {
        id: owner,
        title: "Синтетична тварина",
        description: "Приватний опис",
        kind: "SALE",
        status: "DRAFT",
        price: "100.00",
        species: { name: "Dog", slug: "dog" },
        breed: { name: "Breed", nameUk: "Порода" },
        images: [],
      },
    }),
  );
  for (const text of [
    "Silver Paw",
    "Продаж",
    "Собака",
    "Порода",
    "100.00 грн",
    "Стан підготовки: Чернетка",
    "Очікує передачі адміністратором",
  ])
    assert(html.includes(text), text);
  assert(!html.includes("Dog"));
  assert(!html.includes("Прийняти"));
});
test("prepared response requires explicit real breeder and preparation metadata", () => {
  assert.equal(
    preparedEnvelope.safeParse({ data: [], meta: { total: 0, pages: 0 } })
      .success,
    false,
  );
  assert.equal(
    preparedEnvelope.safeParse({
      breeder: { id: profile, kennelName: "Silver Paw" },
      data: [],
      meta: { total: 0, pages: 0 },
    }).success,
    true,
  );
});
