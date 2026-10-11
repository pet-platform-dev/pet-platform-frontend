"use client";
import Link from "next/link";
import { breederPetEditorHref } from "@/features/pet/navigation/editor-return";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { useOwnBreeder } from "../editor/use-own-breeder";
import {
  getOwnBreederAnimals,
  ownAnimalsKey,
} from "@/entities/breeder/animals";
import { AnimalManagementCard } from "./animal-management-card";
import { AnimalsPagination } from "./animals-pagination";
function Animals({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [...ownAnimalsKey(userId), { page }],
    queryFn: ({ signal }) => getOwnBreederAnimals(page, signal),
    staleTime: 0,
  });
  return (
    <section className="breeder-animals-management">
      <header className="pets-heading">
        <div>
          <h1>Тварини розплідника</h1>
          <p className="muted">
            Оберіть тварин для публічного профілю. Оголошення керуються окремо.
          </p>
        </div>
        <Link className="button primary" href={breederPetEditorHref()}>
          Додати тварину
        </Link>
      </header>
      {query.isPending ? (
        <p role="status">Завантажуємо тварин…</p>
      ) : query.isError ? (
        <div>
          <p role="alert">Не вдалося завантажити тварин.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : !query.data.data.length ? (
        <p className="status-panel">У вас ще немає тварин.</p>
      ) : (
        <>
          <div className="breeder-animals-grid">
            {query.data.data.map((animal) => (
              <AnimalManagementCard
                key={animal.id}
                animal={animal}
                userId={userId}
              />
            ))}
          </div>
          <AnimalsPagination
            page={page}
            pages={query.data.meta.pages}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}
function ProfileGate({ userId }: { userId: string }) {
  const profile = useOwnBreeder(userId);
  if (profile.isPending)
    return <p role="status">Завантажуємо профіль розплідника…</p>;
  if (profile.isError)
    return (
      <div>
        <p role="alert">Не вдалося завантажити профіль розплідника.</p>
        <button
          className="button secondary"
          onClick={() => void profile.refetch()}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  if (!profile.data)
    return (
      <section className="status-panel">
        <h1>Спочатку налаштуйте профіль розплідника</h1>
        <Link className="button primary" href="/profile/breeder">
          Налаштувати профіль
        </Link>
      </section>
    );
  return <Animals key={userId} userId={userId} />;
}
function Access() {
  const session = useSession();
  if (session.data?.accountType !== "BREEDER")
    return (
      <section className="status-panel">
        <h1>Тварини розплідника</h1>
        <p>Розділ доступний для акаунта заводчика.</p>
        <Link href="/account" className="button secondary">
          До акаунта
        </Link>
      </section>
    );
  return <ProfileGate userId={session.data.id} />;
}
export function BreederAnimalsManagement() {
  return (
    <RequireSession>
      <Access />
    </RequireSession>
  );
}
