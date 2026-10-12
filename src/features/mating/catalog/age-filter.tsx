import { useId } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { matingAgeChoices } from "./age-options";
export function MatingAgeFilter({
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
        describedBy={`${id}-hint`}
        value={value}
        options={matingAgeChoices(value)}
        onChange={onChange}
      />
      <p id={`${id}-hint`} className="hint">
        Межі включні. За обраного діапазону оголошення без вказаного віку не
        показуються.
      </p>
    </div>
  );
}
