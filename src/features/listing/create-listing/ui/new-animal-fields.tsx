"use client";
import { FormSelect } from "@/shared/ui/form-select";
import { useImperativeHandle, useState, type Ref } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { petFormSchema, todayKyiv } from "@/features/pet/validation";
import { getSpecies } from "@/features/pet/api";
import { speciesLabel } from "@/entities/species/model";
import { BreedSelector, type BreedChoice } from "@/features/pet/breed-selector";
import { recoveredForm, useFormRecovery } from "../../form-recovery";
export type NewAnimalHandle = {
  validate: () => Promise<z.output<typeof petFormSchema> | null>;
};
type Input = z.input<typeof petFormSchema>;
export function NewAnimalFields({
  ref,
  recoveryKey,
}: {
  ref: Ref<NewAnimalHandle>;
  recoveryKey?: string;
}) {
  const [recovered] = useState(() =>
    recoveredForm<{ input: Input; breed: BreedChoice | null }>(recoveryKey),
  );
  const form = useForm<Input, undefined, z.output<typeof petFormSchema>>({
    resolver: zodResolver(petFormSchema),
    defaultValues: recovered?.input ?? {
      name: "",
      speciesId: "",
      breedId: "",
      gender: "UNKNOWN",
      birthDate: "",
      color: "",
      description: "",
      chipNumber: "",
      hasPassport: false,
      hasPedigree: false,
      vaccinated: false,
    },
  });
  const species = useQuery({ queryKey: ["species"], queryFn: getSpecies }),
    speciesId = useWatch({ control: form.control, name: "speciesId" });
  const [breed, setBreed] = useState<BreedChoice | null>(
      recovered?.breed ?? null,
    ),
    [searching, setSearching] = useState(false);
  useFormRecovery(recoveryKey, form, { breed });
  useImperativeHandle(
    ref,
    () => ({
      validate: async () => {
        if (searching && !breed) {
          form.setError("breedId", {
            message: "Оберіть породу зі списку або очистіть пошук",
          });
          return null;
        }
        if (!(await form.trigger())) return null;
        return petFormSchema.parse(form.getValues());
      },
    }),
    [form, searching, breed],
  );
  const error = (field: keyof Input) => form.formState.errors[field]?.message;
  const attrs = (field: keyof Input) => ({
    "aria-invalid": Boolean(error(field)),
    "aria-describedby": error(field) ? `animal-${field}-error` : undefined,
  });
  const message = (field: keyof Input) =>
    error(field) ? (
      <p id={`animal-${field}-error`} className="field-error">
        {error(field)}
      </p>
    ) : null;
  return (
    <div className="new-animal-fields">
      <div className="field">
        <label htmlFor="animal-species">Вид тварини</label>
        {species.isError ? (
          <div role="alert">
            Не вдалося завантажити види.{" "}
            <button type="button" onClick={() => void species.refetch()}>
              Спробувати ще раз
            </button>
          </div>
        ) : (
          <FormSelect
            form={form}
            name="speciesId"
            id="animal-species"
            label="Вид тварини"
            disabled={species.isPending}
            options={[
              {
                value: "",
                label: species.isPending
                  ? "Завантажуємо види…"
                  : "Оберіть вид тварини",
              },
              ...(species.data ?? []).map((item) => ({
                value: item.id,
                label: speciesLabel(item.slug),
              })),
            ]}
            onChange={() => {
              form.setValue("breedId", "");
              setBreed(null);
              setSearching(false);
              form.clearErrors("breedId");
            }}
          />
        )}
        {message("speciesId")}
      </div>
      <BreedSelector
        species={species.data?.find((item) => item.id === speciesId)?.slug}
        selected={breed}
        onSearching={setSearching}
        error={error("breedId")}
        onSelect={(item) => {
          setBreed(item);
          form.setValue("breedId", item?.id ?? "", { shouldValidate: true });
        }}
      />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="animal-gender">Стать</label>
          <FormSelect
            form={form}
            name="gender"
            id="animal-gender"
            label="Стать"
            options={[
              { value: "UNKNOWN", label: "Не вказано" },
              { value: "MALE", label: "Самець" },
              { value: "FEMALE", label: "Самка" },
            ]}
          />
          {message("gender")}
        </div>
        <div className="field">
          <label htmlFor="animal-birthDate">
            Дата народження (необов’язково)
          </label>
          <input
            id="animal-birthDate"
            type="date"
            max={todayKyiv()}
            {...form.register("birthDate")}
            {...attrs("birthDate")}
          />
          {message("birthDate")}
        </div>
        <div className="field">
          <label htmlFor="animal-color">Колір (необов’язково)</label>
          <input
            id="animal-color"
            maxLength={150}
            {...form.register("color")}
            {...attrs("color")}
          />
          {message("color")}
        </div>
        <div className="field">
          <label htmlFor="animal-name">Ім’я (необов’язково)</label>
          <input
            id="animal-name"
            maxLength={150}
            {...form.register("name")}
            {...attrs("name")}
          />
          {message("name")}
        </div>
      </div>
      <div className="pet-checks">
        {(
          [
            ["hasPassport", "Ветеринарний паспорт"],
            ["hasPedigree", "Родовід"],
            ["vaccinated", "Вакцинований"],
          ] as const
        ).map(([name, label]) => (
          <label key={name}>
            <input type="checkbox" {...form.register(name)} />
            {label}
          </label>
        ))}
      </div>
      <p className="form-hint">
        Це відомості власника, які платформа не перевіряла.
      </p>
    </div>
  );
}
