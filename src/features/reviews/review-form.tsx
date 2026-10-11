"use client";
import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import type { User } from "@/entities/user/model";
import {
  notifySessionChange,
  sessionKey,
} from "@/features/auth/session-provider";
import { createReview, editReview } from "./api";
import {
  acceptOwnReview,
  ownReviewKey,
  refreshReviewPublicCache,
} from "./cache";
import type { OwnReview } from "@/entities/review/model";
import { reviewInputSchema, type ReviewInput } from "./validation";
import { StarInput } from "./star-rating";
export function ReviewForm({
  targetId,
  authorId,
  onSuccess,
  onDuplicate,
  initialReview,
  onCancel,
}: {
  targetId: string;
  authorId: string;
  onSuccess: () => void;
  onDuplicate: () => void;
  initialReview?: OwnReview;
  onCancel?: () => void;
}) {
  const id = useId(),
    client = useQueryClient(),
    lock = useRef(false);
  const [rating, setRating] = useState(initialReview?.rating ?? 0),
    [comment, setComment] = useState(initialReview?.comment ?? "");
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>(
    {},
  );
  const [message, setMessage] = useState("");
  const current = () =>
    client.getQueryData<User | null>(sessionKey)?.id === authorId;
  const mutation = useMutation({
    mutationFn: (input: ReviewInput) => {
      if (!current()) throw new Error("Session changed");
      return initialReview
        ? editReview(targetId, input)
        : createReview(targetId, input);
    },
    onSuccess: (review) => {
      if (!current()) return;
      setRating(0);
      setComment("");
      onSuccess();
      acceptOwnReview(client, authorId, targetId, review);
      notifySessionChange("reviews", authorId);
      if (initialReview) {
        void refreshReviewPublicCache(client, targetId, initialReview.id);
        notifySessionChange("review-management", authorId, targetId);
      }
    },
    onError: (error) => {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 409) {
        if (initialReview)
          setMessage(
            "Цей відгук приховано модерацією і його не можна редагувати.",
          );
        else onDuplicate();
        void client.invalidateQueries({
          queryKey: ownReviewKey(authorId, targetId),
        });
      } else if (error instanceof ApiError && error.status === 400) {
        setMessage("Перевірте оцінку та текст відгуку.");
        void client.invalidateQueries({
          queryKey: ownReviewKey(authorId, targetId),
        });
      } else
        setMessage(
          initialReview
            ? "Не вдалося зберегти зміни. Спробуйте ще раз."
            : "Не вдалося надіслати відгук. Спробуйте ще раз.",
        );
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  return (
    <form
      className="review-form"
      noValidate
      aria-busy={mutation.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        if (lock.current) return;
        const parsed = reviewInputSchema.safeParse({ rating, comment });
        if (!parsed.success) {
          const fields: typeof errors = {};
          for (const issue of parsed.error.issues) {
            const field = issue.path[0];
            if (field === "rating" || field === "comment")
              fields[field] ??= issue.message;
          }
          setErrors(fields);
          setMessage("");
          const first = !fields.rating
            ? document.getElementById(id + "-comment")
            : event.currentTarget.querySelector<HTMLInputElement>(
                'input[type="radio"]',
              );
          first?.focus();
          return;
        }
        lock.current = true;
        setErrors({});
        setMessage("");
        mutation.mutate(parsed.data);
      }}
    >
      <h3>{initialReview ? "Редагувати відгук" : "Залишити відгук"}</h3>
      {initialReview?.status === "APPROVED" && (
        <p className="review-edit-warning">
          Після редагування відгук знову буде надіслано на модерацію та
          тимчасово зникне з публічного списку.
        </p>
      )}
      <StarInput
        value={rating}
        onChange={setRating}
        disabled={mutation.isPending}
        error={errors.rating}
      />
      <div className="field">
        <label htmlFor={id + "-comment"}>Коментар</label>
        <textarea
          id={id + "-comment"}
          value={comment}
          disabled={mutation.isPending}
          onChange={(event) => setComment(event.target.value)}
          aria-invalid={!!errors.comment}
          aria-describedby={`${id}-hint${errors.comment ? ` ${id}-error` : ""}`}
          rows={5}
        />
        <span className="review-comment-hint" id={id + "-hint"}>
          <span>10–2000 символів, без HTML</span>
          <span>{comment.trim().length} / 2000</span>
        </span>
        {errors.comment && (
          <p className="field-error" id={id + "-error"}>
            {errors.comment}
          </p>
        )}
      </div>
      {message && <p role="alert">{message}</p>}
      <button
        className="button primary"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending
          ? "Надсилаємо…"
          : initialReview
            ? "Зберегти зміни"
            : "Надіслати відгук"}
      </button>
      {onCancel && (
        <button
          className="button secondary"
          type="button"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Скасувати
        </button>
      )}
      {mutation.isPending && <p role="status">Надсилаємо відгук…</p>}
    </form>
  );
}
