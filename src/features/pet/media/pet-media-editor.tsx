"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/auth/session-provider";
import type { PetMedia } from "@/entities/pet/media";
import type { User } from "@/entities/user/model";
import { invalidateBreederAnimals } from "@/features/breeder/animals/cache";
import { getPetMedia } from "./api";
import { PetGalleryEditor } from "./pet-gallery-editor";
import { PetVideoEditor } from "./pet-video-editor";
export function PetMediaEditor({
  petId,
  disabled,
}: {
  petId: string;
  disabled: boolean;
}) {
  const client = useQueryClient(),
    router = useRouter(),
    session = useSession(),
    ownerId = session.data?.id;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  const key = ["pet-media", ownerId, petId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getPetMedia(petId, signal),
  });
  const canMutate = () =>
    Boolean(
      ownerId &&
      client.getQueryData<User | null>(["current-user"])?.id === ownerId,
    );
  async function update(value: PetMedia) {
    if (!canMutate()) return;
    client.setQueryData(key, value);
    await invalidateBreederAnimals(client);
    router.refresh();
  }
  async function command(action: () => Promise<PetMedia>) {
    if (locked.current || !canMutate()) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await action();
      if (!canMutate()) return false;
      await update(next);
      return true;
    } catch {
      setError("Не вдалося змінити медіа. Спробуйте ще раз.");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  if (query.isPending) return <p role="status">Завантажуємо медіа тварини…</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert">Не вдалося завантажити медіа.</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => void query.refetch()}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  return (
    <div className="pet-media-editor breeder-media-editor">
      {error && <p role="alert">{error}</p>}
      <PetGalleryEditor
        petId={petId}
        media={query.data}
        disabled={disabled || busy}
        canMutate={canMutate}
        update={update}
        command={command}
      />
      <PetVideoEditor
        petId={petId}
        media={query.data}
        disabled={disabled || busy}
        command={command}
      />
    </div>
  );
}
