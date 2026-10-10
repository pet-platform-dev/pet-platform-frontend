import type { Filters } from "./model";
export function SpeciesFilter({
  value,
  onChange,
}: {
  value: Filters["species"];
  onChange: (value: Filters["species"]) => void;
}) {
  return (
    <fieldset className="filter-species">
      <legend>Вид тварини</legend>
      {[
        ["", "Усі"],
        ["dog", "Собаки"],
        ["cat", "Коти"],
      ].map(([id, label]) => (
        <label key={id}>
          <input
            type="radio"
            name="catalog-species"
            checked={(value ?? "") === id}
            onChange={() =>
              onChange(id === "dog" || id === "cat" ? id : undefined)
            }
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
