"use client";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/auth/session-provider";
import { createMating } from "@/entities/mating-listing/api";
import { ListingManagementSkeleton } from "@/features/listing/manage-listing/listing-management-skeleton";
import { useMatingSource } from "./use-mating-source";
import { MatingForm } from "./mating-form";
import { matingFields, matingError, type MatingFormInput } from "./model";
import { currentMatingUser, refreshMating } from "./cache";
export function CreateMating() {
  const userId = useSession().data!.id,
    client = useQueryClient(),
    router = useRouter();
  const { pets, active } = useMatingSource(userId);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function save(input: MatingFormInput) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const row = await createMating({
        ...matingFields(input),
        petId: input.petId,
      });
      if (!currentMatingUser(client, userId)) return;
      await refreshMating(client, userId, row.id, row);
      if (currentMatingUser(client, userId))
        router.replace(`/mating/${row.id}/edit`);
    } catch (e) {
      if (currentMatingUser(client, userId)) {
        setError(matingError(e));
        void active.refetch();
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  if (pets.isPending || active.isPending)
    return <ListingManagementSkeleton editor />;
  if (!pets.data || !active.data)
    return (
      <section className="mating-panel">
        <p role="alert">Не вдалося завантажити ваших тварин та оголошення.</p>
        <button
          className="button secondary"
          onClick={() => {
            void pets.refetch();
            void active.refetch();
          }}
        >
          Спробувати ще раз
        </button>
      </section>
    );
  return (
    <>
      {(pets.isError || active.isError) && (
        <section className="mating-panel">
          <p role="alert">
            {active.isError
              ? "Не вдалося перевірити активні оголошення."
              : "Не вдалося оновити список тварин."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              void pets.refetch();
              void active.refetch();
            }}
          >
            Спробувати ще раз
          </button>
        </section>
      )}
      <MatingForm
        pets={pets.data}
        active={active.data}
        onSubmit={save}
        pending={pending}
        error={error}
      />
    </>
  );
}
