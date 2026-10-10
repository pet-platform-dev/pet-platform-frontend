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
  return (
    <div className="field">
      <label htmlFor="filter-type">Тип оголошення</label>
      <select
        id="filter-type"
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
