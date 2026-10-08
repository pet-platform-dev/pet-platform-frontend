"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { Pet } from "@/entities/pet/model";
import type { Location } from "@/entities/location/model";
import { ApiError } from "@/shared/api/client";
import { createListing } from "../api/create-listing";
import {
  createListingFormSchema,
  type CreateListingFormInput,
} from "../model/schema";
import { createListingError } from "../model/presentation";
import { CreateListingFields } from "./create-listing-fields";
export function CreateListingForm({ pets }: { pets: Pet[] }) {
  const [location, setLocation] = useState<Location | null>(null);
  const form = useForm<CreateListingFormInput>({
    resolver: zodResolver(createListingFormSchema),
    defaultValues: {
      petId: "",
      locationId: "",
      type: "SALE",
      title: "",
      description: "",
      price: "",
    },
  });
  const mutation = useMutation({ mutationFn: createListing, retry: false });
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    try {
      await form.handleSubmit(async (input) => {
        if (!pets.some((pet) => pet.id === input.petId)) {
          form.setError("petId", { message: "Оберіть тварину зі списку" });
          return;
        }
        if (!location || location.id !== input.locationId) {
          form.setError("locationId", { message: "Оберіть місце зі списку" });
          return;
        }
        try {
          await mutation.mutateAsync(input);
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
          <CreateListingFields
            form={form}
            pets={pets}
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
            <button type="submit" className="button primary">
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
