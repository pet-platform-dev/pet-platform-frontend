"use client";
import { useId } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import type { Filters } from "./model";
const options = [
  ["MALE", "Хлопчик"],
  ["FEMALE", "Дівчинка"],
  ["UNKNOWN", "Стать не вказана"],
] as const;
export function GenderFilter({
  value,
  onChange,
}: {
  value: Filters["gender"];
  onChange: (value: Filters["gender"]) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Стать</label>
      <SelectDropdown
        label="Стать"
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
