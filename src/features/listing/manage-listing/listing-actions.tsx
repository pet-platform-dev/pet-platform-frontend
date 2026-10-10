"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changeListingStatus,
  deleteListing,
  invalidateDeletedMarketplace,
  invalidateListings,
  managementError,
} from "./api";
import { completion, type OwnListing, type Status } from "./model";
export function ListingActions({
  listing,
  showArchive = true,
  redirectAfterDelete = false,
}: {
  listing: OwnListing;
  showArchive?: boolean;
  redirectAfterDelete?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null),
    submitted = useRef(false);
  const [action, setAction] = useState<{
    status: Status | "DELETE";
    question: string;
  } | null>(null);
  const client = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    retry: false,
    mutationFn: async (status: Status | "DELETE") => {
      if (status === "DELETE") await deleteListing(listing.id);
      else await changeListingStatus(listing.id, status);
    },
    onSuccess: async (_, status) => {
      dialog.current?.close();
      if (status === "DELETE") {
        if (redirectAfterDelete) router.replace("/my-listings");
        await invalidateDeletedMarketplace(client, listing.id);
      } else await invalidateListings(client, listing.id);
    },
  });
  function confirm(
    event: React.MouseEvent<HTMLButtonElement>,
    selected: { status: Status | "DELETE"; question: string },
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
      <button
        type="button"
        className="button danger"
        onClick={(event) =>
          confirm(event, { status: "DELETE", question: "Видалити оголошення?" })
        }
      >
        Видалити оголошення
      </button>
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
          {action?.status === "DELETE"
            ? "Профіль тварини залишиться. Буде видалено лише це оголошення."
            : "Оголошення більше не відображатиметься в активному каталозі. Тварина та історія оголошення збережуться."}
        </p>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {managementError(
              mutation.error,
              action?.status === "DELETE"
                ? "Не вдалося видалити оголошення."
                : "Не вдалося змінити статус оголошення.",
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
            className={`button ${action?.status === "DELETE" ? "danger" : "primary"}`}
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
            {mutation.isPending
              ? "Змінюємо…"
              : action?.status === "DELETE"
                ? "Видалити оголошення"
                : "Підтвердити"}
          </button>
        </div>
      </dialog>
    </>
  );
}
