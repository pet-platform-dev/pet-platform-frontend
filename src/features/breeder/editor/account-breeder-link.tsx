"use client";
import Link from "next/link";
import { useOwnBreeder } from "./use-own-breeder";
export function AccountBreederLink({ userId }: { userId: string }) {
  const query = useOwnBreeder(userId);
  if (query.isPending)
    return <p role="status">Завантажуємо профіль заводчика…</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert">Не вдалося завантажити профіль заводчика.</p>
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
          ? "Редагувати профіль заводчика"
          : "Налаштувати профіль заводчика"}
      </Link>
      {query.data && (
        <Link href={"/sellers/" + userId}>Переглянути публічний профіль</Link>
      )}
    </div>
  );
}
