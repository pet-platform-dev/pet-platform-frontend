"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSpecies } from "@/features/pet/api";
import { speciesLabel, type Species } from "@/entities/species/model";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import { runAdminRequest, currentAdmin } from "../moderation/cache";
import { BreederTextFields } from "@/features/breeder/editor/breeder-text-fields";
import { BreederBreedSelector } from "@/features/breeder/editor/breeder-breed-selector";
import { emptyValues } from "@/features/breeder/editor/validation";
import { LocationSelector } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import { parseManagedFields } from "./form-validation";
import { saveManagedBreeder, getManagedBreeder, managementKey } from "./api";
import type { ManagedBreeder } from "./model";
export function AdminBreederForm({
  profile,
  onSaved,
  stage,
  getCreationId,
  submitLabel,
}: {
  profile: ManagedBreeder | null;
  onSaved: (row: ManagedBreeder) => void;
  stage?: "basic";
  getCreationId?: () => string;
  submitLabel?: string;
}) {
  const actor = useSession().data!,
    client = useQueryClient(),
    draft = !profile || profile.source === "OPERATOR_PREPARED";
  const speciesQuery = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
    enabled: stage === "basic",
  });
  const [species, setSpecies] = useState<Species["slug"] | "">("");
  const [baseline, setBaseline] = useState(profile);
  const identity = (row: ManagedBreeder) =>
    JSON.stringify([
      row.kennelName,
      row.description,
      row.startedYear,
      row.breeds.map((b) => b.breed.id).sort(),
      ...(stage === "basic"
        ? []
        : [row.website, row.locationId, row.operatorNotes ?? null]),
    ]);
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
      aria-busy={busy}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitted.current || conflict) return;
        if (profile && baseline && identity(profile) !== identity(baseline)) {
          setConflict(true);
          setMessage(
            "Основні дані змінилися. Оновіть дані перед збереженням; введений текст залишено у формі.",
          );
          return;
        }
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
        const data =
          stage === "basic"
            ? {
                kennelName: fields.data.kennelName,
                description: fields.data.description,
                startedYear: fields.data.startedYear,
                breedIds: fields.data.breedIds,
              }
            : fields.data;
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
                    ...data,
                    source: profile.source,
                    expectedUpdatedAt: profile.updatedAt,
                  }
                : {
                    ...data,
                    ...(getCreationId ? { creationId: getCreationId() } : {}),
                  },
            ),
          );
          if (
            generation !== currentSessionGeneration() ||
            !currentAdmin(client, actor.id)
          )
            return;
          setBaseline(row);
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
          ? "Це приватна підготовка. Після збереження чернетки можна запросити власника. Публікація з цього редактора недоступна."
          : "Дозволено редагувати лише наведену інформацію розплідника. Кожна зміна записується в аудиті. Власник і акаунт не змінюються. Медіа редагуються окремо нижче."}
      </p>
      <fieldset disabled={busy || conflict}>
        <legend>Інформація розплідника</legend>
        <BreederTextFields
          fields={
            stage === "basic"
              ? ["kennelName", "description", "startedYear"]
              : undefined
          }
          values={values}
          optionalName={draft}
          errors={errors}
          disabled={busy || conflict}
          onChange={(key, value) =>
            setValues((old) => ({ ...old, [key]: value }))
          }
        />
        {stage !== "basic" && (
          <LocationSelector
            selected={location}
            onSelect={setLocation}
            error={errors.locationId}
            label="Місто або село"
          />
        )}
        {stage === "basic" && (
          <SelectDropdown
            label="Вид тварини"
            value={species}
            onChange={setSpecies}
            options={[
              { value: "", label: "Усі види" },
              ...(speciesQuery.data ?? []).map((item) => ({
                value: item.slug,
                label: speciesLabel(item.slug, true),
              })),
            ]}
          />
        )}
        {stage === "basic" && (
          <p className="muted">
            Вид тварини допомагає знайти породи. Розплідник може мати породи
            різних видів.
          </p>
        )}
        <BreederBreedSelector
          species={stage === "basic" ? species || undefined : undefined}
          selected={breeds}
          onChange={setBreeds}
          error={errors.breedIds}
        />
        {draft && !stage && (
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
          onClick={async () => {
            try {
              const row = await runAdminRequest(client, actor.id, () =>
                getManagedBreeder(profile.id, profile.source),
              );
              client.setQueryData(
                managementKey(actor.id, "breeder", row.id, row.source),
                row,
              );
              setBaseline(row);
              setValues({
                kennelName: row.kennelName ?? "",
                description: row.description ?? "",
                startedYear: row.startedYear?.toString() ?? "",
                website: row.website ?? "",
              });
              setLocation(
                row.location
                  ? {
                      ...row.location,
                      district: null,
                      community: null,
                      settlementType: null,
                      katottgCode: null,
                    }
                  : null,
              );
              setBreeds(row.breeds.map((item) => item.breed));
              setNotes(row.operatorNotes ?? "");
              setConflict(false);
              setMessage("");
            } catch {
              setMessage("Не вдалося оновити дані. Спробуйте ще раз.");
            }
          }}
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
            : (submitLabel ??
              (profile ? "Зберегти зміни" : "Створити приватну чернетку"))}
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
