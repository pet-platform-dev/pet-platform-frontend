"use client";
import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { useOwnBreeder } from "./use-own-breeder";
import { BreederForm } from "./breeder-form";
function OwnBreederEditor({ userId }: { userId: string }) {
  const query = useOwnBreeder(userId);
  if (query.isPending)
    return (
      <div role="status" className="breeder-editor-loading">
        Завантажуємо профіль заводчика…
        <div aria-hidden="true" className="skeleton-block" />
        <div aria-hidden="true" className="skeleton-block" />
      </div>
    );
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
  return <BreederForm key={userId} userId={userId} profile={query.data} />;
}
function BreederAccess() {
  const session = useSession();
  if (session.data?.accountType !== "BREEDER")
    return (
      <section className="status-panel">
        <h1>Профіль заводчика</h1>
        <p>Редактор доступний для акаунта заводчика.</p>
        <Link href="/account" className="button secondary">
          До акаунта
        </Link>
      </section>
    );
  return <OwnBreederEditor userId={session.data.id} />;
}
export function BreederEditor() {
  return (
    <RequireSession>
      <BreederAccess />
    </RequireSession>
  );
}
