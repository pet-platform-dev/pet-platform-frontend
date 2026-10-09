"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changeListingStatus,
  invalidateListings,
  managementError,
} from "./api";
import { completion, type OwnListing, type Status } from "./model";
export function ListingActions({
  listing,
  showArchive = true,
}: {
  listing: OwnListing;
  showArchive?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null),
    submitted = useRef(false);
  const [action, setAction] = useState<{
    status: Status;
    question: string;
  } | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    retry: false,
    mutationFn: (status: Status) => changeListingStatus(listing.id, status),
    onSuccess: async () => {
      dialog.current?.close();
      await invalidateListings(client, listing.id);
    },
  });
  function confirm(
    event: React.MouseEvent<HTMLButtonElement>,
    selected: { status: Status; question: string },
  ) {
    trigger.current = event.currentTarget;
    mutation.reset();
    setAction(selected);
    dialog.current?.showModal();
  }
  const done = completion(listing.type);
  return (
    <>
      {listing.status === "ACTIVE" && (
        <button
          className="button secondary"
          onClick={(event) => confirm(event, done)}
        >
          {done.label}
        </button>
      )}
      {showArchive && listing.status !== "ARCHIVED" && (
        <button
          className="button secondary"
          onClick={(event) =>
            confirm(event, {
              status: "ARCHIVED",
              question: "Перемістити оголошення в архів?",
            })
          }
        >
          В архів
        </button>
      )}
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby={`confirm-${listing.id}`}
        aria-describedby={`confirm-help-${listing.id}`}
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
      >
        <h2 id={`confirm-${listing.id}`}>{action?.question}</h2>
        <p id={`confirm-help-${listing.id}`}>
          Оголошення більше не відображатиметься в активному каталозі. Тварина
          та історія оголошення збережуться.
        </p>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {managementError(
              mutation.error,
              "Не вдалося змінити статус оголошення.",
            )}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            autoFocus
            disabled={mutation.isPending}
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            className="button primary"
            onClick={() => {
              if (!action || submitted.current) return;
              submitted.current = true;
              mutation.mutate(action.status, {
                onSettled: () => {
                  submitted.current = false;
                },
              });
            }}
          >
            {mutation.isPending ? "Змінюємо…" : "Підтвердити"}
          </button>
        </div>
      </dialog>
    </>
  );
}
