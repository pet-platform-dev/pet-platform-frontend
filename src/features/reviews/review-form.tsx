"use client";
import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import type { User } from "@/entities/user/model";
import {
  notifySessionChange,
  sessionKey,
} from "@/features/auth/session-provider";
import { createReview } from "./api";
import { acceptOwnReview, ownReviewKey } from "./cache";
import { reviewInputSchema, type ReviewInput } from "./validation";
import { StarInput } from "./star-rating";
export function ReviewForm({
  targetId,
  authorId,
  onSuccess,
  onDuplicate,
}: {
  targetId: string;
  authorId: string;
  onSuccess: () => void;
  onDuplicate: () => void;
}) {
  const id = useId(),
    client = useQueryClient(),
    lock = useRef(false);
  const [rating, setRating] = useState(0),
    [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>(
    {},
  );
  const [message, setMessage] = useState("");
  const current = () =>
    client.getQueryData<User | null>(sessionKey)?.id === authorId;
  const mutation = useMutation({
    mutationFn: (input: ReviewInput) => {
      if (!current()) throw new Error("Session changed");
      return createReview(targetId, input);
    },
    onSuccess: (review) => {
      if (!current()) return;
      setRating(0);
      setComment("");
      onSuccess();
      acceptOwnReview(client, authorId, targetId, review);
      notifySessionChange("reviews", authorId);
    },
    onError: (error) => {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 409) {
        onDuplicate();
        void client.invalidateQueries({
          queryKey: ownReviewKey(authorId, targetId),
        });
      } else if (error instanceof ApiError && error.status === 400) {
        setMessage("Перевірте оцінку та текст відгуку.");
        void client.invalidateQueries({
          queryKey: ownReviewKey(authorId, targetId),
        });
      } else setMessage("Не вдалося надіслати відгук. Спробуйте ще раз.");
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
      <h3>Залишити відгук</h3>
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
        {mutation.isPending ? "Надсилаємо…" : "Надіслати відгук"}
      </button>
      {mutation.isPending && <p role="status">Надсилаємо відгук…</p>}
    </form>
  );
}
