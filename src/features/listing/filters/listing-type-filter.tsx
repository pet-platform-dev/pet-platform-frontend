"use client";
import { useId } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import type { Filters } from "./model";
const options = [
  ["SALE", "Продаж"],
  ["FREE", "Безкоштовно"],
  ["ADOPTION", "Прилаштування"],
] as const;
export function ListingTypeFilter({
  value,
  onChange,
}: {
  value: Filters["type"];
  onChange: (value: Filters["type"]) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Тип оголошення</label>
      <SelectDropdown
        label="Тип оголошення"
        controlId={id}
        value={value ?? ""}
        options={[
          { value: "", label: "Усі" },
          ...options.map(([value, label]) => ({ value, label })),
        ]}
        onChange={(value) =>
          onChange(options.find(([id]) => id === value)?.[0])
        }
      />
    </div>
  );
}
