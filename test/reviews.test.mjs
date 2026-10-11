import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const model = await load("src/entities/review/model.ts");
const { reviewInputSchema } = await load("src/features/reviews/validation.ts");
const { StarRating, StarInput } = await load(
  "src/features/reviews/star-rating.tsx",
);
const { ReviewCard } = await load("src/features/reviews/review-card.tsx");
const { ReviewSummaryView } = await load(
  "src/features/reviews/review-summary.tsx",
);
const { SellerReviews } = await load("src/features/reviews/seller-reviews.tsx");
const { SellerProfile } = await load(
  "src/widgets/seller-profile/seller-profile.tsx",
);
const { acceptOwnReview, ownReviewKey, reviewListKey, reviewSummaryKey } =
  await load("src/features/reviews/cache.ts");
const { clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
const { favoriteLoginReturn, favoriteLoginHref } = await load(
  "src/features/favorites/login-return.ts",
);
const target = "11111111-1111-4111-8111-111111111111",
  author = "22222222-2222-4222-8222-222222222222";
const review = {
  id: "33333333-3333-4333-8333-333333333333",
  rating: 5,
  comment: "Дуже відповідальний продавець.\nРекомендую!",
  createdAt: "2026-10-11T10:00:00.000Z",
  author: { id: author, displayName: "Олександр Є." },
};
const own = { ...review, status: "PENDING", updatedAt: review.createdAt };
const summary = { averageRating: 4.8, reviewCount: 21 };
function client(user = null) {
  const c = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  c.setQueryData(["current-user"], user);
  c.setQueryData(reviewListKey(target, 1), {
    data: [review],
    meta: { page: 1, limit: 20, total: 21, pages: 2 },
  });
  return c;
}
function render(c, Component, props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: c },
      React.createElement(Component, props),
    ),
  );
}
const eligible = {
  review: null,
  canReview: true,
  hasReviewed: false,
  isSelf: false,
  reason: null,
};
test("summary formats Ukrainian numeric rating and approved count", () => {
  const html = renderToStaticMarkup(
    React.createElement(ReviewSummaryView, { summary }),
  );
  assert.match(html, /4,8/);
  assert.match(html, /21 відгук/);
  assert.match(html, /Рейтинг 4,8 з 5/);
});
test("empty summary does not display 0.0 or misleading stars", () => {
  const html = renderToStaticMarkup(
    React.createElement(ReviewSummaryView, {
      summary: { averageRating: null, reviewCount: 0 },
    }),
  );
  assert.match(html, /Публічних відгуків ще немає/);
  assert.doesNotMatch(html, /<svg|0[,.]0/);
});
test("cards render safe author, accessible stars, Ukrainian date and escaped multiline text", () => {
  const html = renderToStaticMarkup(
    React.createElement(ReviewCard, {
      review: { ...review, comment: "<script>PRIVATE</script>\nТекст" },
    }),
  );
  assert.match(html, /Олександр Є\./);
  assert.match(html, /11 жовтня 2026/);
  assert.match(html, /Рейтинг 5 з 5/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|email|ADMIN|Єпік/);
});
test("public projection strips private author/status/moderation fields", () => {
  const parsed = model.reviewSchema.parse({
    ...review,
    status: "APPROVED",
    moderationReason: "PRIVATE",
    author: {
      ...review.author,
      email: "PRIVATE",
      lastName: "PRIVATE",
      phone: "PRIVATE",
      role: "ADMIN",
    },
  });
  assert.deepEqual(parsed, review);
});
test("display uses exactly five SVG stars with fractional summary support", () => {
  const html = renderToStaticMarkup(
    React.createElement(StarRating, { value: 4.8 }),
  );
  assert.equal((html.match(/class="review-star-display"/g) || []).length, 5);
  assert.match(html, /width:79/);
});
test("star input uses labelled native radios, checked selection and error association", () => {
  const html = renderToStaticMarkup(
    React.createElement(StarInput, {
      value: 3,
      onChange() {},
      disabled: false,
      error: "Оберіть оцінку",
    }),
  );
  assert.equal((html.match(/type="radio"/g) || []).length, 5);
  assert.match(html, /aria-label="3 з 5"/);
  assert.match(html, /checked="" value="3"/);
  assert.match(html, /fieldset.*aria-describedby/);
});
test("public reviews use existing pagination and anonymous safe login CTA", () => {
  const c = client(),
    html = render(c, SellerReviews, {
      targetId: target,
      initialSummary: summary,
    });
  assert.match(html, /Сторінки відгуків/);
  assert.match(html, /Назад/);
  assert.match(html, /Далі/);
  assert.match(html, /Увійдіть, щоб залишити відгук/);
  assert.match(html, /returnTo=%2Fsellers%2F/);
  assert.match(html, /Олександр Є\./);
  c.clear();
});
test("self profile hides form and first-review encouragement", () => {
  const c = client({ id: target });
  c.setQueryData(ownReviewKey(target, target), {
    ...eligible,
    canReview: false,
    isSelf: true,
    reason: "SELF_REVIEW",
  });
  const html = render(c, SellerReviews, {
    targetId: target,
    initialSummary: { averageRating: null, reviewCount: 0 },
  });
  assert.doesNotMatch(html, /<form|Будьте першим/);
  assert.match(html, /самому собі/);
  c.clear();
});
test("eligible viewer sees labelled form, textarea, rating and submit button", () => {
  const c = client({ id: author });
  c.setQueryData(ownReviewKey(author, target), eligible);
  const html = render(c, SellerReviews, {
    targetId: target,
    initialSummary: summary,
  });
  assert.match(html, /<form/);
  assert.match(html, /Коментар/);
  assert.match(html, /<textarea/);
  assert.match(html, /Надіслати відгук/);
  assert.match(html, /0 \/ 2000/);
  c.clear();
});
for (const [status, text] of [
  ["PENDING", "Відгук перевіряється перед публікацією."],
  ["APPROVED", "Ваш відгук опубліковано."],
  ["REJECTED", "Відгук відхилено."],
  ["HIDDEN", "Відгук приховано модерацією."],
])
  test("own state " + status + " prevents another form", () => {
    const c = client({ id: author });
    c.setQueryData(ownReviewKey(author, target), {
      ...eligible,
      review: { ...own, status },
      canReview: false,
      hasReviewed: true,
      reason: "ALREADY_REVIEWED",
    });
    const html = render(c, SellerReviews, {
      targetId: target,
      initialSummary: summary,
    });
    assert.ok(html.includes(text));
    assert.doesNotMatch(html, /<form|moderationReason|REJECTED|HIDDEN|PENDING/);
    c.clear();
  });
for (const rating of [0, 6, 1.5, "5", null])
  test("rating validation rejects " + rating, () =>
    assert.equal(
      reviewInputSchema.safeParse({
        rating,
        comment: "Добрий досвід спілкування",
      }).success,
      false,
    ),
  );
for (const comment of [
  "",
  "    ",
  "короткий",
  "a".repeat(2001),
  "<b>Добрий досвід</b>",
  "bad\u0000comment",
])
  test("invalid plain comment rejected " + String(comment).slice(0, 12), () =>
    assert.equal(
      reviewInputSchema.safeParse({ rating: 5, comment }).success,
      false,
    ),
  );
test("trimmed comment boundaries match backend including whitespace and multiline", () => {
  for (const length of [10, 2000])
    assert.equal(
      reviewInputSchema.parse({
        rating: 5,
        comment: "  " + "a".repeat(length) + "  ",
      }).comment.length,
      length,
    );
  assert.equal(
    reviewInputSchema.safeParse({
      rating: 1,
      comment: "Добрий досвід\nспілкування",
    }).success,
    true,
  );
});
test("PENDING acceptance changes own eligibility only, leaves public count/list exactly unchanged", () => {
  const c = client({ id: author }),
    page = c.getQueryData(reviewListKey(target, 1));
  c.setQueryData(reviewSummaryKey(target), summary);
  assert.equal(acceptOwnReview(c, author, target, own), true);
  assert.equal(c.getQueryData(ownReviewKey(author, target)).canReview, false);
  assert.deepEqual(c.getQueryData(reviewSummaryKey(target)), summary);
  assert.deepEqual(c.getQueryData(reviewListKey(target, 1)), page);
  c.clear();
});
test("late mutation from another account cannot populate private eligibility", () => {
  const c = client({ id: "other" });
  assert.equal(acceptOwnReview(c, author, target, own), false);
  assert.equal(c.getQueryData(ownReviewKey(author, target)), undefined);
  c.clear();
});
test("logout clears private reviews while preserving approved reviews/summary", () => {
  const c = client({ id: author });
  c.setQueryData(ownReviewKey(author, target), eligible);
  c.setQueryData(reviewSummaryKey(target), summary);
  clearPrivateQueries(c);
  assert.equal(c.getQueryData(ownReviewKey(author, target)), undefined);
  assert.deepEqual(c.getQueryData(reviewSummaryKey(target)), summary);
  assert.ok(c.getQueryData(reviewListKey(target, 1)));
  c.clear();
});
test("safe seller auth returns reject external, normalization and malformed paths", () => {
  const path = "/sellers/" + target;
  assert.equal(favoriteLoginReturn(path), path);
  assert.equal(
    new URL(favoriteLoginHref(path), "https://local.invalid").searchParams.get(
      "returnTo",
    ),
    path,
  );
  for (const value of [
    "//evil.invalid",
    "https://evil.invalid",
    "/sellers/" + target + "/../account",
    "/sellers/not-a-uuid",
    "/sellers/" + target + "#evil",
    "/sellers/" + target + "\\evil",
    ["/sellers/" + target],
  ])
    assert.equal(favoriteLoginReturn(value), "/account");
});
test("same reviews section integrates with normal seller and kennel profile", () => {
  const seller = {
    id: target,
    displayName: "Олександр Єпік",
    location: null,
    phone: null,
    telegram: null,
    viber: null,
    whatsapp: null,
    memberSince: review.createdAt,
    reviewSummary: summary,
    breeder: null,
  };
  for (const breeder of [
    null,
    {
      userId: target,
      kennelName: "Royal Malinois",
      location: null,
      description: null,
      startedYear: null,
      website: null,
      breeds: [],
      contactPerson: seller,
      reviewSummary: summary,
      media: { logo: null, cover: null, gallery: [], videos: [] },
    },
  ]) {
    const c = client();
    c.setQueryData(
      ["seller", target],
      breeder
        ? { ...seller, breeder: { kennelName: breeder.kennelName } }
        : seller,
    );
    c.setQueryData(["breeder", target], breeder);
    c.setQueryData(["seller-listings", target], {
      pages: [{ data: [], meta: { page: 1, limit: 24, total: 0, pages: 0 } }],
      pageParams: [1],
    });
    c.setQueryData(["public-breeder-animals", target], []);
    const html = render(c, SellerProfile, { id: target });
    assert.match(html, /seller-reviews-heading/);
    assert.match(html, /Олександр Є\./);
    if (breeder) assert.match(html, /Royal Malinois/);
    c.clear();
  }
});

test("empty public history and own pending review are separate labelled concepts", () => {
  const c = client({ id: author });
  c.setQueryData(reviewListKey(target, 1), {
    data: [],
    meta: { page: 1, limit: 20, total: 0, pages: 0 },
  });
  c.setQueryData(ownReviewKey(author, target), {
    ...eligible,
    review: own,
    canReview: false,
    hasReviewed: true,
    reason: "ALREADY_REVIEWED",
  });
  const html = render(c, SellerReviews, {
    targetId: target,
    initialSummary: { averageRating: null, reviewCount: 0 },
  });
  assert.match(html, /<h3 id="public-reviews-heading">Публічні відгуки<\/h3>/);
  assert.match(html, /Публічних відгуків ще немає\./);
  assert.match(html, /Ваш відгук/);
  assert.match(html, /На модерації/);
  assert.doesNotMatch(html, /Ваш відгук на модерації\.|Ще немає відгуків\./);
  assert.equal((html.match(/Публічних відгуків ще немає\./g) || []).length, 1);
  c.clear();
});

test("profile-provided review summary stays fresh initially and expires after 30 seconds", () => {
  const c = client();
  render(c, SellerReviews, { targetId: target, initialSummary: summary });
  const query = c.getQueryCache().find({ queryKey: reviewSummaryKey(target) });
  assert.equal(query.options.staleTime, 30_000);
  assert.equal(query.isStaleByTime(30_000), false);
  c.setQueryData(reviewSummaryKey(target), summary, {
    updatedAt: Date.now() - 31_000,
  });
  assert.equal(query.isStaleByTime(30_000), true);
  c.clear();
});
