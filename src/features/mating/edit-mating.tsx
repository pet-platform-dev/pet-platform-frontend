"use client";
import { PublicationState } from "@/shared/ui/publication-state";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  getOwnedMating,
  getActiveMating,
  updateMating,
  actOnMating,
} from "@/entities/mating-listing/api";
import { canEdit, feeLabel } from "@/entities/mating-listing/model";
import { listingLocation } from "@/entities/listing/model/presentation";
import { ListingManagementSkeleton } from "@/features/listing/manage-listing/listing-management-skeleton";
import { MatingForm } from "./mating-form";
import { MatingPetSummary } from "./pet-selection";
import { MatingActions } from "./mating-actions";
import { matingFields, matingError, type MatingFormInput } from "./model";
import { matingKeys, currentMatingUser, refreshMating } from "./cache";
import { ApiError } from "@/shared/api/client";
export function EditMating({ id }: { id: string }) {
  const userId = useSession().data!.id,
    client = useQueryClient();
  const query = useQuery({
    queryKey: matingKeys.detail(userId, id),
    queryFn: ({ signal }) => getOwnedMating(id, userId, signal),
  });
  const active = useQuery({
    queryKey: matingKeys.active(userId),
    queryFn: ({ signal }) => getActiveMating(signal),
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function save(input: MatingFormInput, publish: boolean) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setNotice("");
    let saved = false;
    try {
      let row = await updateMating(id, matingFields(input));
      saved = true;
      if (!currentMatingUser(client, userId)) return;
      client.setQueryData(matingKeys.detail(userId, id), row);
      if (publish) {
        const published = await actOnMating(id, "publish");
        if (!currentMatingUser(client, userId)) return;
        if (published) row = published;
      }
      await refreshMating(client, userId, id, row);
      if (currentMatingUser(client, userId))
        setNotice(
          publish ? "Оголошення надіслано на модерацію." : "Зміни збережено.",
        );
    } catch (e) {
      if (currentMatingUser(client, userId)) {
        setError(
          (publish && saved ? "Чернетку збережено. " : "") + matingError(e),
        );
        if (saved || (e instanceof ApiError && e.status === 409))
          await refreshMating(
            client,
            userId,
            id,
            undefined,
            query.data?.pet.id,
          );
        else void active.refetch();
      }
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  if (query.isPending || active.isPending)
    return <ListingManagementSkeleton editor />;
  if (!query.data || !active.data)
    return (
      <section className="mating-panel">
        <p role="alert">
          {query.isError
            ? matingError(query.error)
            : "Не вдалося перевірити активні оголошення."}
        </p>
        <button
          className="button secondary"
          onClick={() => {
            void query.refetch();
            void active.refetch();
          }}
        >
          Спробувати ще раз
        </button>
      </section>
    );
  const row = query.data;
  return (
    <>
      <div
        className="mating-status-heading"
        id="mating-status"
        tabIndex={-1}
        aria-label="Стан оголошення"
      >
        <PublicationState row={row} />
        {notice && <p role="status">{notice}</p>}
      </div>
      {(query.isError || active.isError) && (
        <section className="mating-panel">
          <p role="alert">
            {active.isError
              ? "Не вдалося перевірити активні оголошення."
              : "Не вдалося оновити оголошення. Введені дані збережено у формі."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              void query.refetch();
              void active.refetch();
            }}
          >
            Спробувати ще раз
          </button>
        </section>
      )}
      {canEdit(row.status, row.moderationStatus) ? (
        <MatingForm
          key={`${id}:${row.updatedAt}`}
          listing={row}
          active={active.data}
          pending={pending}
          publishBlocked={active.isError || active.isFetching}
          error={error}
          onSubmit={save}
        />
      ) : (
        <section className="mating-panel">
          <MatingPetSummary pet={row.pet} />
          <p className="mating-description">{row.description}</p>
          <p>{listingLocation(row.location)}</p>
          <p>{feeLabel(row.fee)}</p>
          <p className="muted">Це оголошення доступне лише для перегляду.</p>
        </section>
      )}
      <MatingActions row={row} userId={userId} disabled={pending} />
    </>
  );
}
