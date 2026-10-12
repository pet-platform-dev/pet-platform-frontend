"use client";
import { useId } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { agePresets } from "./model";
import { customAgeLabel } from "./filter-age-range";
export function AgeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Вік</label>
      <SelectDropdown
        label="Вік"
        controlId={id}
        describedBy={id + "-hint"}
        value={value}
        options={[
          { value: "", label: "Будь-який вік" },
          ...(value.startsWith("range:")
            ? [{ value, label: customAgeLabel(value) }]
            : []),
          ...agePresets,
        ]}
        onChange={onChange}
      />
      <p id={id + "-hint"} className="hint">
        Межі включні. За обраного діапазону оголошення без вказаного віку не
        показуються.
      </p>
    </div>
  );
}
