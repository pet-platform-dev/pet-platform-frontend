"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { favoriteLoginHref } from "@/features/favorites/login-return";
import { getOwnReview } from "./api";
import { ownReviewKey } from "./cache";
import { ReviewForm } from "./review-form";
function OwnReviewEligibility({
  targetId,
  authorId,
  empty,
}: {
  targetId: string;
  authorId: string;
  empty: boolean;
}) {
  const [submitted, setSubmitted] = useState(false),
    [duplicate, setDuplicate] = useState(false);
  const own = useQuery({
    queryKey: ownReviewKey(authorId, targetId),
    queryFn: ({ signal }) => getOwnReview(targetId, signal),
  });
  if (own.isPending)
    return (
      <p className="review-state" role="status">
        Перевіряємо можливість залишити відгук…
      </p>
    );
  if (own.isError)
    return (
      <div className="review-state">
        <p role="alert">Не вдалося перевірити можливість залишити відгук.</p>
        <button className="button secondary" onClick={() => own.refetch()}>
          Спробувати ще раз
        </button>
      </div>
    );
  const state = own.data;
  if (state.isSelf)
    return <p className="muted">Ви не можете залишити відгук самому собі.</p>;
  if (state.review || state.hasReviewed || duplicate)
    return (
      <div className="review-own-status" role="status">
        {submitted && <p>Дякуємо! Ваш відгук надіслано на модерацію.</p>}
        {duplicate && <p>Ви вже залишили відгук цьому користувачу.</p>}
        <p>
          {state.review?.status === "PENDING"
            ? "Ваш відгук на модерації."
            : state.review?.status === "REJECTED" ||
                state.review?.status === "HIDDEN"
              ? "Ви вже залишили відгук. Зараз він не відображається публічно."
              : "Ви вже залишили відгук."}
        </p>
      </div>
    );
  if (!state.canReview) return null;
  return (
    <>
      {empty && (
        <p className="muted">Будьте першим, хто поділиться враженнями.</p>
      )}
      <ReviewForm
        targetId={targetId}
        authorId={authorId}
        onSuccess={() => setSubmitted(true)}
        onDuplicate={() => setDuplicate(true)}
      />
    </>
  );
}
export function ReviewEligibility({
  targetId,
  empty,
}: {
  targetId: string;
  empty: boolean;
}) {
  const session = useSession();
  if (session.isPending)
    return (
      <p className="review-state" role="status">
        Перевіряємо сесію…
      </p>
    );
  if (session.isError)
    return (
      <div className="review-state">
        <p role="alert">Не вдалося перевірити сесію.</p>
        <button className="button secondary" onClick={() => session.refetch()}>
          Спробувати ще раз
        </button>
      </div>
    );
  if (!session.data)
    return (
      <div className="review-anonymous">
        {empty && (
          <p className="muted">Будьте першим, хто поділиться враженнями.</p>
        )}
        <Link
          className="button secondary"
          href={favoriteLoginHref(`/sellers/${targetId}`)}
        >
          Увійдіть, щоб залишити відгук
        </Link>
      </div>
    );
  return (
    <OwnReviewEligibility
      key={session.data.id + targetId}
      targetId={targetId}
      authorId={session.data.id}
      empty={empty}
    />
  );
}
