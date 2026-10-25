"use client";
import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { useOwnBreeder } from "./use-own-breeder";
import { BreederForm } from "./breeder-form";
import { BreederHandoffs } from "../handoff/handoffs";
import { ClaimPublication } from "./claim-publication";
function OwnBreederEditor({ userId }: { userId: string }) {
  const query = useOwnBreeder(userId);
  if (query.isPending)
    return (
      <div role="status" className="breeder-editor-loading">
        Завантажуємо профіль розплідника…
        <div aria-hidden="true" className="skeleton-block" />
        <div aria-hidden="true" className="skeleton-block" />
      </div>
    );
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
    <>
      {query.data?.publicationHeld && (
        <ClaimPublication
          key={`publication:${userId}`}
          userId={userId}
          preparedContacts={query.data.preparedContacts}
        />
      )}
      <BreederHandoffs key={`handoffs:${userId}`} userId={userId} />
      <BreederForm key={userId} userId={userId} profile={query.data} />
    </>
  );
}
function BreederAccess() {
  const session = useSession();
  if (session.data?.accountType !== "BREEDER")
    return (
      <section className="status-panel">
        <h1>Профіль розплідника</h1>
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
