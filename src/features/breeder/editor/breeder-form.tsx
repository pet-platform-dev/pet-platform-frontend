import { BreederMediaEditor } from "../media/breeder-media-editor";
import { BreederAnimalsEntry } from "./breeder-animals-entry";
import Link from "next/link";
import { useState, useRef } from "react";
import type { OwnBreeder } from "@/entities/breeder/owner-api";
import { useBreederFormState } from "./use-breeder-form-state";
import { forgetRecoveredForm } from "@/features/listing/form-recovery";
import { LocationSelector } from "@/entities/location/location-selector";
import { BreederBreedSelector } from "./breeder-breed-selector";
import { BreederTextFields } from "./breeder-text-fields";
import { BreederDelete } from "./breeder-delete";
import { useBreederSave } from "./use-breeder-save";
import { parseBreederValues } from "./validation";
export function BreederForm({
  userId,
  profile,
}: {
  userId: string;
  profile: OwnBreeder | null;
}) {
  const {
    values,
    setValue,
    location,
    setLocation,
    breeds,
    setBreeds,
    recoveryKey,
  } = useBreederFormState(userId, profile);
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [deleting, setDeleting] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false);
  const mutation = useBreederSave(userId, profile),
    submitted = useRef(false);
  return (
    <section className="breeder-editor-content">
      <form
        className="auth-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitted.current) return;
          const result = parseBreederValues(
            values,
            location?.id ?? null,
            breeds.map((b) => b.id),
          );
          if (!result.success) {
            setErrors(
              Object.fromEntries(
                result.error.issues.map((issue) => [
                  String(issue.path[0]),
                  issue.message,
                ]),
              ),
            );
            return;
          }
          setErrors({});
          submitted.current = true;
          try {
            await mutation.mutateAsync(result.data);
            forgetRecoveredForm(recoveryKey);
          } catch {
          } finally {
            submitted.current = false;
          }
        }}
      >
        <h1>
          {profile
            ? "Редагувати профіль заводчика"
            : "Налаштувати профіль заводчика"}
        </h1>
        <p className="muted">
          Інформація про розплідник буде показана у вашому публічному профілі.
        </p>
        <section
          className="breeder-basic-info breeder-media-section"
          aria-labelledby="breeder-basic-title"
        >
          <header className="breeder-section-heading">
            <h2 id="breeder-basic-title">Основна інформація</h2>
            <p className="muted">
              Після редагування натисніть «Зберегти зміни». Медіа зберігаються
              окремо й одразу.
            </p>
          </header>
          <BreederTextFields
            values={values}
            errors={errors}
            disabled={mutation.isPending || deleting || mediaBusy}
            onChange={(key, value) => {
              setValue(key, value);
              mutation.reset();
            }}
          />
          <fieldset
            disabled={mutation.isPending || deleting || mediaBusy}
            className="breeder-selectors"
          >
            <LocationSelector
              label="Місто або село"
              selected={location}
              onSelect={setLocation}
              error={errors.locationId}
            />
            <BreederBreedSelector
              selected={breeds}
              onChange={setBreeds}
              error={errors.breedIds}
            />
          </fieldset>
          <p className="muted">
            Контакти налаштовуються окремо.{" "}
            <Link href="/profile">Редагувати контакти</Link>
          </p>
          {mutation.isError && (
            <p role="alert" className="field-error">
              Не вдалося зберегти профіль. Перевірте дані та спробуйте ще раз.
            </p>
          )}
          {mutation.isSuccess && profile && (
            <p role="status">Зміни збережено.</p>
          )}
          <div className="form-actions breeder-save-actions">
            <button
              className="button primary"
              disabled={mutation.isPending || deleting || mediaBusy}
            >
              {mutation.isPending ? "Зберігаємо…" : "Зберегти зміни"}
            </button>
            {profile && (
              <Link href={"/sellers/" + userId}>
                Переглянути публічний профіль
              </Link>
            )}
          </div>
        </section>
      </form>
      {profile && <BreederAnimalsEntry userId={userId} />}
      {profile && (
        <BreederMediaEditor
          profile={profile}
          disabled={mutation.isPending || deleting}
          onBusy={setMediaBusy}
        />
      )}
      {profile && (
        <BreederDelete
          userId={userId}
          disabled={mutation.isPending || mediaBusy}
          onPending={setDeleting}
        />
      )}
    </section>
  );
}
