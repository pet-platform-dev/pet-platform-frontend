"use client";
import type { categorySlugs } from "@/entities/service-offer/model";
import type { Details } from "@/entities/service-provider/validation";
import { Select } from "../workspace/ui";
type Field = {
  key: string;
  label: string;
  kind: "text" | "list" | "number" | "boolean" | "select" | "multi";
  min?: number;
  max?: number;
  options?: readonly (readonly [string, string])[];
};
export const categoryFields: Record<(typeof categorySlugs)[number], Field[]> = {
  "veterinary-care": [
    {
      key: "consultationType",
      label: "Тип консультації",
      kind: "select",
      options: [
        ["GENERAL", "Загальна"],
        ["SPECIALIST", "Профільна"],
        ["FOLLOW_UP", "Повторна"],
      ],
    },
    { key: "specialties", label: "Напрями консультацій", kind: "list" },
    {
      key: "emergencyContactAvailable",
      label: "Доступний екстрений контакт",
      kind: "boolean",
    },
    {
      key: "experienceYears",
      label: "Років досвіду (заявлено власником)",
      kind: "number",
      min: 0,
      max: 80,
    },
  ],
  "pet-transportation": [
    {
      key: "coverage",
      label: "Напрям поїздок",
      kind: "select",
      options: [
        ["LOCAL", "У межах міста"],
        ["INTERCITY", "Між містами"],
        ["INTERNATIONAL", "Міжнародні"],
      ],
    },
    {
      key: "transportFormat",
      label: "Формат перевезення",
      kind: "select",
      options: [
        ["INDIVIDUAL", "Індивідуальний"],
        ["SHARED", "Спільний"],
        ["PET_TAXI", "Зоотаксі"],
      ],
    },
    { key: "operatingArea", label: "Опис напрямків", kind: "text", max: 300 },
    { key: "accompanied", label: "Супровід власником", kind: "boolean" },
    {
      key: "maxWeightKg",
      label: "Максимальна вага, кг",
      kind: "number",
      min: 1,
      max: 150,
    },
  ],
  grooming: [
    {
      key: "petSizes",
      label: "Розміри тварин",
      kind: "multi",
      options: [
        ["SMALL", "Малі"],
        ["MEDIUM", "Середні"],
        ["LARGE", "Великі"],
        ["GIANT", "Дуже великі"],
      ],
    },
    { key: "techniques", label: "Процедури", kind: "list" },
    {
      key: "maxWeightKg",
      label: "Максимальна вага, кг",
      kind: "number",
      min: 1,
      max: 150,
    },
  ],
  "dog-training": [
    {
      key: "sessionFormat",
      label: "Формат занять",
      kind: "select",
      options: [
        ["INDIVIDUAL", "Індивідуальний"],
        ["GROUP", "Груповий"],
        ["BOTH", "Обидва"],
      ],
    },
    { key: "focusAreas", label: "Напрями навчання", kind: "list" },
  ],
  "pet-boarding": [
    {
      key: "setting",
      label: "Місце перетримки",
      kind: "select",
      options: [
        ["HOME", "Вдома"],
        ["FACILITY", "Спеціальний заклад"],
      ],
    },
    {
      key: "capacity",
      label: "Кількість місць",
      kind: "number",
      min: 1,
      max: 100,
    },
    {
      key: "vaccinationRequired",
      label: "Потрібна вакцинація",
      kind: "boolean",
    },
    { key: "conditions", label: "Умови догляду", kind: "list" },
  ],
  "pet-sitting": [
    {
      key: "careFormat",
      label: "Формат догляду",
      kind: "select",
      options: [
        ["HOME_VISITS", "Відвідування"],
        ["IN_HOME_CARE", "Догляд удома"],
      ],
    },
    { key: "conditions", label: "Умови догляду", kind: "list" },
  ],
  "pet-walking": [
    {
      key: "walkDurationMinutes",
      label: "Тривалість прогулянки, хвилин",
      kind: "number",
      min: 10,
      max: 240,
    },
  ],
};
export function CategoryFields({
  slug,
  value,
  onChange,
}: {
  slug: (typeof categorySlugs)[number];
  value: Details;
  onChange: (value: Details) => void;
}) {
  function set(key: string, next: Details[string] | undefined) {
    const copy = { ...value };
    if (next === undefined) delete copy[key];
    else copy[key] = next;
    onChange(copy);
  }
  return (
    <fieldset>
      <legend>Особливості послуги</legend>
      <p className="muted">
        Необов’язкові відомості, заявлені власником. Професійні кваліфікації не
        перевірено.
      </p>
      <div className="workspace-field-grid">
        {categoryFields[slug].map((f) => {
          if (f.kind === "select" || f.kind === "boolean")
            return (
              <Select
                key={f.key}
                label={f.label}
                value={value[f.key] === undefined ? "" : String(value[f.key])}
                onChange={(v) =>
                  set(
                    f.key,
                    v === ""
                      ? undefined
                      : f.kind === "boolean"
                        ? v === "true"
                        : v,
                  )
                }
                options={[
                  { value: "", label: "Не вказано" },
                  ...(f.kind === "boolean"
                    ? [
                        { value: "true", label: "Так" },
                        { value: "false", label: "Ні" },
                      ]
                    : (f.options ?? []).map(([value, label]) => ({
                        value,
                        label,
                      }))),
                ]}
              />
            );
          if (f.kind === "multi")
            return (
              <fieldset key={f.key}>
                <legend>{f.label}</legend>
                {f.options?.map(([key, label]) => (
                  <label className="workspace-check" key={key}>
                    <input
                      type="checkbox"
                      checked={
                        Array.isArray(value[f.key]) &&
                        (value[f.key] as string[]).includes(key)
                      }
                      onChange={(e) => {
                        const current = Array.isArray(value[f.key])
                          ? (value[f.key] as string[])
                          : [];
                        set(
                          f.key,
                          e.target.checked
                            ? [...current, key]
                            : current.filter((k) => k !== key),
                        );
                      }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            );
          return (
            <div className="field" key={f.key}>
              <label htmlFor={`detail-${f.key}`}>{f.label}</label>
              {f.kind === "list" ? (
                <textarea
                  id={`detail-${f.key}`}
                  rows={3}
                  maxLength={809}
                  placeholder="Одне значення в рядку; до 10 значень"
                  value={
                    Array.isArray(value[f.key])
                      ? (value[f.key] as string[]).join("\n")
                      : ""
                  }
                  onChange={(e) => set(f.key, e.target.value.split("\n"))}
                />
              ) : (
                <input
                  id={`detail-${f.key}`}
                  type={f.kind === "number" ? "number" : "text"}
                  min={f.min}
                  max={f.max}
                  maxLength={f.max}
                  value={String(value[f.key] ?? "")}
                  onChange={(e) =>
                    set(
                      f.key,
                      e.target.value === ""
                        ? undefined
                        : f.kind === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
