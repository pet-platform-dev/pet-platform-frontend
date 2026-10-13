import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
import {
  adminId,
  id,
  petId,
  ownerId,
  timestamp,
  queueItem,
  detail,
  result,
} from "./helpers/moderation-data.mjs";
const model = await load("src/features/admin/moderation/model.ts"),
  nav = await load("src/features/admin/moderation/navigation.ts"),
  cache = await load("src/features/admin/moderation/cache.ts");
const { ApiError } = await load("src/shared/api/client.ts");
test("missing SALE price in submitted content is not presented as zero or free", async () => {
  const { ListingModerationDetail } = await load(
    "src/features/admin/moderation/listing-detail.tsx",
  );
  const { ModerationQueueCard } = await load(
    "src/features/admin/moderation/queue-card.tsx",
  );
  const row = detail();
  row.price = null;
  const item = queueItem();
  item.preview.price = null;
  for (const html of [
    renderToStaticMarkup(React.createElement(ListingModerationDetail, { row })),
    renderToStaticMarkup(
      React.createElement(ModerationQueueCard, {
        row: item,
        returnTo: "/admin/moderation",
      }),
    ),
  ])
    assert.match(html, /Ціну не вказано/);
});
test("URL state defaults, typed filters, page2 and safe refresh return context", () => {
  assert.deepEqual(nav.parseQueueState({}), {
    type: undefined,
    status: "PENDING",
    page: 1,
  });
  const state = nav.parseQueueState({
    type: "MATING_LISTING",
    status: "APPROVED",
    page: "2",
  });
  assert.equal(
    nav.queueHref(state),
    "/admin/moderation?type=MATING_LISTING&status=APPROVED&page=2",
  );
  assert.equal(nav.safeQueueReturn(nav.queueHref(state)), nav.queueHref(state));
  const href = nav.detailHref("MATING_LISTING", id, nav.queueHref(state));
  assert.equal(
    new URL(href, "https://internal.invalid").searchParams.get("returnTo"),
    nav.queueHref(state),
  );
  for (const invalid of [
    { page: "0" },
    { page: "100001" },
    { page: ["1", "2"] },
    { type: "PET", status: "ACTIVE" },
  ])
    assert.equal(nav.parseQueueState(invalid).page, 1);
  for (const unsafe of [
    "https://evil.invalid/admin/moderation",
    "//evil.invalid/admin/moderation",
    "/admin/moderation/../users",
    "/admin/moderation?page=1&page=2",
    "/listings",
    "/admin/moderation#fragment",
  ])
    assert.equal(nav.safeQueueReturn(unsafe), "/admin/moderation");
});
test("moderation actions follow the existing backend transition matrix and terminal business state", () => {
  for (const type of model.contentTypes)
    for (const moderationStatus of [
      "NOT_SUBMITTED",
      "PENDING",
      "APPROVED",
      "REJECTED",
      "HIDDEN",
    ]) {
      const row = {
        ...detail(type),
        moderationStatus,
        status: type === "REVIEW" ? moderationStatus : "DRAFT",
      };
      assert.deepEqual(
        model.availableActions(row),
        moderationStatus === "PENDING"
          ? ["approve", "reject"]
          : moderationStatus === "APPROVED"
            ? ["hide"]
            : [],
      );
    }
  assert.deepEqual(
    model.availableActions({
      ...detail(),
      status: "ARCHIVED",
      moderationStatus: "APPROVED",
    }),
    [],
  );
});
test("reasons trim and enforce exact backend10–1000 limits, including whitespace", () => {
  assert.equal(
    model.reasonSchema.parse("  Виправте опис оголошення.  "),
    "Виправте опис оголошення.",
  );
  for (const reason of ["", "short", " ".repeat(20), "x".repeat(1001)])
    assert.equal(model.reasonSchema.safeParse(reason).success, false);
  for (const reason of ["x".repeat(10), "x".repeat(1000)])
    assert.equal(model.reasonSchema.safeParse(reason).success, true);
  assert.equal(
    model.reasonDecisionSchema.safeParse({
      expectedUpdatedAt: timestamp,
      reason: "Виправте опис.",
      role: "ADMIN",
    }).success,
    false,
  );
});
test("queue and detail schemas strip private nested data and distinguish all3 domains", () => {
  for (const type of model.contentTypes) {
    const raw = detail(type);
    raw.passwordHash = "PRIVATE";
    raw.moderatedById = "PRIVATE";
    if (type !== "REVIEW") {
      raw.pet.healthNotes = "PRIVATE";
      raw.owner.email = "PRIVATE";
    }
    assert.doesNotMatch(
      JSON.stringify(model.detailSchema.parse(raw)),
      /PRIVATE|passwordHash|healthNotes|moderatedById/,
    );
    assert.equal(model.queueItemSchema.parse(queueItem(type)).type, type);
  }
});
test("only technical ADMIN gets navigation, regardless of account type", async () => {
  const { AdminNavigation } = await load(
    "src/features/admin/moderation/admin-navigation.tsx",
  );
  for (const role of ["USER", "BREEDER", "MODERATOR", "ADMIN"])
    for (const accountType of ["SELLER", "BREEDER"]) {
      const html = renderToStaticMarkup(
        React.createElement(AdminNavigation, { user: { role, accountType } }),
      );
      assert.equal(html.includes("/admin/moderation"), role === "ADMIN");
    }
});
test("typed queue cards have Ukrainian labels, keyboard links, no detail request, safe preview text", async () => {
  const { ModerationQueueCard } = await load(
    "src/features/admin/moderation/queue-card.tsx",
  );
  for (const type of model.contentTypes) {
    const html = renderToStaticMarkup(
      React.createElement(ModerationQueueCard, {
        row: queueItem(type),
        returnTo: "/admin/moderation?page=2",
      }),
    );
    assert.ok(html.includes(model.typeLabels[type]));
    assert.match(html, /Переглянути/);
    assert.match(html, /page%3D2/);
    assert.doesNotMatch(html, /passwordHash|healthNotes|<select/);
  }
});
test("domain details render full relevant content and escape text without verified claims", async () => {
  for (const [type, path, name] of [
    ["LISTING", "listing-detail", "ListingModerationDetail"],
    ["MATING_LISTING", "mating-detail", "MatingModerationDetail"],
    ["REVIEW", "review-detail", "ReviewModerationDetail"],
  ]) {
    const component = (
      await load("src/features/admin/moderation/" + path + ".tsx")
    )[name];
    const raw = detail(type);
    if (type === "REVIEW") raw.comment = "<script>unsafe</script>";
    else raw.description = "<script>unsafe</script>";
    const html = renderToStaticMarkup(
      React.createElement(component, { row: raw }),
    );
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(
      html,
      /<script>|passwordHash|healthNotes|Перевірена покупка/,
    );
    if (type === "LISTING") assert.match(html, /Фотографії оголошення/);
    if (type === "MATING_LISTING") assert.match(html, /Умови співпраці/);
    if (type === "REVIEW") assert.match(html, /Рейтинг 4 з 5/);
  }
});
test("403 clears admin queue/detail and blocks late responses without touching public cache", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id: adminId, role: "ADMIN" });
  client.setQueryData(cache.adminModerationKeys.queue(adminId), {
    private: true,
  });
  client.setQueryData(
    cache.adminModerationKeys.detail(adminId, "LISTING", id),
    detail(),
  );
  client.setQueryData(["listings"], { public: true });
  await assert.rejects(() =>
    cache.runAdminRequest(client, adminId, () =>
      Promise.reject(new ApiError(403, "forbidden")),
    ),
  );
  assert.equal(
    client.getQueryData(cache.adminModerationKeys.queue(adminId)),
    undefined,
  );
  assert.equal(
    client.getQueryData(
      cache.adminModerationKeys.detail(adminId, "LISTING", id),
    ),
    undefined,
  );
  assert.deepEqual(client.getQueryData(["listings"]), { public: true });
  assert.equal(cache.currentAdmin(client, adminId), false);
  client.clear();
});
test("session switch prevents a late admin read from completing or writing private state", async () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], { id: adminId, role: "ADMIN" });
  let finish;
  const pending = cache.runAdminRequest(
    client,
    adminId,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  client.setQueryData(["current-user"], { id: ownerId, role: "USER" });
  finish(detail());
  await assert.rejects(() => pending, { name: "AbortError" });
  client.clear();
});
test("listing/mating decisions invalidate their publication families without invalidating all data", async () => {
  for (const type of ["LISTING", "MATING_LISTING"]) {
    const client = new QueryClient();
    client.setQueryData(["current-user"], { id: adminId, role: "ADMIN" });
    client.setQueryData(
      cache.adminModerationKeys.detail(adminId, type, id),
      detail(type),
    );
    const related =
      type === "LISTING"
        ? [
            ["listings"],
            ["listing", id],
            ["seller-listings", ownerId],
            ["favorites", adminId],
            ["public-pet", petId],
            ["public-breeder-animals", ownerId],
          ]
        : [
            ["mating-public", "detail", id],
            ["public-pet", petId],
          ];
    for (const key of related) client.setQueryData(key, { old: true });
    client.setQueryData(["species"], { unchanged: true });
    await cache.refreshAfterModeration(client, adminId, result(type));
    for (const key of related)
      assert.equal(client.getQueryState(key).isInvalidated, true);
    assert.equal(client.getQueryState(["species"]).isInvalidated, false);
    assert.equal(
      client.getQueryData(cache.adminModerationKeys.detail(adminId, type, id))
        .moderationStatus,
      "APPROVED",
    );
    client.clear();
  }
});
test("review decision refetches authoritative summary and invalidates only affected review/profile state", async () => {
  const client = new QueryClient(),
    saved = globalThis.fetch;
  client.setQueryData(["current-user"], { id: adminId, role: "ADMIN" });
  client.setQueryData(
    cache.adminModerationKeys.detail(adminId, "REVIEW", id),
    detail("REVIEW"),
  );
  client.setQueryData(["seller-review-summary", ownerId], {
    averageRating: null,
    reviewCount: 0,
  });
  client.setQueryData(["seller-reviews", ownerId, 1], {
    data: [],
    meta: { total: 0, pages: 0, page: 1, limit: 20 },
  });
  client.setQueryData(["seller-review-me", adminId, ownerId], { old: true });
  client.setQueryData(["seller-review-summary", petId], { unchanged: true });
  let requests = 0;
  globalThis.fetch = async (url) => {
    assert.ok(url.endsWith("/sellers/" + ownerId + "/review-summary"));
    requests++;
    return new Response(
      JSON.stringify({ data: { averageRating: 4, reviewCount: 1 } }),
    );
  };
  try {
    await cache.refreshAfterModeration(client, adminId, result("REVIEW"));
    assert.equal(requests, 1);
    assert.deepEqual(client.getQueryData(["seller-review-summary", ownerId]), {
      averageRating: 4,
      reviewCount: 1,
    });
    assert.equal(
      client.getQueryState(["seller-reviews", ownerId, 1]).isInvalidated,
      true,
    );
    assert.equal(
      client.getQueryState(["seller-review-me", adminId, ownerId])
        .isInvalidated,
      true,
    );
    assert.equal(
      client.getQueryState(["seller-review-summary", petId]).isInvalidated,
      false,
    );
  } finally {
    globalThis.fetch = saved;
    client.clear();
  }
});
