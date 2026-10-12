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
import { resolveOwnedMatingPetId } from "./preselection";
import { matingEditHref } from "./detail/navigation";
export function CreateMating({
  petId,
  returnTo,
}: { petId?: string | string[]; returnTo?: string } = {}) {
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
        router.replace(matingEditHref(row.id, returnTo));
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
        key={userId}
        initialPetId={resolveOwnedMatingPetId(petId, pets.data)}
        pets={pets.data}
        active={active.data}
        onSubmit={save}
        pending={pending}
        error={error}
      />
    </>
  );
}
