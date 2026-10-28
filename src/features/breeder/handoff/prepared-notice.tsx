"use client";
import Link from "next/link";
import { useOwnBreeder } from "../editor/use-own-breeder";
import { usePreparedListings } from "./use-prepared-listings";
import { useSession } from "@/features/auth/session-provider";

export function PreparedNotice({ userId }: { userId: string }) {
  const session = useSession();
  const breeder = useOwnBreeder(userId);
  const query = usePreparedListings(userId, breeder.data?.id);
  if (
    session.data?.id !== userId ||
    session.data.accountType !== "BREEDER" ||
    session.data.verificationStatus !== "VERIFIED"
  )
    return null;
  if (breeder.data && query.isError)
    return (
      <aside className="dashboard-card" role="alert">
        <p>Не вдалося перевірити підготовлені оголошення.</p>
        <Link href="/profile/breeder#prepared-listings">
          Переглянути матеріали розплідника
        </Link>
        <button
          className="button secondary"
          onClick={() => void query.refetch()}
        >
          Повторити
        </button>
      </aside>
    );
  if (!breeder.data || !query.data?.meta.total) return null;
  return (
    <aside
      className="dashboard-card auth-form"
      aria-label="Підготовлені оголошення розплідника"
    >
      <h2>Підготовлені оголошення</h2>
      <p>
        Для розплідника «{query.data.breeder.kennelName}» є приватні
        підготовлені матеріали. Перегляньте та прийміть пов’язаний пакет, щоб
        отримати власні приватні чернетки. Наявні окремі пропозиції передачі
        приймаються в тому самому розділі.
      </p>
      <Link
        className="button secondary"
        href="/profile/breeder#prepared-listings"
      >
        Переглянути підготовлені оголошення ({query.data.meta.total})
      </Link>
    </aside>
  );
}
