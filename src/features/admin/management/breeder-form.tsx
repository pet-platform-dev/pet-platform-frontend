"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import { runAdminRequest, currentAdmin } from "../moderation/cache";
import { BreederTextFields } from "@/features/breeder/editor/breeder-text-fields";
import { BreederBreedSelector } from "@/features/breeder/editor/breeder-breed-selector";
import { emptyValues } from "@/features/breeder/editor/validation";
import { LocationSelector } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import { parseManagedFields } from "./form-validation";
import { saveManagedBreeder } from "./api";
import type { ManagedBreeder } from "./model";
export function AdminBreederForm({
  profile,
  onSaved,
}: {
  profile: ManagedBreeder | null;
  onSaved: (row: ManagedBreeder) => void;
}) {
  const actor = useSession().data!,
    client = useQueryClient(),
    draft = !profile || profile.source === "OPERATOR_PREPARED";
  const [values, setValues] = useState(
    profile
      ? {
          kennelName: profile.kennelName ?? "",
          description: profile.description ?? "",
          startedYear: profile.startedYear?.toString() ?? "",
          website: profile.website ?? "",
        }
      : emptyValues,
  );
  const [location, setLocation] = useState<Location | null>(
    profile?.location
      ? {
          ...profile.location,
          district: null,
          community: null,
          settlementType: null,
          katottgCode: null,
        }
      : null,
  );
  const [breeds, setBreeds] = useState(
      profile?.breeds.map((item) => item.breed) ?? [],
    ),
    [notes, setNotes] = useState(profile?.operatorNotes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    submitted = useRef(false);
  return (
    <form
      className="admin-management-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitted.current || conflict) return;
        const fields = parseManagedFields(
          values,
          draft,
          location?.id ?? null,
          breeds.map((b) => b.id),
          notes,
        );
        if (!fields.success) {
          const issues = fields.error.issues;
          setErrors(
            Object.fromEntries(
              issues.map((issue) => [String(issue.path[0]), issue.message]),
            ),
          );
          return;
        }
        setErrors({});
        setMessage("");
        submitted.current = true;
        setBusy(true);
        const generation = currentSessionGeneration();
        try {
          const row = await runAdminRequest(client, actor.id, () =>
            saveManagedBreeder(
              profile?.id ?? null,
              profile
                ? {
                    ...fields.data,
                    source: profile.source,
                    expectedUpdatedAt: profile.updatedAt,
                  }
                : {
                    ...fields.data,
                  },
            ),
          );
          if (
            generation !== currentSessionGeneration() ||
            !currentAdmin(client, actor.id)
          )
            return;
          onSaved(row);
        } catch (error) {
          if (
            generation !== currentSessionGeneration() ||
            !currentAdmin(client, actor.id)
          )
            return;
          setMessage(
            error instanceof ApiError && error.status === 409
              ? "Запис уже існує або змінився. Поверніться до списку чи оновіть дані перед повторним редагуванням."
              : "Не вдалося зберегти. Перевірте поля й доступні довідникові значення та спробуйте знову.",
          );
          if (error instanceof ApiError && error.status === 409)
            setConflict(true);
        } finally {
          submitted.current = false;
          if (generation === currentSessionGeneration()) setBusy(false);
        }
      }}
    >
      <p className="muted">
        {draft
          ? "Це приватна підготовка. Публікація, запрошення та передача власнику недоступні."
          : "Дозволено редагувати лише наведену інформацію розплідника. Кожна зміна записується в аудиті. Власник, акаунт, контакти й медіа не змінюються."}
      </p>
      <fieldset disabled={busy || conflict}>
        <legend>Інформація розплідника</legend>
        <BreederTextFields
          values={values}
          optionalName={draft}
          errors={errors}
          disabled={busy || conflict}
          onChange={(key, value) =>
            setValues((old) => ({ ...old, [key]: value }))
          }
        />
        <LocationSelector
          selected={location}
          onSelect={setLocation}
          error={errors.locationId}
          label="Місто або село"
        />
        <BreederBreedSelector
          selected={breeds}
          onChange={setBreeds}
          error={errors.breedIds}
        />
        {draft && (
          <div className="field">
            <label htmlFor="operatorNotes">
              Внутрішня примітка — необов’язково
            </label>
            <textarea
              id="operatorNotes"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            {errors.operatorNotes && <p role="alert">{errors.operatorNotes}</p>}
          </div>
        )}
      </fieldset>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      {conflict && profile && (
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            void client.invalidateQueries({
              queryKey: ["admin-management", actor.id, "breeder", profile.id],
            })
          }
        >
          Оновити дані
        </button>
      )}
      <div className="account-actions">
        <button
          className="button primary"
          disabled={busy || conflict}
          type="submit"
        >
          {busy
            ? "Зберігаємо…"
            : profile
              ? "Зберегти зміни"
              : "Створити приватну чернетку"}
        </button>
        {draft && (
          <button className="button secondary" disabled type="button">
            Публікація недоступна
          </button>
        )}
      </div>
    </form>
  );
}
