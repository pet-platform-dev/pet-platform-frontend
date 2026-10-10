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
  return (
    <div className="field">
      <label htmlFor="filter-gender">Стать</label>
      <select
        id="filter-gender"
        value={value ?? ""}
        onChange={(event) =>
          onChange(options.find(([id]) => id === event.target.value)?.[0])
        }
      >
        <option value="">Усі</option>
        {options.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
