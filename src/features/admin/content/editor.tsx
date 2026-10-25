"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
import {
  ListingImages,
  type ListingImagesHandle,
} from "@/features/listing/create-listing/ui/listing-images";
import type { BreedChoice } from "@/features/pet/breed-selector";
import type { Location } from "@/entities/location/model";
import { LocationSelector } from "@/entities/location/location-selector";
import { ContentReferences } from "./references";
import { DraftDetails, ContentState } from "./draft-details";
import { buildContentInput } from "./editor-input";
import { useContentUnsaved } from "./unsaved";
import { saveContent } from "./api";
import { kindLabels, statusLabels, type Content } from "./model";
export function ContentEditor({
  row,
  onSaved,
  breederDraftId,
  breederProfileId,
}: {
  row: Content | null;
  breederDraftId?: string;
  breederProfileId?: string;
  onSaved: (row: Content) => void;
}) {
  const actor = useSession().data!,
    client = useQueryClient(),
    draft = !row || row.source === "OPERATOR_DRAFT",
    prepared = row?.source === "OPERATOR_DRAFT" ? row : null;
  const [title, setTitle] = useState(row?.title ?? ""),
    [description, setDescription] = useState(row?.description ?? ""),
    [price, setPrice] = useState(row?.price ?? ""),
    [kind, setKind] = useState(row?.type ?? "SALE"),
    [requirements, setRequirements] = useState(
      row && "requirements" in row ? (row.requirements ?? "") : "",
    ),
    [status, setStatus] = useState(prepared?.status ?? "DRAFT"),
    [transition, setTransition] = useState(""),
    [reason, setReason] = useState("");
  const [speciesId, setSpecies] = useState(prepared?.speciesId ?? ""),
    [breed, setBreed] = useState<BreedChoice | null>(prepared?.breed ?? null),
    [location, setLocation] = useState<Location | null>(
      row?.location
        ? { ...row.location, countryCode: "UA", katottgCode: null }
        : null,
    );
  const [draftDetails, setDraftDetails] = useState({
    ownerReference: prepared?.ownerReference ?? "",
    breederDraftId: breederDraftId ?? prepared?.breederDraftId ?? "",
  });
  const [gender, setGender] = useState(prepared?.gender ?? "UNKNOWN"),
    [birthDate, setBirthDate] = useState(
      prepared?.birthDate?.slice(0, 10) ?? "",
    );
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false),
    lock = useRef(false),
    images = useRef<ListingImagesHandle>(null);
  useContentUnsaved(dirty);
  const editable =
    draft ||
    (row &&
      ["DRAFT", "ACTIVE"].includes(row.status) &&
      row.moderationStatus !== "HIDDEN");
  return (
    <form
      className="admin-management-form"
      noValidate
      onChange={() => setDirty(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || conflict || uploading) return;
        setError("");
        try {
          const body = buildContentInput({
            row,
            title,
            description,
            price,
            reason,
            kind,
            requirements,
            status,
            transition,
            speciesId,
            breedId: breed?.id ?? null,
            locationId: location?.id ?? null,
            photos: draft ? images.current?.submission() : undefined,
            draftDetails,
            breederProfileId:
              breederProfileId ?? prepared?.breederProfileId ?? undefined,
            gender,
            birthDate,
          });
          lock.current = true;
          setBusy(true);
          const generation = currentSessionGeneration();
          try {
            const saved = await runAdminRequest(client, actor.id, () =>
              saveContent(row?.id ?? null, draft, body),
            );
            if (
              generation !== currentSessionGeneration() ||
              !currentAdmin(client, actor.id)
            )
              return;
            setDirty(false);
            onSaved(saved);
          } catch (err) {
            if (
              generation !== currentSessionGeneration() ||
              !currentAdmin(client, actor.id)
            )
              return;
            if (err instanceof ApiError && err.status === 409)
              setConflict(true);
            throw err;
          } finally {
            lock.current = false;
            if (generation === currentSessionGeneration()) setBusy(false);
          }
        } catch (err) {
          if (!currentAdmin(client, actor.id)) return;
          setError(
            err instanceof ApiError
              ? err.status === 409
                ? "Дані змінилися. Оновіть запис перед повторним редагуванням."
                : err.message
              : err instanceof Error && err.name !== "ZodError"
                ? err.message
                : "Перевірте заголовок, опис і ціну.",
          );
        }
      }}
    >
      {draft && (
        <p className="status-panel">
          Приватна підготовка. Обліковий запис, тварина та публічне оголошення
          не створюються.
        </p>
      )}
      {!editable && (
        <p className="muted">
          Матеріали цього оголошення доступні лише для перегляду. Допустимі
          зміни стану виконуються окремо.
        </p>
      )}
      <fieldset disabled={busy || conflict || !editable}>
        <legend>
          {draft ? "Матеріали чернетки" : "Дозволені зміни оголошення"}
        </legend>
        {draft && (
          <>
            <SelectDropdown
              label="Стать тварини"
              value={gender}
              options={[
                { value: "UNKNOWN", label: "Не вказано" },
                { value: "MALE", label: "Самець" },
                { value: "FEMALE", label: "Самка" },
              ]}
              onChange={(v) => setGender(v as typeof gender)}
            />
            <div className="field">
              <label htmlFor="draft-birth">
                Дата народження — необов’язково
              </label>
              <input
                id="draft-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </>
        )}
        {draft && (
          <div className="field">
            <span>Тип оголошення</span>
            <SelectDropdown
              label="Тип оголошення"
              value={kind}
              options={Object.entries(kindLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(v) => {
                setKind(v as typeof kind);
                if (v !== "SALE" && v !== "MATING") setPrice("");
                setDirty(true);
              }}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="content-title">Заголовок</label>
          <input
            id="content-title"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="content-description">Опис</label>
          <textarea
            id="content-description"
            rows={5}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {draft ? (
          <ContentReferences
            speciesId={speciesId}
            breed={breed}
            location={location}
            onChange={(v) => {
              setSpecies(v.speciesId);
              setBreed(v.breed);
              setLocation(v.location);
              setDirty(true);
            }}
          />
        ) : (
          <LocationSelector
            selected={location}
            onSelect={(v) => {
              setLocation(v);
              setDirty(true);
            }}
          />
        )}
        {!draft && (
          <p className="muted">
            Власник, тварина, порода й вид тут не змінюються. Місце оголошення
            можна змінити без зміни профілю тварини.
          </p>
        )}
        {(kind === "SALE" || kind === "MATING") && (
          <div className="field">
            <label htmlFor="content-price">Ціна, грн</label>
            <input
              id="content-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              maxLength={13}
            />
          </div>
        )}
        {kind === "MATING" && (
          <div className="field">
            <label htmlFor="content-requirements">Умови партнера</label>
            <textarea
              id="content-requirements"
              maxLength={2000}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>
        )}
      </fieldset>
      {!draft && (
        <fieldset disabled={busy || conflict}>
          <legend>Адміністративне втручання</legend>
          <div className="field">
            <label htmlFor="content-reason">
              Причина адміністративної зміни
            </label>
            <textarea
              id="content-reason"
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="field">
            <span>Завершення або архівація</span>
            <SelectDropdown
              label="Завершення або архівація"
              value={transition}
              options={[
                { value: "", label: "Зберегти поточний стан" },
                ...[
                  "ARCHIVED",
                  ...(row!.status === "ACTIVE"
                    ? [
                        row!.source === "MATING"
                          ? "CLOSED"
                          : kind === "SALE"
                            ? "SOLD"
                            : kind === "FREE"
                              ? "TRANSFERRED"
                              : "ADOPTED",
                      ]
                    : []),
                ].map((value) => ({ value, label: statusLabels[value] })),
              ]}
              onChange={(v) => {
                setTransition(v);
                setDirty(true);
              }}
            />
          </div>
          <p className="muted">
            Матеріальні зміни схваленого активного оголошення повертають його на
            модерацію.
          </p>
        </fieldset>
      )}
      {draft && (
        <fieldset disabled={busy || conflict}>
          <legend>Приватна підготовка</legend>
          <DraftDetails
            locked={Boolean(
              breederDraftId ||
              breederProfileId ||
              prepared?.breederDraftId ||
              prepared?.breederProfileId,
            )}
            value={draftDetails}
            onChange={(v) => {
              setDraftDetails(v);
              setDirty(true);
            }}
          />
          <ListingImages
            reorderable={true}
            ref={images}
            initialImages={row?.images ?? []}
            onBusy={(v) => {
              setUploading(v);
              setDirty(true);
            }}
          />
          <ContentState
            value={status}
            onChange={(v) => {
              setStatus(v);
              setDirty(true);
            }}
          />
        </fieldset>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {conflict && (
        <button
          type="button"
          className="button secondary"
          onClick={() => window.location.reload()}
        >
          Оновити запис
        </button>
      )}
      <button className="button" disabled={busy || conflict || uploading}>
        {busy ? "Зберігаємо…" : "Зберегти"}
      </button>
    </form>
  );
}
