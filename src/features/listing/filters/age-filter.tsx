import { agePresets } from "./model";
export function AgeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor="filter-age">Вік</label>
      <select
        id="filter-age"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="filter-age-hint"
      >
        <option value="">Будь-який вік</option>
        {agePresets.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <p id="filter-age-hint" className="hint">
        Межі включні. Оголошення без вказаного віку не показуються.
      </p>
    </div>
  );
}
