"use client";
import { invalidateBreederAnimals } from "@/features/breeder/animals/cache";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { FormSelect } from "@/shared/ui/form-select";
import { PetPhotoField } from "./pet-photo-field";
import { PetMediaEditor } from "./media/pet-media-editor";
import { savePetPhoto } from "./profile-image-api";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { Pet } from "@/entities/pet/model";
import { speciesLabel } from "@/entities/species/model";
import { ApiError } from "@/shared/api/client";
import { getPet, getSpecies, savePet } from "./api";
import { BreedSelector, type BreedChoice } from "./breed-selector";
import { petFormSchema, todayKyiv } from "./validation";

type FormInput = z.input<typeof petFormSchema>;
function PetForm({ pet }: { pet?: Pet }) {
  const router = useRouter();
  const client = useQueryClient();
  const savedId = useRef(pet?.id);
  const [created, setCreated] = useState(false);
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [selected, setSelected] = useState<BreedChoice | null>(
    pet?.breed ?? null,
  );
  const [searching, setSearching] = useState(false);
  const form = useForm<FormInput, undefined, z.output<typeof petFormSchema>>({
    resolver: zodResolver(petFormSchema),
    defaultValues: {
      name: pet?.name ?? "",
      speciesId: pet?.species.id ?? "",
      breedId: pet?.breed?.id ?? "",
      gender: pet?.gender ?? "UNKNOWN",
      birthDate: pet?.birthDate ?? "",
      color: pet?.color ?? "",
      description: pet?.description ?? "",
      specialTraits: pet?.specialTraits ?? "",
      chipNumber: pet?.chipNumber ?? "",
      hasPassport: pet?.hasPassport ?? false,
      hasPedigree: pet?.hasPedigree ?? false,
      vaccinated: pet?.vaccinated ?? false,
    },
  });
  const speciesId = useWatch({ control: form.control, name: "speciesId" });
  const species = useQuery({ queryKey: ["species"], queryFn: getSpecies });
  const selectedSpecies = species.data?.find(
    (value) => value.id === speciesId,
  )?.slug;
  const mutation = useMutation({
    mutationFn: async (input: z.output<typeof petFormSchema>) => {
      const saved = await savePet(input, savedId.current);
      savedId.current = saved.id;
      setCreated(true);
      if (photo !== undefined) await savePetPhoto(saved.id, photo);
      return getPet(saved.id);
    },
    onSuccess: async (saved) => {
      client.setQueryData(["pet", saved.id], saved);
      await client.invalidateQueries({ queryKey: ["my-pets"] });
      await invalidateBreederAnimals(client);
      router.push("/pets");
    },
    onError: (error) => {
      if (error instanceof ApiError)
        for (const detail of error.details)
          if (detail.field in form.getValues())
            form.setError(detail.field as keyof FormInput, {
              message: detail.message,
            });
    },
  });
  const submit = form.handleSubmit((input) => {
    if (searching && !selected) {
      form.setError("breedId", {
        message: "Оберіть породу зі списку або очистіть пошук",
      });
      return;
    }
    mutation.mutate(input);
  });
  const error = (name: keyof FormInput) => form.formState.errors[name]?.message;
  const fieldError = (name: keyof FormInput) =>
    error(name) ? (
      <p id={`${name}-error`} className="field-error">
        {error(name)}
      </p>
    ) : null;
  const attrs = (name: keyof FormInput) => ({
    "aria-invalid": Boolean(error(name)),
    "aria-describedby": error(name) ? `${name}-error` : undefined,
  });
  return (
    <section className="pet-form-card">
      <Link className="text-link" href="/pets">
        ← Мої тварини
      </Link>
      <p className="eyebrow">Профіль улюбленця</p>
      <h1>{pet ? "Редагувати тварину" : "Додати тварину"}</h1>
      <p className="muted">
        Публічну видимість тварини в профілі розплідника ви обираєте окремо.
        Необов’язкові поля можна залишити порожніми.
      </p>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={mutation.isPending}>
          <PetPhotoField
            heading="Фото профілю"
            current={pet?.profileImage}
            value={photo}
            disabled={mutation.isPending}
            onChange={setPhoto}
          />
          <h2>Основна інформація</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Ім’я (необов’язково)</label>
              <input
                id="name"
                {...form.register("name")}
                maxLength={150}
                {...attrs("name")}
                aria-describedby={
                  error("name") ? "name-help name-error" : "name-help"
                }
              />
              <p id="name-help" className="muted">
                Можна залишити порожнім, якщо тварина ще не має імені.
              </p>
              {fieldError("name")}
            </div>
            <div className="field">
              <label htmlFor="speciesId">Вид тварини</label>
              {species.isPending ? (
                <p role="status">Завантажуємо види…</p>
              ) : species.isError ? (
                <div>
                  <p role="alert">Не вдалося завантажити види.</p>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => species.refetch()}
                  >
                    Спробувати ще раз
                  </button>
                </div>
              ) : (
                <FormSelect
                  form={form}
                  name="speciesId"
                  label="Вид тварини"
                  options={[
                    { value: "", label: "Оберіть вид тварини" },
                    ...(species.data ?? []).map((value) => ({
                      value: value.id,
                      label: speciesLabel(value.slug),
                    })),
                  ]}
                  onChange={() => {
                    form.setValue("breedId", "");
                    setSelected(null);
                    setSearching(false);
                    form.clearErrors("breedId");
                  }}
                />
              )}
              {fieldError("speciesId")}
            </div>
          </div>
          <BreedSelector
            key={speciesId}
            species={selectedSpecies}
            selected={selected}
            error={error("breedId")}
            onSearching={setSearching}
            onSelect={(breed) => {
              setSelected(breed);
              form.setValue("breedId", breed?.id ?? "", {
                shouldValidate: true,
              });
            }}
          />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="gender">Стать</label>
              <FormSelect
                form={form}
                name="gender"
                label="Стать"
                options={[
                  { value: "UNKNOWN", label: "Не вказано" },
                  { value: "MALE", label: "Самець" },
                  { value: "FEMALE", label: "Самка" },
                ]}
              />
              {fieldError("gender")}
            </div>
            <div className="field">
              <label htmlFor="birthDate">
                Дата народження <span className="optional">необов’язково</span>
              </label>
              <input
                id="birthDate"
                type="date"
                max={todayKyiv()}
                {...form.register("birthDate")}
                {...attrs("birthDate")}
              />
              {fieldError("birthDate")}
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="color">
                Колір <span className="optional">необов’язково</span>
              </label>
              <input
                id="color"
                maxLength={150}
                {...form.register("color")}
                {...attrs("color")}
              />
              {fieldError("color")}
            </div>
            <div className="field">
              <label htmlFor="chipNumber">
                Номер чіпа <span className="optional">необов’язково</span>
              </label>
              <input
                id="chipNumber"
                maxLength={50}
                {...form.register("chipNumber")}
                {...attrs("chipNumber")}
              />
              {fieldError("chipNumber")}
            </div>
          </div>
          <div className="field">
            <label htmlFor="description">
              Про тварину <span className="optional">необов’язково</span>
            </label>
            <textarea
              id="description"
              rows={4}
              maxLength={5000}
              {...form.register("description")}
              {...attrs("description")}
            />
            {fieldError("description")}
            <p className="muted">
              Розкажіть про характер, темперамент, виховання та інші важливі
              особливості.
            </p>
          </div>
          <div className="field">
            <label htmlFor="specialTraits">
              Чим особлива <span className="optional">необов’язково</span>
            </label>
            <textarea
              id="specialTraits"
              rows={4}
              maxLength={3000}
              {...form.register("specialTraits")}
              {...attrs("specialTraits")}
            />
            <p className="muted">
              Наприклад: робочі якості, спортивні досягнення, характерні риси
              або інші особливості.
            </p>
            {fieldError("specialTraits")}
          </div>
          <div className="pet-checks">
            {[
              ["hasPassport", "Ветеринарний паспорт"],
              ["hasPedigree", "Родовід"],
              ["vaccinated", "Вакцинований"],
            ].map(([name, label]) => (
              <label key={name}>
                <input
                  type="checkbox"
                  {...form.register(
                    name as "hasPassport" | "hasPedigree" | "vaccinated",
                  )}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="form-hint">
            Це відомості власника, які платформа не перевіряла.
          </p>
          {mutation.isError && (
            <p className="error-banner" role="alert">
              {created && !pet
                ? "Тварину збережено. Завершіть збереження фото або повторіть спробу. "
                : ""}
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : "Не вдалося зберегти профіль. Спробуйте ще раз."}
            </p>
          )}
          <div className="form-actions">
            <button
              className="button primary"
              type="submit"
              disabled={species.isPending || species.isError}
            >
              {mutation.isPending
                ? "Зберігаємо…"
                : pet
                  ? "Зберегти зміни"
                  : "Додати тварину"}
            </button>
            <Link href="/pets" className="button secondary">
              Скасувати
            </Link>
          </div>
        </fieldset>
      </form>
      {pet ? (
        <PetMediaEditor petId={pet.id} disabled={mutation.isPending} />
      ) : (
        <p className="muted">
          Після створення тварини можна додати фотогалерею та відео на сторінці
          редагування.
        </p>
      )}
    </section>
  );
}
export function PetFormPage({ id }: { id?: string }) {
  const query = useQuery({
    queryKey: ["pet", id],
    queryFn: () => getPet(id!),
    enabled: Boolean(id),
  });
  if (id && query.isPending)
    return (
      <div className="status-panel" role="status">
        Завантажуємо профіль…
      </div>
    );
  if (id && query.isError)
    return (
      <div className="status-panel">
        <p role="alert">
          {query.error instanceof ApiError
            ? query.error.message
            : "Не вдалося завантажити профіль."}
        </p>
        <Link href="/pets" className="button secondary">
          До моїх тварин
        </Link>
      </div>
    );
  return <PetForm key={id ?? "new"} pet={id ? query.data : undefined} />;
}
