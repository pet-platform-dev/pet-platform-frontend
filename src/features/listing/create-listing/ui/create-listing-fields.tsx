"use client";
import { useWatch, type UseFormReturn } from "react-hook-form";
import type { Location } from "@/entities/location/model";
import { listingTypeLabels } from "@/entities/listing/model/presentation";
import type { CreateListingFormInput } from "../model/schema";
import { LocationSelector } from "@/entities/location/location-selector";
export function CreateListingFields({
  form,
  location,
  onLocation,
  lockType = false,
}: {
  form: UseFormReturn<CreateListingFormInput>;
  location: Location | null;
  onLocation: (location: Location | null) => void;
  lockType?: boolean;
}) {
  const type = useWatch({ control: form.control, name: "type" });
  const error = (field: keyof CreateListingFormInput) =>
    form.formState.errors[field]?.message;
  const attrs = (field: keyof CreateListingFormInput) => ({
    "aria-invalid": Boolean(error(field)),
    "aria-describedby": error(field) ? `${field}-error` : undefined,
  });
  const message = (field: keyof CreateListingFormInput) =>
    error(field) ? (
      <p className="field-error" id={`${field}-error`}>
        {error(field)}
      </p>
    ) : null;
  const typeField = form.register("type");
  return (
    <>
      <h2>Оголошення</h2>
      <fieldset
        className="listing-type-options"
        disabled={lockType}
        aria-describedby={error("type") ? "type-error" : undefined}
      >
        <legend>Тип оголошення</legend>
        <div>
          {Object.entries(listingTypeLabels).map(([value, label]) => (
            <label key={value}>
              <input
                {...typeField}
                type="radio"
                value={value}
                onChange={(event) => {
                  void typeField.onChange(event);
                  if (event.target.value !== "SALE") {
                    form.setValue("price", "", { shouldDirty: true });
                    form.clearErrors("price");
                  }
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {message("type")}
      </fieldset>
      <LocationSelector
        selected={location}
        error={error("locationId")}
        onSelect={(value) => {
          onLocation(value);
          form.setValue("locationId", value?.id ?? "", {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      />
      <div className="field">
        <label htmlFor="title">Заголовок</label>
        <input
          id="title"
          {...form.register("title")}
          {...attrs("title")}
          maxLength={160}
          placeholder="Цуценя бельгійської вівчарки малінуа"
        />
        {message("title")}
      </div>
      <div className="field">
        <label htmlFor="description">Опис</label>
        <textarea
          id="description"
          {...form.register("description")}
          {...attrs("description")}
          aria-describedby={
            error("description")
              ? "description-help description-error"
              : "description-help"
          }
          maxLength={5000}
          rows={6}
        />
        <p className="form-hint" id="description-help">
          Розкажіть про тварину, її характер, умови передачі та іншу важливу
          інформацію.
        </p>
        {message("description")}
      </div>
      {type === "SALE" && (
        <div className="field">
          <label htmlFor="price">Ціна, ₴</label>
          <input
            id="price"
            {...form.register("price")}
            {...attrs("price")}
            aria-describedby={
              error("price") ? "price-help price-error" : "price-help"
            }
            inputMode="decimal"
            placeholder="25000.00"
          />
          <p className="form-hint" id="price-help">
            У гривнях. Для копійок використовуйте крапку, наприклад 25000.50.
          </p>
          {message("price")}
        </div>
      )}
    </>
  );
}
