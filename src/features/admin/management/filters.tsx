"use client";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import {
  roleLabels,
  accountLabels,
  verificationLabels,
  sourceLabels,
} from "./model";
import type { ListState, ManagementKind } from "./navigation";
export function ManagementFilters({
  kind,
  state,
  onChange,
}: {
  kind: ManagementKind;
  state: ListState;
  onChange: (changes: Partial<ListState>) => void;
}) {
  const [search, setSearch] = useState(state.q),
    debounced = useDebouncedValue(search, 300);
  useEffect(() => {
    if (debounced.trim() !== state.q)
      onChange({ q: debounced.trim(), page: 1 });
  }, [debounced, state.q, onChange]);
  const entries: {
    key: keyof ListState;
    label: string;
    labels: Record<string, string>;
    all?: string;
  }[] =
    kind === "users"
      ? [
          {
            key: "role",
            label: "Технічна роль",
            labels: roleLabels,
            all: "Усі ролі",
          },
          {
            key: "accountType",
            label: "Тип акаунта",
            labels: accountLabels,
            all: "Усі типи",
          },
          {
            key: "verificationStatus",
            label: "Підтвердження пошти",
            labels: verificationLabels,
            all: "Усі стани",
          },
        ]
      : [
          { key: "source", label: "Джерело профілю", labels: sourceLabels },
          {
            key: "visibility",
            label: "Видимість",
            labels: { PUBLIC: "Публічні", PRIVATE: "Приватні" },
            all: "Усі стани",
          },
        ];
  return (
    <div className="admin-management-filters">
      <div className="field">
        <label htmlFor="admin-management-search">
          {kind === "users"
            ? "Пошук за ім’ям або поштою"
            : "Пошук за назвою розплідника"}
        </label>
        <input
          id="admin-management-search"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {entries.map(({ key, label, labels, all }) => (
        <div className="field" key={key}>
          <span>{label}</span>
          <SelectDropdown
            label={label}
            value={String(state[key] ?? "")}
            options={[
              ...(all ? [{ value: "", label: all }] : []),
              ...Object.entries(labels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            onChange={(value) =>
              onChange({ [key]: value || undefined, page: 1 })
            }
          />
        </div>
      ))}
      <div className="field">
        <span>Сортування</span>
        <SelectDropdown
          label="Сортування"
          value={state.sort}
          options={[
            { value: "NEWEST", label: "Спочатку нові" },
            { value: "OLDEST", label: "Спочатку давні" },
            { value: "NAME_ASC", label: "За назвою: А–Я" },
            { value: "NAME_DESC", label: "За назвою: Я–А" },
          ]}
          onChange={(sort) => onChange({ sort, page: 1 })}
        />
      </div>
    </div>
  );
}
