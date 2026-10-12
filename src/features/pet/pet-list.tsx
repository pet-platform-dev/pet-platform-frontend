"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { breedLabel } from "@/entities/breed/model";
import { speciesLabel } from "@/entities/species/model";
import { genderLabel, type Pet } from "@/entities/pet/model";
import { ApiError } from "@/shared/api/client";
import { deletePet, getPets } from "./api";
import { PetPreview } from "@/entities/pet/ui/pet-preview";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { invalidateDeletedMarketplace } from "@/features/listing/manage-listing/api";
import { useSession } from "@/features/auth/session-provider";
import { PetMatingActions } from "@/features/mating/pet-mating-actions";
import { publicPetKey } from "@/entities/pet/public-profile";
export function PetList() {
  const userId = useSession().data!.id;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Pet | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const submitted = useRef(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["my-pets", userId, { page }],
    queryFn: ({ signal }) => getPets(page, signal),
    staleTime: 0,
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: deletePet,
    onSuccess: async (_, id) => {
      if (client.getQueryData<{ id: string }>(["current-user"])?.id !== userId)
        return;
      client.removeQueries({ queryKey: publicPetKey(id) });
      await client.invalidateQueries({ queryKey: ["mating-public"] });
      dialog.current?.close();
      setSelected(null);
      client.removeQueries({ queryKey: ["pet", id] });
      if (query.data?.data.length === 1 && page > 1) setPage(page - 1);
      await invalidateDeletedMarketplace(client);
    },
  });
  return (
    <section className="pets-container">
      <div className="pets-heading">
        <div>
          <p className="eyebrow">Особистий простір</p>
          <h1>Мої тварини</h1>
          <p className="muted">Керуйте профілями ваших улюбленців.</p>
        </div>
        <Link href="/pets/new" className="button primary">
          + Додати тварину
        </Link>
      </div>
      {query.isPending ? (
        <p className="status-panel" role="status">
          Завантажуємо тварин…
        </p>
      ) : query.isError ? (
        <div className="status-panel">
          <p role="alert">
            {query.error instanceof ApiError
              ? query.error.message
              : "Не вдалося завантажити тварин."}
          </p>
          <button className="button secondary" onClick={() => query.refetch()}>
            Спробувати ще раз
          </button>
        </div>
      ) : !query.data.data.length ? (
        <div className="pets-empty">
          <h2>У вас ще немає доданих тварин</h2>
          <p>
            Додайте профіль свого улюбленця, щоб у майбутньому створювати
            оголошення та використовувати інші можливості платформи.
          </p>
          <Link className="button primary" href="/pets/new">
            Додати тварину
          </Link>
        </div>
      ) : (
        <>
          <div className="pets-grid">
            {query.data.data.map((pet) => (
              <article className="pet-card" key={pet.id}>
                <PetPreview
                  image={pet.previewImage}
                  species={pet.species.slug}
                  alt={
                    pet.name?.trim() ||
                    (pet.breed
                      ? breedLabel(pet.breed)
                      : speciesLabel(pet.species.slug))
                  }
                />
                <div className="pet-card-top">
                  <span className="pet-species">
                    {speciesLabel(pet.species.slug)}
                  </span>
                  <span className="private-label">
                    {pet.showOnBreederProfile
                      ? "У профілі розплідника"
                      : "Приватний профіль"}
                  </span>
                </div>
                <h2>
                  {pet.name?.trim() ||
                    (pet.breed
                      ? breedLabel(pet.breed)
                      : speciesLabel(pet.species.slug))}
                </h2>
                <p className="pet-breed">
                  {pet.breed ? breedLabel(pet.breed) : "Породу не вказано"}
                </p>
                <dl>
                  {formatPetAge(pet.birthDate) && (
                    <div>
                      <dt>Вік</dt>
                      <dd>{formatPetAge(pet.birthDate)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Стать</dt>
                    <dd>{genderLabel[pet.gender]}</dd>
                  </div>
                  <div>
                    <dt>Дата народження</dt>
                    <dd>
                      {pet.birthDate
                        ? new Intl.DateTimeFormat("uk-UA", {
                            timeZone: "UTC",
                          }).format(new Date(`${pet.birthDate}T00:00:00Z`))
                        : "Не вказано"}
                    </dd>
                  </div>
                  {pet.color && (
                    <div>
                      <dt>Колір</dt>
                      <dd>{pet.color}</dd>
                    </div>
                  )}
                </dl>
                <div className="pet-card-actions">
                  <Link
                    href={`/pets/${pet.id}/edit`}
                    className="button secondary compact"
                  >
                    Редагувати
                  </Link>
                  <button
                    type="button"
                    className="delete-link"
                    aria-label={`Видалити профіль: ${pet.name?.trim() || (pet.breed ? breedLabel(pet.breed) : speciesLabel(pet.species.slug))}`}
                    onClick={() => {
                      mutation.reset();
                      setSelected(pet);
                      dialog.current?.showModal();
                    }}
                  >
                    Видалити
                  </button>
                </div>
                <PetMatingActions
                  petId={pet.id}
                  petLabel={
                    pet.name?.trim() ||
                    (pet.breed
                      ? breedLabel(pet.breed)
                      : speciesLabel(pet.species.slug))
                  }
                  activeMatingListing={pet.activeMatingListing}
                  returnTo="/pets"
                />
              </article>
            ))}
          </div>
          {query.data.meta.pages > 1 && (
            <div className="page-pagination">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </button>
              <span>
                {page} / {query.data.meta.pages}
              </span>
              <button
                className="button secondary"
                disabled={page >= query.data.meta.pages}
                onClick={() => setPage(page + 1)}
              >
                Далі
              </button>
            </div>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby="delete-title"
        aria-describedby="delete-help"
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
      >
        <h2 id="delete-title">Видалити профіль тварини?</h2>
        <p id="delete-help">
          Буде видалено профіль тварини та всі пов’язані з нею оголошення. Цю
          дію не можна скасувати.
        </p>
        {mutation.isError && (
          <p className="error-banner" role="alert">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : "Не вдалося видалити профіль."}
          </p>
        )}
        <div className="form-actions">
          <button
            autoFocus
            className="button secondary"
            disabled={mutation.isPending}
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button
            className="button danger"
            disabled={mutation.isPending || !selected}
            onClick={() => {
              if (!selected || submitted.current) return;
              submitted.current = true;
              mutation.mutate(selected.id, {
                onSettled: () => {
                  submitted.current = false;
                },
              });
            }}
          >
            {mutation.isPending ? "Видаляємо…" : "Видалити тварину"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
