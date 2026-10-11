"use client";
import Link from "next/link";
import { useOwnBreeder } from "./use-own-breeder";
export function AccountBreederLink({ userId }: { userId: string }) {
  const query = useOwnBreeder(userId);
  if (query.isPending)
    return <p role="status">Завантажуємо профіль розплідника…</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert">Не вдалося завантажити профіль розплідника.</p>
        <button
          className="button secondary"
          onClick={() => void query.refetch()}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  return (
    <div className="breeder-account-links">
      <Link className="button primary" href="/profile/breeder">
        {query.data
          ? "Редагувати профіль розплідника"
          : "Налаштувати профіль розплідника"}
      </Link>
      {query.data && (
        <Link className="button secondary" href="/profile/breeder/animals">
          Керувати тваринами
        </Link>
      )}
    </div>
  );
}
