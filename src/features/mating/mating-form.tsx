"use client";
import { useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LocationSelector } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import type { Pet } from "@/entities/pet/model";
import type { OwnMating } from "@/entities/mating-listing/model";
import {
  MatingPetSelection,
  MatingPetSummary,
  PetEligibility,
} from "./pet-selection";
import { FeeChoice } from "./fee-choice";
import {
  feeMode,
  matingFormSchema,
  petEligible,
  type MatingFormInput,
} from "./model";
export function MatingForm({
  listing,
  pets = [],
  active,
  onSubmit,
  error = "",
  pending = false,
  publishBlocked = false,
  initialPetId,
}: {
  listing?: OwnMating;
  pets?: Pet[];
  active: OwnMating[];
  onSubmit: (input: MatingFormInput, publish: boolean) => Promise<void>;
  error?: string;
  pending?: boolean;
  publishBlocked?: boolean;
  initialPetId?: string;
}) {
  const [location, setLocation] = useState<Location | null>(
      listing?.location ?? null,
    ),
    lock = useRef(false);
  const form = useForm<MatingFormInput>({
    resolver: zodResolver(matingFormSchema),
    defaultValues: {
      petId:
        listing?.pet.id ??
        (pets.some((pet) => pet.id === initialPetId) ? initialPetId : "") ??
        "",
      description: listing?.description ?? "",
      locationId: listing?.location.id ?? "",
      feeMode: feeMode(listing?.fee ?? null),
      feeText: listing?.fee ?? "",
    },
  });
  const [petId, description, selectedFeeMode, feeText] = useWatch({
    control: form.control,
    name: ["petId", "description", "feeMode", "feeText"],
  });
  const input = { petId, description, feeMode: selectedFeeMode, feeText },
    pet = listing?.pet ?? pets.find((pet) => pet.id === input.petId);
  const competing = active.find(
    (row) => row.pet.id === pet?.id && row.id !== listing?.id,
  );
  const blocked = !pet || !petEligible(pet);
  async function submit(publish: boolean) {
    if (
      lock.current ||
      pending ||
      blocked ||
      (publish && (competing || publishBlocked))
    )
      return;
    lock.current = true;
    try {
      await form.handleSubmit((value) => onSubmit(value, publish))();
    } finally {
      lock.current = false;
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
      className="mating-form"
      noValidate
    >
      <fieldset disabled={pending} className="mating-form-body">
        {listing ? (
          <section className="mating-panel">
            <h2>Тварина в оголошенні</h2>
            <MatingPetSummary pet={listing.pet} />
            <p className="form-hint">
              Тварину в цьому оголошенні змінити не можна.
            </p>
            <PetEligibility pet={listing.pet} active={competing} />
          </section>
        ) : (
          <MatingPetSelection
            pets={pets}
            petId={input.petId}
            onSelect={(id) =>
              form.setValue("petId", id, { shouldValidate: true })
            }
            active={active}
            error={form.formState.errors.petId?.message}
          />
        )}
        <section className="mating-panel">
          <h2>Умови в’язки</h2>
          <div className="field">
            <label htmlFor="mating-description">Опис</label>
            <textarea
              id="mating-description"
              rows={6}
              defaultValue={listing?.description ?? ""}
              maxLength={5000}
              {...form.register("description")}
              aria-invalid={Boolean(form.formState.errors.description)}
              aria-describedby="mating-description-help mating-description-error"
              placeholder="Наприклад: характер, досвід, бажані умови та інша важлива інформація."
            />
            <div className="mating-description-meta">
              <p id="mating-description-help" className="form-hint">
                Розкажіть про тварину та умови в’язки.
              </p>
              <span className="muted">{input.description.length}/5000</span>
            </div>
            <p id="mating-description-error" className="field-error">
              {form.formState.errors.description?.message}
            </p>
          </div>
          <LocationSelector
            label="Місце в’язки"
            selected={location}
            onSelect={(value) => {
              setLocation(value);
              form.setValue("locationId", value?.id ?? "", {
                shouldValidate: true,
              });
            }}
            error={form.formState.errors.locationId?.message}
          />
          <p className="form-hint">
            Оберіть населений пункт, де вам зручно домовитися про зустріч.
          </p>
          <FeeChoice
            mode={input.feeMode}
            value={input.feeText}
            onMode={(mode) =>
              form.setValue("feeMode", mode, { shouldValidate: true })
            }
            onValue={(value) =>
              form.setValue("feeText", value, { shouldValidate: true })
            }
            error={form.formState.errors.feeText?.message}
          />
        </section>
      </fieldset>
      <section className="mating-panel mating-submit">
        <p className="form-hint">
          Переконайтеся, що вік і стан здоров’я тварини підходять для в’язки. За
          потреби проконсультуйтеся з ветеринаром.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        {listing?.status === "DRAFT" && (
          <p className="muted">
            Після публікації оголошення стане видимим у розділі в’язки. Поточні
            зміни буде збережено.
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" disabled={pending || blocked}>
            {pending
              ? "Зберігаємо…"
              : listing
                ? "Зберегти зміни"
                : "Зберегти чернетку"}
          </button>
          {listing?.status === "DRAFT" && (
            <button
              className="button secondary"
              type="button"
              disabled={
                pending || blocked || Boolean(competing) || publishBlocked
              }
              onClick={() => void submit(true)}
            >
              Опублікувати
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
