"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getOwnBreederAnimals,
  ownAnimalsKey,
} from "@/entities/breeder/animals";
export function BreederAnimalsEntry({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: [...ownAnimalsKey(userId), { page: 1 }],
    queryFn: ({ signal }) => getOwnBreederAnimals(1, signal),
  });
  const empty = query.isSuccess && query.data.meta.total === 0;
  return (
    <section
      className="breeder-media-section"
      aria-labelledby="breeder-animals-entry-title"
    >
      <h2 id="breeder-animals-entry-title">Тварини розплідника</h2>
      <p className="muted">
        Оберіть, яких ваших тварин показувати у публічному профілі розплідника.
      </p>
      <Link
        className="button primary"
        href={empty ? "/pets/new" : "/profile/breeder/animals"}
      >
        {empty ? "Додати тварину" : "Керувати тваринами"}
      </Link>
    </section>
  );
}
