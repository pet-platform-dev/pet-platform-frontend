"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Pet } from "@/entities/pet/model";
import type { Location } from "@/entities/location/model";
import { ApiError } from "@/shared/api/client";
import { createUnifiedListing } from "../api/create-listing";
import { getOwnPetChoices } from "@/entities/pet/api/get-own-pet-choices";
import { petOptionLabel } from "../model/presentation";
import { NewAnimalFields, type NewAnimalHandle } from "./new-animal-fields";
import { ListingImages, type ListingImagesHandle } from "./listing-images";
import {
  createListingFormSchema,
  type CreateListingFormInput,
} from "../model/schema";
import { createListingError } from "../model/presentation";
import { CreateListingFields } from "./create-listing-fields";
import { z } from "zod";
export function CreateListingForm({ pets }: { pets?: Pet[] } = {}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [uploading, setUploading] = useState(false);
  const animal = useRef<NewAnimalHandle>(null),
    images = useRef<ListingImagesHandle>(null);
  const client = useQueryClient();
  const ownPets = useQuery({
    queryKey: ["my-pets", "listing-create"],
    queryFn: getOwnPetChoices,
    enabled: mode === "existing" && !pets,
  });
  const choices = pets ?? ownPets.data ?? [];
  const [location, setLocation] = useState<Location | null>(null);
  const form = useForm<CreateListingFormInput>({
    resolver: zodResolver(
      createListingFormSchema.safeExtend({ petId: z.string() }),
    ),
    defaultValues: {
      petId: "",
      locationId: "",
      type: "SALE",
      title: "",
      description: "",
      price: "",
    },
  });
  const mutation = useMutation({
    mutationFn: createUnifiedListing,
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["my-pets"] });
      void client.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    try {
      await form.handleSubmit(async (input) => {
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
        try {
          await mutation.mutateAsync({
            input,
            pet: pet ?? undefined,
            ...uploaded,
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
        <p>Воно збережене як чернетка.</p>
        <Link href="/listings" className="button primary">
          Повернутися до оголошень
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
            <NewAnimalFields ref={animal} />
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
                  <select
                    id="petId"
                    {...form.register("petId")}
                    aria-invalid={Boolean(form.formState.errors.petId)}
                    aria-describedby={
                      form.formState.errors.petId ? "petId-error" : undefined
                    }
                  >
                    <option value="">Оберіть тварину</option>
                    {choices.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {petOptionLabel(pet)}
                      </option>
                    ))}
                  </select>
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
            Оголошення буде створене як чернетка.
          </p>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {createListingError(mutation.error)}
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="button primary"
              disabled={uploading}
            >
              {pending ? "Створення…" : "Створити чернетку"}
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
