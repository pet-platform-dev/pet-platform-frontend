"use client";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ReviewSummary } from "@/entities/review/model";
import { getReviews, getReviewSummary } from "./api";
import { reviewListKey, reviewSummaryKey } from "./cache";
import { ReviewSummaryView } from "./review-summary";
import { ReviewEligibility } from "./review-eligibility";
import { ReviewCard } from "./review-card";
export function SellerReviews({
  targetId,
  initialSummary,
}: {
  targetId: string;
  initialSummary?: ReviewSummary;
}) {
  const [page, setPage] = useState(1);
  const summary = useQuery({
    queryKey: reviewSummaryKey(targetId),
    queryFn: ({ signal }) => getReviewSummary(targetId, signal),
    initialData: initialSummary,
    staleTime: initialSummary ? Infinity : 30_000,
  });
  const reviews = useQuery({
    placeholderData: keepPreviousData,
    queryKey: reviewListKey(targetId, page),
    queryFn: ({ signal }) => getReviews(targetId, page, signal),
  });
  const displayedSummary = summary.data ?? initialSummary;
  return (
    <section
      className="seller-reviews"
      aria-labelledby="seller-reviews-heading"
    >
      <h2 id="seller-reviews-heading">Відгуки</h2>
      <section
        className="public-reviews"
        aria-labelledby="public-reviews-heading"
      >
        <h3 id="public-reviews-heading">Публічні відгуки</h3>
        {summary.isFetching ? (
          <p role="status">Оновлюємо оцінку…</p>
        ) : displayedSummary && !summary.isError ? (
          <ReviewSummaryView summary={displayedSummary} />
        ) : summary.isError ? (
          <div role="alert">
            <p>Не вдалося завантажити оцінку.</p>
            <button
              className="button secondary"
              onClick={() => summary.refetch()}
            >
              Спробувати ще раз
            </button>
          </div>
        ) : (
          <p role="status">Завантажуємо оцінку…</p>
        )}
        <div className="review-list" aria-busy={reviews.isFetching}>
          {reviews.isFetching && !reviews.isPending && (
            <p role="status">Завантажуємо відгуки…</p>
          )}
          {reviews.isPending ? (
            <p className="review-state" role="status">
              Завантажуємо відгуки…
            </p>
          ) : reviews.isError ? (
            <div className="review-state">
              <p role="alert">Не вдалося завантажити відгуки.</p>
              <button
                className="button secondary"
                onClick={() => reviews.refetch()}
              >
                Спробувати ще раз
              </button>
            </div>
          ) : reviews.data.data.length ? (
            reviews.data.data.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : page > 1 ? (
            <p>На цій сторінці немає відгуків.</p>
          ) : displayedSummary?.reviewCount !== 0 ? (
            <p className="review-empty">Публічних відгуків ще немає.</p>
          ) : null}
        </div>
        {(page > 1 || (reviews.data?.meta.pages ?? 0) > 1) && (
          <nav className="page-pagination" aria-label="Сторінки відгуків">
            <button
              className="button secondary"
              disabled={page <= 1 || reviews.isFetching}
              onClick={() => setPage(page - 1)}
            >
              Назад
            </button>
            <span aria-live="polite">
              {page} /{" "}
              {reviews.data ? Math.max(page, reviews.data.meta.pages) : "…"}
            </span>
            <button
              className="button secondary"
              disabled={
                !reviews.data ||
                reviews.isFetching ||
                page >= reviews.data.meta.pages
              }
              onClick={() => setPage(page + 1)}
            >
              Далі
            </button>
          </nav>
        )}
      </section>
      <ReviewEligibility
        targetId={targetId}
        empty={displayedSummary?.reviewCount === 0}
      />
    </section>
  );
}
