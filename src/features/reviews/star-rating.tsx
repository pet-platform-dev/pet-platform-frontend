import { useId } from "react";
export function StarIcon({ filled = true }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
    </svg>
  );
}
export function StarRating({ value }: { value: number }) {
  const label = new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 1,
  }).format(value);
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={`Рейтинг ${label} з 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span className="review-star-display" key={star} aria-hidden="true">
          <StarIcon filled={false} />
          <span
            className="review-star-fill"
            style={{
              width: `${Math.max(0, Math.min(1, value - star + 1)) * 100}%`,
            }}
          >
            <StarIcon />
          </span>
        </span>
      ))}
    </span>
  );
}
export function StarInput({
  value,
  onChange,
  disabled,
  error,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset
      className="review-rating-input"
      disabled={disabled}
      aria-describedby={error ? id + "-error" : undefined}
      aria-invalid={!!error}
    >
      <legend>Оцінка</legend>
      <div className="review-rating-options">
        {[1, 2, 3, 4, 5].map((star) => (
          <label className="review-rating-option" key={star}>
            <input
              type="radio"
              name={id}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              aria-label={`${star} з 5`}
            />
            <span className={star <= value ? "is-filled" : ""}>
              <StarIcon filled={star <= value} />
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="field-error" id={id + "-error"}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
