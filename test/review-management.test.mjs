import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { OwnReviewCard, reviewStatusLabels } = await load(
  "src/features/reviews/own-review.tsx",
);
const { ReviewForm } = await load("src/features/reviews/review-form.tsx");
const { refreshReviewPublicCache, reviewSummaryKey } = await load(
  "src/features/reviews/cache.ts",
);
const author = "22222222-2222-4222-8222-222222222222",
  target = "11111111-1111-4111-8111-111111111111";
const review = {
  id: "33333333-3333-4333-8333-333333333333",
  rating: 4,
  comment: "Приватний текст автора, добрий досвід.",
  createdAt: "2026-10-11T10:00:00Z",
  updatedAt: "2026-10-11T11:00:00Z",
  author: { id: author, displayName: "Автор А." },
  status: "APPROVED",
};
function render(Component, props) {
  const c = new QueryClient();
  c.setQueryData(["current-user"], { id: author });
  const html = renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Component, props),
    ),
  );
  c.clear();
  return html;
}
for (const status of ["PENDING", "APPROVED", "REJECTED", "HIDDEN"])
  test(
    "owner " + status + " card has Ukrainian badge/content and allowed actions",
    () => {
      const html = render(OwnReviewCard, {
        review: { ...review, status },
        authorId: author,
        targetId: target,
        onNotice: () => {},
      });
      assert.match(html, /Ваш відгук/);
      assert.ok(html.includes(reviewStatusLabels[status]));
      assert.ok(html.includes(review.comment));
      assert.match(html, /Видалити відгук\?/);
      assert.match(html, /aria-labelledby=.*aria-describedby=/);
      assert.match(html, /Відгук буде видалено назавжди/);
      assert.doesNotMatch(
        html,
        /moderationReason|PENDING|APPROVED|REJECTED|HIDDEN/,
      );
      if (status === "HIDDEN")
        assert.doesNotMatch(html, /Редагувати|Відредагувати/);
      else assert.match(html, /Редагувати|Відредагувати/);
    },
  );
for (const status of ["APPROVED", "PENDING", "REJECTED"])
  test(
    "shared edit form prefills " +
      status +
      " and offers save/cancel with approved-only warning",
    () => {
      const html = render(ReviewForm, {
        initialReview: { ...review, status },
        targetId: target,
        authorId: author,
        onSuccess: () => {},
        onDuplicate: () => {},
        onCancel: () => {},
      });
      assert.match(html, /Редагувати відгук/);
      assert.match(html, /Зберегти зміни/);
      assert.match(html, /Скасувати/);
      assert.ok(html.includes(review.comment));
      assert.match(html, /checked="" value="4"/);
      assert.equal(
        html.includes("тимчасово зникне з публічного списку"),
        status === "APPROVED",
      );
      assert.match(html, /aria-describedby/);
    },
  );
test("management removes cached approved card and refreshes only matching list/summary/profile projections", async () => {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    originalFetch = globalThis.fetch;
  const other = { ...review, id: "other" };
  c.setQueryData(["seller-reviews", target, 1], {
    data: [review, other],
    meta: { page: 1, limit: 20, total: 2, pages: 1 },
  });
  c.setQueryData(["seller-reviews", "unrelated", 1], { data: [review] });
  c.setQueryData(["listings"], { sentinel: true });
  for (const family of ["seller", "breeder"])
    c.setQueryData([family, target], {
      id: target,
      reviewSummary: { averageRating: 4, reviewCount: 2 },
    });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ data: { averageRating: 2, reviewCount: 1 } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  try {
    await refreshReviewPublicCache(c, target, review.id);
    assert.deepEqual(c.getQueryData(["seller-reviews", target, 1]).data, [
      other,
    ]);
    assert.deepEqual(c.getQueryData(reviewSummaryKey(target)), {
      averageRating: 2,
      reviewCount: 1,
    });
    for (const family of ["seller", "breeder"])
      assert.equal(
        c.getQueryData([family, target]).reviewSummary.reviewCount,
        1,
      );
    assert.deepEqual(c.getQueryData(["listings"]), { sentinel: true });
    assert.equal(
      c.getQueryData(["seller-reviews", "unrelated", 1]).data.length,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
    c.clear();
  }
});

test("failed summary refresh keeps error for retry instead of restoring initial approved rating", async () => {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    original = globalThis.fetch;
  c.setQueryData(reviewSummaryKey(target), {
    averageRating: 5,
    reviewCount: 1,
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "private debug" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  try {
    await refreshReviewPublicCache(c, target, review.id);
    assert.equal(c.getQueryState(reviewSummaryKey(target)).status, "error");
    assert.equal(c.getQueryState(reviewSummaryKey(target)).isInvalidated, true);
  } finally {
    globalThis.fetch = original;
    c.clear();
  }
});

test("pending helper explains publication without repeating the badge or conflating public history", () => {
  const html = render(OwnReviewCard, {
    review: { ...review, status: "PENDING" },
    authorId: author,
    targetId: target,
    onNotice: () => {},
  });
  assert.match(html, /На модерації/);
  assert.match(html, /Відгук перевіряється перед публікацією\./);
  assert.doesNotMatch(html, /Ваш відгук на модерації\./);
  assert.match(html, /review-card-meta/);
  assert.match(html, /button secondary review-delete-action/);
});
