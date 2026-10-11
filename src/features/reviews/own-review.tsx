"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OwnReview } from "@/entities/review/model";
import { reviewDate } from "@/entities/review/model";
import type { User } from "@/entities/user/model";
import {
  sessionKey,
  notifySessionChange,
} from "@/features/auth/session-provider";
import { ownReviewKey, refreshReviewPublicCache } from "./cache";
import { deleteReview } from "./api";
import { ReviewForm } from "./review-form";
import { StarRating } from "./star-rating";
export const reviewStatusLabels = {
  PENDING: "На модерації",
  APPROVED: "Опубліковано",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
} as const;
export function OwnReviewCard({
  review,
  authorId,
  targetId,
  onNotice,
}: {
  review: OwnReview;
  authorId: string;
  targetId: string;
  onNotice: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const client = useQueryClient(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    editTrigger = useRef<HTMLButtonElement>(null),
    lock = useRef(false);
  const current = () =>
    client.getQueryData<User | null>(sessionKey)?.id === authorId;
  const deletion = useMutation({
    mutationFn: () => {
      if (!current()) throw new Error("Session changed");
      return deleteReview(targetId);
    },
    onSuccess: () => {
      dialog.current?.close();
      if (!current()) return;
      onNotice("Відгук видалено. Ви можете залишити новий відгук.");
      client.setQueryData(ownReviewKey(authorId, targetId), {
        review: null,
        canReview: authorId !== targetId,
        hasReviewed: false,
        isSelf: authorId === targetId,
        reason: authorId === targetId ? "SELF_REVIEW" : null,
      });
      void client.invalidateQueries({
        queryKey: ownReviewKey(authorId, targetId),
      });
      void refreshReviewPublicCache(client, targetId, review.id);
      notifySessionChange("review-management", authorId, targetId);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>(
            '.seller-reviews .review-form input[type="radio"]',
          )
          ?.focus(),
      );
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  return (
    <article className="review-card own-review-card">
      <header>
        <h3>Ваш відгук</h3>
        <span
          className={`review-status review-status-${review.status.toLowerCase()}`}
        >
          {reviewStatusLabels[review.status]}
        </span>
      </header>
      {editing && review.status !== "HIDDEN" ? (
        <ReviewForm
          key={review.id}
          targetId={targetId}
          authorId={authorId}
          initialReview={review}
          onDuplicate={() => {}}
          onCancel={() => {
            setEditing(false);
            requestAnimationFrame(() => editTrigger.current?.focus());
          }}
          onSuccess={() => {
            setEditing(false);
            onNotice(
              "Зміни збережено. Відгук повторно надіслано на модерацію.",
            );
            requestAnimationFrame(() => editTrigger.current?.focus());
          }}
        />
      ) : (
        <>
          <div className="review-card-meta">
            <StarRating value={review.rating} />
            <time dateTime={review.createdAt}>
              {reviewDate(review.createdAt)}
            </time>
          </div>
          <p className="review-comment">{review.comment}</p>
          <p className="muted">
            {review.status === "PENDING"
              ? "Відгук перевіряється перед публікацією."
              : review.status === "REJECTED"
                ? "Відгук відхилено."
                : review.status === "HIDDEN"
                  ? "Відгук приховано модерацією."
                  : "Ваш відгук опубліковано."}
          </p>
          <div className="form-actions review-owner-actions">
            {review.status !== "HIDDEN" && (
              <button
                ref={editTrigger}
                className="button secondary"
                type="button"
                onClick={() => setEditing(true)}
              >
                {review.status === "REJECTED" ? "Відредагувати" : "Редагувати"}
              </button>
            )}
            <button
              ref={trigger}
              className="button secondary review-delete-action"
              type="button"
              disabled={deletion.isPending}
              onClick={() => {
                deletion.reset();
                dialog.current?.showModal();
              }}
            >
              Видалити
            </button>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby={`review-delete-${review.id}`}
        aria-describedby={`review-delete-help-${review.id}`}
        onClose={() => trigger.current?.focus()}
        onCancel={(event) => {
          if (deletion.isPending) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const nodes = Array.from(
              dialog.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ) ?? [],
            ),
            first = nodes[0],
            last = nodes.at(-1);
          if (
            first &&
            last &&
            ((event.shiftKey && document.activeElement === first) ||
              (!event.shiftKey && document.activeElement === last))
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }}
      >
        <h2 id={`review-delete-${review.id}`}>Видалити відгук?</h2>
        <p id={`review-delete-help-${review.id}`}>
          Відгук буде видалено назавжди. Після цього ви зможете залишити новий
          відгук.
        </p>
        {deletion.isError && (
          <p role="alert">Не вдалося видалити відгук. Спробуйте ще раз.</p>
        )}
        <div className="form-actions">
          <button
            autoFocus
            className="button secondary"
            type="button"
            disabled={deletion.isPending}
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button
            className="button danger"
            type="button"
            disabled={deletion.isPending}
            onClick={() => {
              if (lock.current) return;
              lock.current = true;
              deletion.mutate();
            }}
          >
            {deletion.isPending ? "Видаляємо…" : "Видалити"}
          </button>
        </div>
      </dialog>
    </article>
  );
}
