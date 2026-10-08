"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getOwnPetChoices } from "@/entities/pet/api/get-own-pet-choices";
import { CreateListingForm } from "./create-listing-form";
export function CreateListingPage() {
  const pets = useQuery({
    queryKey: ["my-pets", "listing-create"],
    queryFn: getOwnPetChoices,
  });
  return (
    <main className="listing-create-shell">
      <Link href="/listings" className="text-link listing-back-link">
        ← До оголошень
      </Link>
      {pets.isSuccess && pets.data.length === 0 ? (
        <section className="catalog-state">
          <h1>У вас ще немає доданих тварин</h1>
          <p>
            Спочатку додайте профіль тварини, для якої хочете створити
            оголошення.
          </p>
          <Link href="/pets/new" className="button primary">
            Додати тварину
          </Link>
        </section>
      ) : pets.isError ? (
        <section className="catalog-state" role="alert">
          <h1>Не вдалося завантажити дані форми</h1>
          <p>Перевірте з’єднання та спробуйте ще раз.</p>
          <button
            className="button primary"
            disabled={pets.isFetching}
            onClick={() => {
              void pets.refetch();
            }}
          >
            Спробувати ще раз
          </button>
        </section>
      ) : pets.isPending ? (
        <section className="status-panel" role="status">
          Завантажуємо тварин…
        </section>
      ) : (
        <CreateListingForm pets={pets.data} />
      )}
    </main>
  );
}
