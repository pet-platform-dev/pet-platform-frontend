import { ApiError } from "@/shared/api/client";
export function ProfileError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <section role="alert">
      <h1>
        {missing ? "Продавця не знайдено" : "Не вдалося завантажити профіль"}
      </h1>
      {!missing && (
        <button className="button secondary" onClick={retry}>
          Спробувати ще раз
        </button>
      )}
    </section>
  );
}
