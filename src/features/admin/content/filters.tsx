"use client";
import { useState } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { ContentReferences } from "./references";
import { sources, kindLabels, statusLabels } from "./model";
import type { BreedChoice } from "@/features/pet/breed-selector";
import type { Location } from "@/entities/location/model";
export function ContentFilters({
  params,
  pets,
  onChange,
}: {
  params: URLSearchParams;
  pets: boolean;
  onChange: (changes: Record<string, string>) => void;
}) {
  const [q, setQ] = useState(params.get("q") ?? ""),
    [breed, setBreed] = useState<BreedChoice | null>(null),
    [location, setLocation] = useState<Location | null>(null);
  const dropdown = (
    key: string,
    label: string,
    options: Record<string, string>,
    all?: string,
  ) => (
    <div className="field" key={key}>
      <span>{label}</span>
      <SelectDropdown
        label={label}
        value={params.get(key) ?? ""}
        options={[
          ...(all ? [{ value: "", label: all }] : []),
          ...Object.entries(options).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        onChange={(value) =>
          onChange({
            [key]: value,
            ...(key === "source"
              ? { status: "", type: "", moderationStatus: "", ownerType: "" }
              : {}),
          })
        }
      />
    </div>
  );
  return (
    <form
      className="admin-management-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ q: q.trim() });
      }}
    >
      <div className="field">
        <label htmlFor="content-search">
          {pets ? "Пошук за ім’ям тварини" : "Пошук за заголовком або описом"}
        </label>
        <input
          id="content-search"
          type="search"
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="button secondary compact" type="submit">
          Шукати
        </button>
      </div>
      {!pets && dropdown("source", "Джерело", sources)}
      <ContentReferences
        pets={pets}
        speciesId={params.get("speciesId") ?? ""}
        breed={breed}
        location={location}
        onChange={(v) => {
          setBreed(v.breed);
          setLocation(v.location);
          onChange({
            speciesId: v.speciesId,
            breedId: v.breed?.id ?? "",
            ...(!pets ? { locationId: v.location?.id ?? "" } : {}),
          });
        }}
      />
      {!pets && (
        <>
          {dropdown("type", "Тип оголошення", kindLabels, "Усі типи")}
          {dropdown(
            "status",
            "Стан оголошення",
            Object.fromEntries(
              Object.entries(statusLabels).filter(
                ([key]) => !["NOT_SUBMITTED", "APPROVED"].includes(key),
              ),
            ),
            "Усі стани",
          )}
          {params.get("source") !== "OPERATOR_DRAFT" &&
            dropdown(
              "moderationStatus",
              "Модерація",
              {
                NOT_SUBMITTED: "Не надіслано",
                PENDING: "На розгляді",
                APPROVED: "Схвалено",
                REJECTED: "Відхилено",
                HIDDEN: "Приховано",
              },
              "Усі стани",
            )}
          {params.get("source") !== "OPERATOR_DRAFT" &&
            dropdown(
              "ownerType",
              "Тип власника",
              { SELLER: "Власник тварини", BREEDER: "Заводчик" },
              "Усі власники",
            )}
          {(["createdFrom", "createdTo"] as const).map((key) => (
            <div className="field" key={key}>
              <label htmlFor={key}>
                {key === "createdFrom" ? "Створено від" : "Створено до"}
              </label>
              <input
                id={key}
                type="date"
                value={params.get(key)?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  onChange({
                    [key]: e.target.value
                      ? `${e.target.value}T${key === "createdFrom" ? "00:00:00.000" : "23:59:59.999"}Z`
                      : "",
                  })
                }
              />
            </div>
          ))}
        </>
      )}
      {dropdown("sort", "Сортування", {
        NEWEST: "Спочатку нові",
        OLDEST: "Спочатку давні",
        TITLE_ASC: pets ? "Ім’я: А–Я" : "Заголовок: А–Я",
        TITLE_DESC: pets ? "Ім’я: Я–А" : "Заголовок: Я–А",
      })}
      {dropdown("limit", "На сторінці", { "12": "12", "24": "24", "48": "48" })}
    </form>
  );
}
