"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getBreederAnimals,
  publicAnimalsKey,
  type BreederAnimal,
} from "@/entities/breeder/animals";
import { AnimalCard } from "./animal-card";
import { AnimalsPagination } from "./animals-pagination";
import { ApiError } from "@/shared/api/client";
export function PublicAnimalCard({ animal }: { animal: BreederAnimal }) {
  return (
    <AnimalCard animal={animal}>
      <Link className="button secondary" href={"/pets/" + animal.id}>
        Переглянути профіль тварини
      </Link>
    </AnimalCard>
  );
}
export function PublicBreederAnimals({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [...publicAnimalsKey(userId), { page }],
    queryFn: ({ signal }) => getBreederAnimals(userId, page, signal),
    staleTime: 0,
  });
  if (query.isPending)
    return <p role="status">Завантажуємо тварин розплідника…</p>;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404)
      return null;
    return (
      <div>
        <p role="alert">Не вдалося завантажити тварин розплідника.</p>
        <button
          className="button secondary"
          onClick={() => void query.refetch()}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }
  if (!query.data.meta.total) return null;
  return (
    <section
      className="breeder-public-animals"
      aria-labelledby="breeder-animals-title"
    >
      <h2 id="breeder-animals-title">Наші тварини</h2>
      <p className="muted">
        Тварини, яких розплідник обрав для представлення у профілі.
      </p>
      <div className="breeder-animals-grid">
        {query.data.data.map((animal) => (
          <PublicAnimalCard key={animal.id} animal={animal} />
        ))}
      </div>
      <AnimalsPagination
        page={page}
        pages={query.data.meta.pages}
        onPage={setPage}
      />
    </section>
  );
}
