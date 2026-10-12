"use client";
import { FormSelect } from "@/shared/ui/form-select";
import { usePetPreselection } from "../model/use-pet-preselection";
import { listingPetPreselection } from "../model/pet-preselection";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Pet } from "@/entities/pet/model";
import type { Location } from "@/entities/location/model";
import { ApiError } from "@/shared/api/client";
import { getOwnPetChoices } from "@/entities/pet/api/get-own-pet-choices";
import { petOptionLabel } from "../model/presentation";
import { NewAnimalFields, type NewAnimalHandle } from "./new-animal-fields";
import { ListingImages, type ListingImagesHandle } from "./listing-images";
import {
  createListingFormSchema,
  draftListingFormSchema,
  type CreateListingFormInput,
} from "../model/schema";
import { createListingError } from "../model/presentation";
import { CreateListingFields } from "./create-listing-fields";
import { z } from "zod";
import {
  createAndMaybePublish,
  invalidateListings,
} from "../../manage-listing/api";
import { noImagesMessage } from "../../manage-listing/model";
import type { UnifiedListingInput } from "../api/create-listing";
import { useSession } from "@/features/auth/session-provider";
import {
  recoveredForm,
  useFormRecovery,
  forgetRecoveredForm,
} from "../../form-recovery";
export function CreateListingForm({
  pets,
  preselectedPetId,
}: { pets?: Pet[]; preselectedPetId?: string } = {}) {
  const requestedPetId = listingPetPreselection(preselectedPetId);
  const session = useSession();
  const recoveryKey = session.data ? `${session.data.id}:create` : undefined;
  const [recovered] = useState(() =>
    recoveredForm<{
      input: CreateListingFormInput;
      location: Location | null;
      mode: "new" | "existing";
    }>(recoveryKey),
  );
  const [mode, setMode] = useState<"new" | "existing">(
    requestedPetId ? "existing" : (recovered?.mode ?? "new"),
  );
  const [uploading, setUploading] = useState(false);
  const [publishError, setPublishError] = useState("");
  const action = useRef<"draft" | "publish">("draft");
  const animal = useRef<NewAnimalHandle>(null),
    images = useRef<ListingImagesHandle>(null);
  const client = useQueryClient();
  const ownPets = useQuery({
    queryKey: ["my-pets", "listing-create"],
    queryFn: ({ signal }) => getOwnPetChoices(signal),
    enabled: mode === "existing" && !pets,
  });
  const choices = pets ?? ownPets.data ?? [];
  const [location, setLocation] = useState<Location | null>(
    recovered?.location ?? null,
  );
  const form = useForm<CreateListingFormInput>({
    resolver: zodResolver(
      draftListingFormSchema.safeExtend({ petId: z.string() }),
    ),
    defaultValues: {
      ...(recovered?.input ?? {
        petId: "",
        locationId: "",
        type: "SALE",
        title: "",
        description: "",
        price: "",
      }),
      ...(requestedPetId ? { petId: requestedPetId } : {}),
    },
  });
  usePetPreselection(
    requestedPetId,
    choices,
    Boolean(pets) || ownPets.isSuccess,
    form,
  );
  const mutation = useMutation({
    mutationFn: async (value: UnifiedListingInput & { publish: boolean }) => {
      return createAndMaybePublish(value, value.publish);
    },
    retry: false,
    onSuccess: (result) => {
      if (recoveryKey) {
        forgetRecoveredForm(recoveryKey);
        forgetRecoveredForm(`${recoveryKey}:animal`);
      }
      void client.invalidateQueries({ queryKey: ["my-pets"] });
      void invalidateListings(client, result.id);
    },
  });
  useFormRecovery(mutation.data ? undefined : recoveryKey, form, {
    location,
    mode,
  });
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPublishError("");
    try {
      await form.handleSubmit(async (input) => {
        if (action.current === "publish") {
          const validation = createListingFormSchema
            .safeExtend({ petId: z.string() })
            .safeParse(input);
          if (!validation.success) {
            for (const issue of validation.error.issues)
              form.setError(issue.path[0] as keyof CreateListingFormInput, {
                message: issue.message,
              });
            return;
          }
        }
        if (
          mode === "existing" &&
          !choices.some((pet) => pet.id === input.petId)
        ) {
          form.setError("petId", { message: "Оберіть тварину зі списку" });
          return;
        }
        if (!location || location.id !== input.locationId) {
          form.setError("locationId", { message: "Оберіть місце зі списку" });
          return;
        }
        const pet =
          mode === "new" ? await animal.current?.validate() : undefined;
        const uploaded = images.current?.submission();
        if ((mode === "new" && !pet) || !uploaded) return;
        if (action.current === "publish" && !uploaded.imageIds.length) {
          setPublishError(noImagesMessage);
          return;
        }
        try {
          await mutation.mutateAsync({
            input,
            pet: pet ?? undefined,
            ...uploaded,
            publish: action.current === "publish",
          });
        } catch (error) {
          if (error instanceof ApiError)
            for (const detail of error.details)
              if (
                [
                  "petId",
                  "locationId",
                  "type",
                  "title",
                  "description",
                  "price",
                ].includes(detail.field)
              )
                form.setError(detail.field as keyof CreateListingFormInput, {
                  message: detail.message,
                });
        }
      })(event);
    } finally {
      locked.current = false;
    }
  }
  if (mutation.data)
    return (
      <section className="catalog-state" role="status">
        <h1>Оголошення створено</h1>
        <p>
          {mutation.data.publishFailed
            ? "Чернетку створено, але надіслати на модерацію не вдалося."
            : "moderationStatus" in mutation.data &&
                mutation.data.moderationStatus === "PENDING"
              ? "Оголошення надіслано на модерацію. Воно перевіряється перед публікацією."
              : mutation.data.status === "DRAFT"
                ? "Воно збережене як чернетка."
                : mutation.data.status === "ACTIVE"
                  ? "Оголошення опубліковано."
                  : "Оголошення надіслано на модерацію."}
        </p>
        <Link
          href={`/listings/${mutation.data.id}/edit`}
          className="button primary"
        >
          Відкрити оголошення
        </Link>
        <Link href="/my-listings" className="button secondary">
          Мої оголошення
        </Link>
      </section>
    );
  const pending = mutation.isPending || form.formState.isSubmitting;
  return (
    <section className="pet-form-card listing-create-card">
      <p className="eyebrow">Наступний крок до нової родини</p>
      <h1>Створити оголошення</h1>
      <p className="form-hint">
        Заповніть інформацію про тварину та умови передачі.
      </p>
      {recovered && (
        <p role="status" className="form-hint">
          Відновлено незбережений текст у цій вкладці. Додайте фотографії знову
          перед збереженням.
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending}>
          <ListingImages ref={images} onBusy={setUploading} />
          <fieldset className="listing-type-options">
            <legend>Про яку тварину оголошення?</legend>
            <div>
              <label>
                <input
                  type="radio"
                  name="animalMode"
                  checked={mode === "new"}
                  onChange={() => {
                    setMode("new");
                    form.clearErrors("petId");
                  }}
                />
                Нова тварина
              </label>
              <label>
                <input
                  type="radio"
                  name="animalMode"
                  checked={mode === "existing"}
                  onChange={() => setMode("existing")}
                />
                Вибрати з моїх тварин
              </label>
            </div>
          </fieldset>
          <div hidden={mode !== "new"}>
            <NewAnimalFields
              ref={animal}
              recoveryKey={recoveryKey ? `${recoveryKey}:animal` : undefined}
            />
          </div>
          {mode === "existing" && (
            <div className="field">
              {ownPets.isError && !pets ? (
                <div role="alert">
                  Не вдалося завантажити тварин.{" "}
                  <button type="button" onClick={() => void ownPets.refetch()}>
                    Спробувати ще раз
                  </button>
                </div>
              ) : ownPets.isPending && !pets ? (
                <p role="status">Завантажуємо тварин…</p>
              ) : choices.length ? (
                <>
                  <label htmlFor="petId">Тварина</label>
                  <FormSelect
                    form={form}
                    name="petId"
                    label="Тварина"
                    options={[
                      { value: "", label: "Оберіть тварину" },
                      ...choices.map((pet) => ({
                        value: pet.id,
                        label: petOptionLabel(pet),
                      })),
                    ]}
                  />
                </>
              ) : (
                <p>
                  У вас ще немає доданих тварин. Оберіть «Нова тварина» та
                  введіть відомості тут.
                </p>
              )}
              {form.formState.errors.petId && (
                <p id="petId-error" className="field-error">
                  {form.formState.errors.petId.message}
                </p>
              )}
            </div>
          )}
          <CreateListingFields
            form={form}
            location={location}
            onLocation={setLocation}
          />
          <p className="listing-draft-note">
            Збережіть чернетку або надішліть на модерацію оголошення, додавши
            щонайменше одну фотографію.
          </p>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {createListingError(mutation.error)}
            </p>
          )}
          {publishError && (
            <p role="alert" className="field-error">
              {publishError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="button secondary"
              disabled={uploading}
              onClick={() => {
                action.current = "draft";
              }}
            >
              {pending ? "Створення…" : "Зберегти чернетку"}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={uploading}
              onClick={() => {
                action.current = "publish";
              }}
            >
              Надіслати на модерацію
            </button>
            <Link href="/listings" className="button secondary">
              Скасувати
            </Link>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
