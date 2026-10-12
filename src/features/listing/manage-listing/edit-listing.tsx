"use client";
import { PublicationState } from "@/shared/ui/publication-state";
import { canSubmitPublication } from "@/shared/lib/moderation";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { ApiError } from "@/shared/api/client";
import type { Location } from "@/entities/location/model";
import { listingHeading } from "@/entities/listing/model/presentation";
import { CreateListingFields } from "../create-listing/ui/create-listing-fields";
import {
  ListingImages,
  type ListingImagesHandle,
} from "../create-listing/ui/listing-images";
import {
  createListingFormSchema,
  draftListingFormSchema,
  type CreateListingFormInput,
} from "../create-listing/model/schema";
import {
  submitListing,
  updateListing,
  getOwnedListing,
  invalidateListings,
  managementError,
} from "./api";
import { editable, noImagesMessage, type OwnListing } from "./model";
import { ListingActions } from "./listing-actions";
import { ListingManagementSkeleton } from "./listing-management-skeleton";
import {
  recoveredForm,
  useFormRecovery,
  forgetRecoveredForm,
} from "../form-recovery";
function Editor({
  listing,
  setMessage,
}: {
  listing: OwnListing;
  setMessage: (message: string) => void;
}) {
  const recoveryKey = `${listing.seller.id}:edit:${listing.id}`;
  const [recovered] = useState(() =>
    recoveredForm<{ input: CreateListingFormInput; location: Location | null }>(
      recoveryKey,
    ),
  );
  const [location, setLocation] = useState<Location | null>({
    ...(recovered?.location ?? listing.location),
    district: null,
    community: null,
    settlementType: null,
    katottgCode: null,
  });
  const [uploading, setUploading] = useState(false);
  const images = useRef<ListingImagesHandle>(null),
    locked = useRef(false);
  const client = useQueryClient();
  const form = useForm<CreateListingFormInput>({
    resolver: zodResolver(
      listing.status === "DRAFT"
        ? draftListingFormSchema
        : createListingFormSchema,
    ),
    defaultValues: recovered
      ? {
          ...recovered.input,
          ...(listing.status !== "DRAFT" ? { type: listing.type } : {}),
        }
      : {
          petId: listing.pet.id,
          locationId: listing.location.id,
          type: listing.type,
          title: listing.title,
          description: listing.description,
          price: listing.price ?? "",
        },
  });
  useFormRecovery(
    editable(listing.status, listing.moderationStatus)
      ? recoveryKey
      : undefined,
    form,
    {
      location,
    },
  );
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({
      input,
      publish,
    }: {
      input: CreateListingFormInput;
      publish: boolean;
    }) => {
      const photos = images.current?.submission();
      if (!photos) throw new Error("Дочекайтеся завантаження фотографій.");
      if (publish && !photos.images.length) throw new Error(noImagesMessage);
      const { type, price } = input;
      const fields = {
        locationId: input.locationId,
        title: input.title,
        description: input.description,
      };
      const saved = await updateListing(listing.id, {
        ...fields,
        ...(listing.status === "DRAFT" ? { type } : {}),
        price: type === "SALE" && price ? price : null,
        images: photos.images,
        ...(photos.uploadSessionId
          ? { uploadSessionId: photos.uploadSessionId }
          : {}),
      });
      forgetRecoveredForm(recoveryKey);
      if (publish) {
        try {
          const result = await submitListing(listing.id);
          client.setQueryData(
            ["owned-listing", listing.id, listing.seller.id],
            result,
          );
          setMessage(
            result.status === "ACTIVE"
              ? "Оголошення надіслано на модерацію."
              : "Оголошення надіслано на модерацію.",
          );
        } catch (error) {
          setMessage(
            "Чернетку збережено, але надіслати на модерацію не вдалося. " +
              managementError(
                error,
                "Спробуйте надіслати її на модерацію ще раз.",
              ),
          );
          client.setQueryData(
            ["owned-listing", listing.id, listing.seller.id],
            saved,
          );
          throw error;
        }
      } else {
        setMessage("Зміни збережено.");
        client.setQueryData(
          ["owned-listing", listing.id, listing.seller.id],
          saved,
        );
      }
      return saved;
    },
    onSettled: () => invalidateListings(client, listing.id),
  });
  async function submit(publish: boolean) {
    if (locked.current || uploading) return;
    locked.current = true;
    setMessage("");
    try {
      await form.handleSubmit(async (input) => {
        if (publish) {
          const validation = createListingFormSchema.safeParse(input);
          if (!validation.success) {
            for (const issue of validation.error.issues)
              form.setError(issue.path[0] as keyof CreateListingFormInput, {
                message: issue.message,
              });
            return;
          }
        }
        if (!location || location.id !== input.locationId) {
          form.setError("locationId", { message: "Оберіть місце зі списку" });
          return;
        }
        try {
          await mutation.mutateAsync({ input, publish });
        } catch (error) {
          if (error instanceof ApiError)
            for (const detail of error.details)
              if (
                [
                  "title",
                  "description",
                  "locationId",
                  "price",
                  "type",
                ].includes(detail.field)
              )
                form.setError(detail.field as keyof CreateListingFormInput, {
                  message: detail.message,
                });
        }
      })();
    } finally {
      locked.current = false;
    }
  }
  if (!editable(listing.status, listing.moderationStatus))
    return (
      <section className="pet-form-card">
        <h1>{listingHeading(listing.pet)}</h1>
        <PublicationState row={listing} />
        <p>Завершені та архівні оголошення не можна редагувати.</p>
        <p>{listing.title}</p>
        <p className="listing-description">{listing.description}</p>
        <ListingActions listing={listing} redirectAfterDelete />
        <Link className="button secondary" href="/my-listings">
          Мої оголошення
        </Link>
      </section>
    );
  return (
    <section className="pet-form-card listing-create-card">
      <h1>Редагувати оголошення</h1>
      {recovered && (
        <p role="status" className="form-hint">
          Відновлено незбережений текст у цій вкладці. Перевірте фотографії та
          додайте нові знову.
        </p>
      )}
      <PublicationState row={listing} />
      <p>
        {listingHeading(listing.pet)}
        {listing.pet.name?.trim() ? ` · ${listing.pet.name}` : ""}
      </p>
      <p className="form-hint">
        Дані тварини редагуються окремо в її профілі.{" "}
        {listing.status === "ACTIVE" &&
          "Тип активного оголошення змінити не можна."}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit(false);
        }}
        aria-busy={mutation.isPending}
      >
        <fieldset disabled={mutation.isPending || form.formState.isSubmitting}>
          <ListingImages
            ref={images}
            onBusy={setUploading}
            initialImages={listing.images}
            active={listing.status === "ACTIVE"}
          />
          <p className="form-hint">
            Порядок і видалення фотографій застосовуються після збереження змін.
          </p>
          <CreateListingFields
            form={form}
            location={location}
            onLocation={setLocation}
            lockType={listing.status !== "DRAFT"}
          />
          {mutation.isError && (
            <p className="field-error" role="alert">
              {mutation.error instanceof Error &&
              mutation.error.message === noImagesMessage
                ? noImagesMessage
                : managementError(
                    mutation.error,
                    "Не вдалося зберегти або надіслати оголошення на модерацію.",
                  )}
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="button secondary"
              disabled={uploading}
            >
              Зберегти зміни
            </button>
            {canSubmitPublication(listing) && (
              <button
                type="button"
                className="button primary"
                disabled={uploading}
                onClick={() => void submit(true)}
              >
                Надіслати на модерацію
              </button>
            )}
            <Link className="button secondary" href="/my-listings">
              Мої оголошення
            </Link>
          </div>
        </fieldset>
      </form>
      <div className="form-actions">
        <ListingActions listing={listing} redirectAfterDelete />
      </div>
    </section>
  );
}
function LoadEditor({ id }: { id: string }) {
  const session = useSession();
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["owned-listing", id, session.data!.id],
    queryFn: ({ signal }) => getOwnedListing(id, session.data!.id, signal),
  });
  if (query.isPending) return <ListingManagementSkeleton editor />;
  if (query.isError)
    return (
      <section className="catalog-state">
        <h1>
          {query.error instanceof ApiError && query.error.status === 404
            ? "Оголошення не знайдено"
            : "Не вдалося завантажити оголошення."}
        </h1>
        {!(query.error instanceof ApiError && query.error.status === 404) && (
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        )}
        <Link href="/my-listings" className="button secondary">
          Мої оголошення
        </Link>
      </section>
    );
  // Successful persistence changes updatedAt and remounts staging state with server image IDs.
  return (
    <>
      {message && <p role="status">{message}</p>}
      <Editor
        key={`${query.data.id}:${query.data.updatedAt}`}
        listing={query.data}
        setMessage={setMessage}
      />
    </>
  );
}
export function EditListingPage({ id }: { id: string }) {
  return (
    <RequireSession>
      <LoadEditor id={id} />
    </RequireSession>
  );
}
